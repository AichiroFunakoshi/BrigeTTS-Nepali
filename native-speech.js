// iOSネイティブアプリ（WKWebView）用の音声認識ブリッジ
// WKWebViewにはWeb Speech APIの音声認識が存在しないため、
// ネイティブのSFSpeechRecognizerをwebkitSpeechRecognition互換のAPIとして公開する。
// 通常のブラウザ/PWAではメッセージハンドラが存在しないため、何もしない。
(function () {
    'use strict';

    const nativeHandler = window.webkit &&
        window.webkit.messageHandlers &&
        window.webkit.messageHandlers.nativeSpeech;

    if (!nativeHandler) {
        return;
    }

    console.log('ネイティブ音声認識ブリッジを有効化（iOSアプリモード）');

    let activeInstance = null;

    class NativeSpeechRecognition {
        constructor() {
            this.lang = 'ja-JP';
            this.continuous = false;
            this.interimResults = false;
            this.maxAlternatives = 1;
            this.onstart = null;
            this.onend = null;
            this.onresult = null;
            this.onerror = null;
            this._running = false;
            this._segments = [];
        }

        start() {
            if (this._running) {
                throw new DOMException('recognition has already started', 'InvalidStateError');
            }
            if (activeInstance && activeInstance !== this && activeInstance._running) {
                activeInstance.abort();
            }
            activeInstance = this;
            this._running = true;
            this._segments = [];
            nativeHandler.postMessage({ action: 'start', lang: this.lang || 'ja-JP' });
        }

        stop() {
            nativeHandler.postMessage({ action: 'stop' });
        }

        abort() {
            nativeHandler.postMessage({ action: 'abort' });
        }

        _dispatch(event) {
            switch (event.type) {
                case 'start':
                    if (typeof this.onstart === 'function') {
                        this.onstart();
                    }
                    break;
                case 'result': {
                    const segmentIndex = Math.max(0, event.segment | 0);
                    // SpeechRecognitionResult互換: result[0].transcript と result.isFinal
                    const result = [{
                        transcript: typeof event.transcript === 'string' ? event.transcript : '',
                        confidence: typeof event.confidence === 'number' ? event.confidence : 1
                    }];
                    result.isFinal = Boolean(event.isFinal);
                    this._segments[segmentIndex] = result;

                    const results = this._segments.filter(Boolean);
                    if (typeof this.onresult === 'function') {
                        this.onresult({
                            results: results,
                            resultIndex: Math.max(0, results.length - 1)
                        });
                    }
                    break;
                }
                case 'error':
                    if (typeof this.onerror === 'function') {
                        this.onerror({ error: event.error || 'unknown' });
                    }
                    break;
                case 'end':
                    this._running = false;
                    if (typeof this.onend === 'function') {
                        this.onend();
                    }
                    break;
                default:
                    console.warn('未知のネイティブ音声認識イベント:', event.type);
            }
        }
    }

    // ネイティブ側（Swift）から evaluateJavaScript で呼び出されるエントリポイント
    window.__bridgeNativeSpeechEvent = function (event) {
        if (!event || typeof event !== 'object') return;
        if (activeInstance) {
            activeInstance._dispatch(event);
        }
    };

    window.SpeechRecognition = NativeSpeechRecognition;
    window.webkitSpeechRecognition = NativeSpeechRecognition;
    window.__BRIDGE_TTS_NATIVE_APP__ = true;
})();
