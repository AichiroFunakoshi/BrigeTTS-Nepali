import AVFoundation
import Foundation
import Speech
import WebKit

/// SFSpeechRecognizerをWebアプリ（native-speech.js）に橋渡しするブリッジ。
///
/// JS側からは `window.webkit.messageHandlers.nativeSpeech.postMessage()` で
/// `start` / `stop` / `abort` を受け取り、結果は
/// `window.__bridgeNativeSpeechEvent({...})` の呼び出しで返す。
///
/// 認識は「セグメント」単位で扱う:
/// - 部分結果は現在のセグメント番号で isFinal=false として通知
/// - 一定時間（pauseFinalizeInterval）発話が途切れる、または認識器が
///   isFinalを返したらセグメントを確定し、次のセグメントの認識を内部で再開する。
///   これによりWeb側は連続認識（continuous=true）として扱える。
final class SpeechRecognitionBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?

    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var pauseTimer: Timer?

    private var segmentIndex = 0
    private var currentTranscript = ""
    private var isRunning = false
    private var isStopping = false
    /// 古い認識タスクからのコールバックを無視するための世代カウンタ
    private var taskGeneration = 0

    /// 発話が途切れてからセグメントを確定するまでの時間（秒）
    private let pauseFinalizeInterval: TimeInterval = 1.0

    // MARK: - WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "nativeSpeech",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        switch action {
        case "start":
            let lang = (body["lang"] as? String) ?? "ja-JP"
            start(lang: lang)
        case "stop":
            stop(aborted: false)
        case "abort":
            stop(aborted: true)
        default:
            break
        }
    }

    // MARK: - 認識制御

    private func start(lang: String) {
        if isRunning {
            stopEngine()
        }

        requestPermissions { [weak self] granted in
            guard let self else { return }
            guard granted else {
                self.emit(["type": "error", "error": "not-allowed"])
                self.emit(["type": "end"])
                return
            }
            self.beginRecognition(lang: lang)
        }
    }

    private func requestPermissions(completion: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else {
                    completion(false)
                    return
                }
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        completion(granted)
                    }
                }
            }
        }
    }

    private func beginRecognition(lang: String) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)),
              recognizer.isAvailable else {
            emit(["type": "error", "error": "service-not-allowed"])
            emit(["type": "end"])
            return
        }

        self.recognizer = recognizer
        segmentIndex = 0
        currentTranscript = ""
        isStopping = false

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(
                .playAndRecord,
                mode: .measurement,
                options: [.defaultToSpeaker, .duckOthers, .allowBluetooth]
            )
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            try startRecognitionTask()

            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.removeTap(onBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                self?.request?.append(buffer)
            }
            audioEngine.prepare()
            try audioEngine.start()

            isRunning = true
            emit(["type": "start"])
        } catch {
            stopEngine()
            emit(["type": "error", "error": "audio-capture"])
            emit(["type": "end"])
        }
    }

    private func startRecognitionTask() throws {
        guard let recognizer else {
            throw NSError(domain: "SpeechRecognitionBridge", code: -1)
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if #available(iOS 16, *) {
            request.addsPunctuation = true
        }
        self.request = request

        taskGeneration += 1
        let generation = taskGeneration
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, generation == self.taskGeneration else { return }
                self.handleRecognition(result: result, error: error)
            }
        }
    }

    private func handleRecognition(result: SFSpeechRecognitionResult?, error: Error?) {
        guard !isStopping else { return }

        if let result {
            let transcript = result.bestTranscription.formattedString
            if !transcript.isEmpty {
                currentTranscript = transcript
                emitResult(transcript: transcript, isFinal: false)
                schedulePauseTimer()
            }

            if result.isFinal {
                finalizeSegment()
                restartTaskForNextSegment()
                return
            }
        }

        if error != nil {
            // 認識タスクのエラー（無音タイムアウト等）。
            // 現在のセグメントを確定してセッションを終了し、Web側の自動再開に委ねる。
            finalizeSegment()
            stopEngine()
            emit(["type": "end"])
        }
    }

    private func schedulePauseTimer() {
        pauseTimer?.invalidate()
        pauseTimer = Timer.scheduledTimer(
            withTimeInterval: pauseFinalizeInterval,
            repeats: false
        ) { [weak self] _ in
            guard let self, self.isRunning, !self.isStopping else { return }
            if !self.currentTranscript.isEmpty {
                self.finalizeSegment()
                self.restartTaskForNextSegment()
            }
        }
    }

    private func finalizeSegment() {
        pauseTimer?.invalidate()
        pauseTimer = nil

        let transcript = currentTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        currentTranscript = ""
        if !transcript.isEmpty {
            emitResult(transcript: transcript, isFinal: true)
            segmentIndex += 1
        }
    }

    private func restartTaskForNextSegment() {
        taskGeneration += 1
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil

        do {
            try startRecognitionTask()
        } catch {
            stopEngine()
            emit(["type": "end"])
        }
    }

    private func stop(aborted: Bool) {
        guard isRunning || task != nil else {
            // 非実行中でもendを返してJS側の実行フラグを解消する
            emit(["type": "end"])
            return
        }

        isStopping = true
        if aborted {
            pauseTimer?.invalidate()
            pauseTimer = nil
            currentTranscript = ""
        } else {
            // 確定前の発話が残っていれば最終結果として通知する
            finalizeSegment()
        }

        stopEngine()
        emit(["type": "end"])
    }

    private func stopEngine() {
        pauseTimer?.invalidate()
        pauseTimer = nil

        taskGeneration += 1
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil

        if audioEngine.isRunning {
            audioEngine.stop()
        }
        audioEngine.inputNode.removeTap(onBus: 0)

        isRunning = false
        isStopping = false

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - JSへのイベント送出

    private func emitResult(transcript: String, isFinal: Bool) {
        emit([
            "type": "result",
            "segment": segmentIndex,
            "transcript": transcript,
            "isFinal": isFinal
        ])
    }

    private func emit(_ payload: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return
        }

        let js = "window.__bridgeNativeSpeechEvent && window.__bridgeNativeSpeechEvent(\(json));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}
