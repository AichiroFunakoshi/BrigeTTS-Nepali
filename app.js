// リアルタイム音声翻訳 - JavaScript（デバウンス最適化版）
document.addEventListener('DOMContentLoaded', function() {
    // デフォルトAPIキー
    const DEFAULT_OPENAI_API_KEY = '';

    // APIキー保存
    let OPENAI_API_KEY = '';

    // TTS関連変数
    let isTTSEnabled = true; // デフォルトでTTS有効
    let isTTSPlaying = false; // TTS再生中フラグ
    let ttsInitialized = false; // iOS Safari用: TTS初期化済みフラグ
    let ttsSpeed = 1.0; // TTS再生速度（デフォルト: 1.0）

    // 会話モード: 録音停止後に最後の翻訳結果を自動読み上げ（Google翻訳の会話モード相当）
    let isAutoTTSEnabled = false;
    let autoSpeakArmed = false; // 録音停止後の自動読み上げ待機フラグ
    let autoSpeakFallbackTimer = null;
    const AUTO_SPEAK_FALLBACK_MS = 2000; // 停止後、最終翻訳が来ない場合に発火するまでの待ち時間
    
    // DOM要素
    const startJapaneseBtn = document.getElementById('startJapaneseBtn');
    const startNepaliBtn = document.getElementById('startNepaliBtn');
    const stopBtn = document.getElementById('stopBtn');
    const stopBtnText = document.getElementById('stopBtnText');
    const resetBtn = document.getElementById('resetBtn');
    const status = document.getElementById('status');
    const errorMessage = document.getElementById('errorMessage');
    const originalText = document.getElementById('originalText');
    const translatedText = document.getElementById('translatedText');
    const sourceLanguage = document.getElementById('sourceLanguage');
    const targetLanguage = document.getElementById('targetLanguage');
    const apiModal = document.getElementById('apiModal');
    const settingsButton = document.getElementById('settingsButton');
    const openaiKeyInput = document.getElementById('openaiKey');
    const saveApiKeysBtn = document.getElementById('saveApiKeys');
    const resetKeysBtn = document.getElementById('resetKeys');
    const listeningIndicator = document.getElementById('listeningIndicator');
    const translatingIndicator = document.getElementById('translatingIndicator');
    const speakingIndicator = document.getElementById('speakingIndicator');
    const ttsToggle = document.getElementById('ttsToggle');
    const autoTtsToggle = document.getElementById('autoTtsToggle');
    const fontSizeSmallBtn = document.getElementById('fontSizeSmall');
    const fontSizeMediumBtn = document.getElementById('fontSizeMedium');
    const fontSizeLargeBtn = document.getElementById('fontSizeLarge');
    const fontSizeXLargeBtn = document.getElementById('fontSizeXLarge');
    const fontSizeToggleBtn = document.getElementById('fontSizeToggleBtn');
    const translationBox = document.getElementById('translationBox');
    const originalBox = document.getElementById('originalBox');
    const tapHint = document.getElementById('tapHint');
    const copyTranslationBtn = document.getElementById('copyTranslationBtn');
    const presentTranslationBtn = document.getElementById('presentTranslationBtn');
    const presentModal = document.getElementById('presentModal');
    const presentText = document.getElementById('presentText');
    const presentOriginal = document.getElementById('presentOriginal');
    const presentReplayBtn = document.getElementById('presentReplayBtn');
    const presentCloseBtn = document.getElementById('presentCloseBtn');
    const conversationLog = document.getElementById('conversationLog');
    const conversationLogList = document.getElementById('conversationLogList');
    const conversationLogEmpty = document.getElementById('conversationLogEmpty');
    const historyModal = document.getElementById('historyModal');
    const historyButton = document.getElementById('historyButton');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const clearConversationLogBtn = document.getElementById('clearConversationLogBtn');
    const fontSizePreview = document.getElementById('fontSizePreview');

    // 音声認識変数
    let recognition = null;
    let isRecording = false;
    let currentTranslationController = null;
    let translationInProgress = false;
    let activeTranslationId = 0;
    let selectedLanguage = ''; // 'ja' は日本語、'ne' はネパール語
    let lastTranslationTime = 0;
    let isRecognitionRunning = false; // 音声認識が実行中かどうか

    // 重複防止のための変数
    let processedResultIds = new Set(); // 処理済みの結果IDを追跡
    let recognitionSessionId = 0; // 認識セッション連番（自動再起動後にresultIdが衝突して発話が失われるのを防ぐ）
    let lastTranslatedText = ''; // 最後に翻訳した内容を記録
    let translationDebounceTimer = null;
    let conversationEntries = [];
    const MAX_CONVERSATION_ENTRIES = 20;

    // 音声認識の再起動管理（マイク問題対策）
    let recognitionRestartAttempts = 0; // 再起動試行回数
    const MAX_RESTART_ATTEMPTS = 5; // 最大再起動試行回数
    let recognitionHealthCheckInterval = null; // 状態監視タイマー
    const HEALTH_CHECK_INTERVAL = 5000; // 状態チェック間隔（5秒）
    let lastRecognitionResultTime = 0; // 最後に結果を受信した時刻
    const RECOGNITION_TIMEOUT_MS = 30000; // 音声認識タイムアウト（30秒）
    const PROCESSED_IDS_MAX_SIZE = 500; // processedResultIdsの最大サイズ（メモリリーク対策）

    // TTS用の最終翻訳結果を保存
    let lastTranslationResult = '';
    let copyStateTimeoutId = null;

    // 翻訳品質警告の表示履歴（無限ループ防止）
    const translationQualityWarningHistory = new Map(); // key: originalText, value: warningCount
    const MAX_QUALITY_WARNING_COUNT = 3; // 同じテキストに対する最大警告回数
    const MAX_WARNING_HISTORY_SIZE = 100; // 警告履歴の最大サイズ（メモリ最適化）

    // アプリ初期化フラグ（イベントリスナー重複登録防止）
    let appInitialized = false;

    // モーダル表示時のスクロール位置保存（iOS Safari対応）
    let savedScrollPosition = 0;

    /**
     * モーダル表示時のスクロールロック
     * iOS Safariでスクロール位置が失われる問題に対応
     */
    function lockBodyScroll() {
        // 既にロック済みの場合は何もしない（スクロール位置の上書き防止）
        if (document.body.classList.contains('modal-open')) {
            return;
        }
        savedScrollPosition = window.scrollY;
        document.body.classList.add('modal-open');
        document.body.style.top = `-${savedScrollPosition}px`;
    }

    /**
     * モーダル非表示時のスクロールアンロック
     * 保存したスクロール位置を復元
     */
    function unlockBodyScroll() {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, savedScrollPosition);
    }

    // 言語別デフォルトデバウンス設定（科学的アプローチに基づく）
    const DEFAULT_DEBOUNCE = {
        'ja': 346,  // 日本語最適値（文節区切り対応・31%改善）
        'ne': 300   // ネパール語暫定値（利用データ30件以降は端末ごとに自動最適化）
    };

    // 現在のデバウンス設定（パーソナライズ可能）
    let currentDebounce = {
        'ja': DEFAULT_DEBOUNCE['ja'],
        'ne': DEFAULT_DEBOUNCE['ne']
    };

    // パーソナライズドデバウンス最適化用データ
    // 「音声認識結果の更新間隔（発話中に認識結果が更新される周期）」を学習し、
    // その90パーセンタイル＋バッファをデバウンス値とする。
    // 更新間隔より十分長く、かつ必要以上に待たない値になるため、
    // 「更新が止まった＝発話の区切り」を端末・話者に合わせて判定できる。
    const DEBOUNCE_SAMPLE_SIZE = 50; // 言語ごとに保持する最大サンプル数（ローリングウィンドウ）
    const DEBOUNCE_SAMPLES_REQUIRED = 30; // 最適化に必要な言語ごとのサンプル数（日本語・ネパール語は独立して最適化可能）
    const DEBOUNCE_MIN_MS = 150; // デバウンス最小値（ms）短すぎると翻訳リクエストが乱発される
    const DEBOUNCE_MAX_MS = 800; // デバウンス最大値（ms）
    const DEBOUNCE_BUFFER_FACTOR = 1.2; // 90パーセンタイルへのバッファ係数
    const RESULT_INTERVAL_MIN_MS = 50; // 有効な更新間隔の最小値（ms）
    const RESULT_INTERVAL_MAX_MS = 1000; // 有効な更新間隔の最大値（ms）これを超える間隔は発話の区切り（ポーズ）とみなし学習から除外
    const TTS_SPEED_MIN = 0.8; // TTS速度最小値
    const TTS_SPEED_MAX = 1.2; // TTS速度最大値
    const TTS_SPEED_DEFAULT = 1.0; // TTS速度デフォルト値
    let debounceData = {
        'ja': [], // 日本語のポーズ間隔データ
        'ne': []  // ネパール語のポーズ間隔データ
    };
    let lastResultEventTime = 0; // 最後に認識結果が更新された時刻（デバウンス学習用）
    let debounceOptimized = { 'ja': false, 'ne': false }; // 言語別の最適化済みフラグ
    let debounceOptimizedAt = null; // 最適化実行日時
    let debounceDataSaveTimer = null; // データ保存用デバウンスタイマー
    const DEBOUNCE_DATA_SAVE_DELAY = 2000; // データ保存のデバウンス遅延（ms）

    // 動的デバウンス取得関数
    const getOptimalDebounce = (selectedLanguage) => {
        return currentDebounce[selectedLanguage] || DEFAULT_DEBOUNCE[selectedLanguage] || DEFAULT_DEBOUNCE['ja'];
    };

    // 日本語文字起こしの整形に使用する変数と関数
    let japaneseFormatter = {
        // 文章の最後に句点を追加する
        addPeriod: function(text) {
            if (text && !text.endsWith("。") && !text.endsWith(".") && !text.endsWith("？") && !text.endsWith("?") && !text.endsWith("！") && !text.endsWith("!")) {
                return text + "。";
            }
            return text;
        },
        
        // 適切な位置に読点を追加する
        addCommas: function(text) {
            // 文中の自然な区切りに読点を追加する簡易的なルール
            // 接続詞や特定のパターンの後に読点を追加
            const patterns = [
                { search: /([^、。])そして/g, replace: "$1、そして" },
                { search: /([^、。])しかし/g, replace: "$1、しかし" },
                { search: /([^、。])ですが/g, replace: "$1、ですが" },
                { search: /([^、。])また/g, replace: "$1、また" },
                { search: /([^、。])けれども/g, replace: "$1、けれども" },
                { search: /([^、。])だから/g, replace: "$1、だから" },
                { search: /([^、。])ので/g, replace: "$1、ので" },
                // 文が長い場合、適度に区切る
                { search: /(.{10,})から(.{10,})/g, replace: "$1から、$2" },
                { search: /(.{10,})ので(.{10,})/g, replace: "$1ので、$2" },
                { search: /(.{10,})けど(.{10,})/g, replace: "$1けど、$2" }
            ];
            
            let result = text;
            for (const pattern of patterns) {
                result = result.replace(pattern.search, pattern.replace);
            }
            
            return result;
        },
        
        // 文章全体を整形する
        format: function(text) {
            if (!text || text.trim().length === 0) return text;
            
            let formatted = text;
            // まず読点を追加
            formatted = this.addCommas(formatted);
            // 次に文末に句点を追加
            formatted = this.addPeriod(formatted);
            
            return formatted;
        }
    };
    
    // iOS Safari用: TTS初期化関数
    function initializeTTSForIOS() {
        window.TtsService.initializeForIOS();
        ttsInitialized = window.TtsService.isInitialized();
    }

    // 会話モード（自動読み上げ）の待機を解除
    function disarmAutoSpeak() {
        autoSpeakArmed = false;
        if (autoSpeakFallbackTimer) {
            clearTimeout(autoSpeakFallbackTimer);
            autoSpeakFallbackTimer = null;
        }
    }

    // 録音停止後の自動読み上げを待機状態にする
    // 停止直後に最終セグメントの翻訳が走ることがあるため、翻訳完了時または
    // 一定時間後のどちらか早い方で発火する
    function armAutoSpeak() {
        if (!isAutoTTSEnabled || !isTTSEnabled) {
            return;
        }
        autoSpeakArmed = true;
        if (autoSpeakFallbackTimer) {
            clearTimeout(autoSpeakFallbackTimer);
        }
        autoSpeakFallbackTimer = setTimeout(() => {
            autoSpeakFallbackTimer = null;
            if (translationInProgress) {
                return; // 進行中の翻訳完了時に発火する
            }
            triggerAutoSpeak();
        }, AUTO_SPEAK_FALLBACK_MS);
    }

    // 自動読み上げを実行（待機中のみ）
    function triggerAutoSpeak() {
        if (!autoSpeakArmed) {
            return;
        }
        const text = lastTranslationResult && lastTranslationResult.trim();
        disarmAutoSpeak();
        if (!text) {
            return;
        }
        console.log('会話モード: 録音停止後の自動読み上げを開始');
        if (!ttsInitialized && 'speechSynthesis' in window) {
            initializeTTSForIOS();
        }
        speakTranslation(text, selectedLanguage);
    }

    // TTS機能: 翻訳結果を音声で読み上げ
    function speakTranslation(text, language) {
        // 手動/自動いずれの再生でも、自動読み上げの待機は解除する
        disarmAutoSpeak();
        window.TtsService.speak({
            text: text,
            sourceLanguage: language,
            enabled: isTTSEnabled,
            speed: ttsSpeed,
            // 発話言語は入力言語の反転（ja入力→en発話）。日本語で発話する場合のみ
            // ユーザー指定の日本語音声を渡す
            preferredVoiceName: language === 'ja' ? '' : ttsVoiceJa,
            onBeforeSpeak: () => {
                // TTS実行＝1ターンの終了として音声入力を完全に停止する。
                // （TTS終了後の自動再開は行わない。次の入力は開始ボタンから。
                //   これによりTTS後の認識再開レースによる冒頭欠け・精度低下を防ぐ）
                if (isRecording) {
                    console.log('TTS再生のため音声入力を終了（ターン終了）');
                    finishRecordingSession({ stopTts: false });
                } else if (recognition && isRecognitionRunning) {
                    try {
                        recognition.stop();
                    } catch (e) {
                        console.error('音声認識の停止に失敗:', e?.message || e);
                    }
                }
            },
            onStart: () => {
                if (speakingIndicator) {
                    speakingIndicator.classList.add('visible');
                }
                updateTTSPlayingState(true);
            },
            onEnd: () => {
                if (speakingIndicator) {
                    speakingIndicator.classList.remove('visible');
                }
                // ターン終了方式: 音声入力は自動再開しない（開始ボタンで次のターンへ）
            },
            onError: () => {
                if (speakingIndicator) {
                    speakingIndicator.classList.remove('visible');
                }
            },
            onPlayingChange: (isPlaying) => {
                isTTSPlaying = isPlaying;
                updateTTSPlayingState(isPlaying);
            }
        });
        ttsInitialized = window.TtsService.isInitialized();
    }
    
    // TTS停止関数
    function stopTTS() {
        window.TtsService.stop({
            onPlayingChange: (isPlaying) => {
                isTTSPlaying = isPlaying;
                updateTTSPlayingState(isPlaying);
            }
        });
        if (speakingIndicator) {
            speakingIndicator.classList.remove('visible');
        }
    }

    // 音声認識の状態を監視する関数（新規追加）
    function startRecognitionHealthCheck() {
        // 既存のタイマーをクリア
        if (recognitionHealthCheckInterval) {
            clearInterval(recognitionHealthCheckInterval);
        }

        console.log('音声認識の状態監視を開始');

        recognitionHealthCheckInterval = setInterval(() => {
            if (!isRecording || !recognition) {
                return;
            }

            // 異常終了検出: 直近ログとともにハートビートを更新
            // （フリーズするとこの更新が止まり、次回起動時に異常終了と判定できる）
            if (window.ErrorReporter) {
                window.ErrorReporter.heartbeat();
            }

            const now = Date.now();
            const timeSinceLastResult = now - lastRecognitionResultTime;

            // 録音中だが長時間音声を検出していない場合は自動停止する
            // （マイク常時ONによるメモリ消費・発熱を防ぐ。再開は開始ボタンから）
            if (isRecording && timeSinceLastResult > RECOGNITION_TIMEOUT_MS && lastRecognitionResultTime > 0) {
                console.warn(`${RECOGNITION_TIMEOUT_MS / 1000}秒間音声を検出しなかったため、音声入力を自動停止します。`);
                stopRecording();
                if (errorMessage) {
                    errorMessage.textContent = `${RECOGNITION_TIMEOUT_MS / 1000}秒間音声を検出しなかったため、音声入力を自動停止しました。続ける場合は開始ボタンを押してください。`;
                }
            }
        }, HEALTH_CHECK_INTERVAL);
    }

    // 音声認識の状態監視を停止する関数（新規追加）
    function stopRecognitionHealthCheck() {
        if (recognitionHealthCheckInterval) {
            console.log('音声認識の状態監視を停止');
            clearInterval(recognitionHealthCheckInterval);
            recognitionHealthCheckInterval = null;
        }
    }

    // 音声認識を安全に再開するヘルパー関数（改善版）
    function safeRestartRecognition(delayMs = 100, source = '') {
        if (!isRecording || !recognition) {
            console.log(`再起動スキップ: isRecording=${isRecording}, recognition=${!!recognition}`);
            return;
        }

        // 最大再起動回数を超えた場合は警告
        if (recognitionRestartAttempts >= MAX_RESTART_ATTEMPTS) {
            console.warn(`音声認識の再起動が${MAX_RESTART_ATTEMPTS}回失敗しました。ユーザーに再起動を促します。`);
            errorMessage.textContent = 'マイクの接続が不安定です。停止ボタンを押して再度開始してください。';
            return;
        }

        setTimeout(() => {
            if (isRecording && !isRecognitionRunning && !isTTSPlaying) {
                try {
                    console.log(`音声認識を再開 (試行${recognitionRestartAttempts + 1}/${MAX_RESTART_ATTEMPTS})${source ? ' (' + source + ')' : ''}`);
                    recognition.start();
                    recognitionRestartAttempts++;
                } catch (e) {
                    console.error('音声認識の再開に失敗:', e?.message || e);

                    // 既に実行中の場合、フラグを正しく設定
                    if (e?.name === 'InvalidStateError' || e?.message?.includes('already started')) {
                        console.log('音声認識は既に実行中です。フラグを修正します。');
                        isRecognitionRunning = true;
                        recognitionRestartAttempts = 0; // カウンタをリセット
                    } else {
                        // その他のエラーの場合、リトライ
                        recognitionRestartAttempts++;
                        if (recognitionRestartAttempts < MAX_RESTART_ATTEMPTS) {
                            console.log(`${delayMs * 2}ms後に再試行します`);
                            safeRestartRecognition(delayMs * 2, source + '(retry)');
                        }
                    }
                }
            }
        }, delayMs);
    }

    // 翻訳ボックスの状態を更新（タップ可能表示）
    function updateTranslationBoxState(hasContent) {
        if (translationBox) {
            // TTS有効かつコンテンツがある場合のみタップ可能
            const shouldEnable = hasContent && isTTSEnabled;
            if (shouldEnable) {
                translationBox.classList.add('has-content');
            } else {
                translationBox.classList.remove('has-content');
            }
        }

        if (copyTranslationBtn) {
            copyTranslationBtn.disabled = !hasContent;
        }

        if (presentTranslationBtn) {
            presentTranslationBtn.disabled = !hasContent;
        }
    }

    // TTS再生中の視覚的フィードバックを更新
    function updateTTSPlayingState(isPlaying) {
        if (translationBox) {
            if (isPlaying) {
                translationBox.classList.add('tts-playing');
            } else {
                translationBox.classList.remove('tts-playing');
            }
        }
    }

    // 録音状態の視覚的フィードバックを更新
    function updateRecordingState(isRecordingNow) {
        if (originalBox) {
            if (isRecordingNow) {
                originalBox.classList.add('recording');
            } else {
                originalBox.classList.remove('recording');
            }
        }
    }

    // 翻訳状態の視覚的フィードバックを更新
    function updateTranslatingState(isTranslating) {
        if (translationBox) {
            if (isTranslating) {
                translationBox.classList.add('translating');
                translationBox.classList.remove('translation-complete');
            } else {
                translationBox.classList.remove('translating');
            }
        }
    }

    // 翻訳完了状態の視覚的フィードバックを更新
    function updateTranslationCompleteState(isComplete) {
        if (translationBox) {
            if (isComplete) {
                translationBox.classList.remove('translating');
                translationBox.classList.add('translation-complete');
            } else {
                translationBox.classList.remove('translation-complete');
            }
        }
    }

    function formatConversationTimestamp(timestamp) {
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
            return '';
        }
        try {
            return new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function renderConversationLog() {
        if (!conversationLog || !conversationLogList) {
            return;
        }

        if (conversationLogEmpty) {
            conversationLogEmpty.hidden = conversationEntries.length !== 0;
        }
        conversationLogList.replaceChildren();

        conversationEntries.forEach((entry) => {
            const item = document.createElement('div');
            item.className = 'conversation-log-item';

            const itemHeader = document.createElement('div');
            itemHeader.className = 'conversation-log-item-header';

            const meta = document.createElement('div');
            meta.className = 'conversation-log-meta';

            const direction = document.createElement('span');
            direction.className = 'conversation-log-direction';
            direction.textContent = entry.sourceLanguage === 'ja' ? '日 → ネ' : 'ネ → 日';
            meta.appendChild(direction);

            const timeLabel = formatConversationTimestamp(entry.timestamp);
            if (timeLabel) {
                const time = document.createElement('span');
                time.className = 'conversation-log-time';
                time.textContent = timeLabel;
                meta.appendChild(time);
            }

            const actions = document.createElement('div');
            actions.className = 'conversation-log-actions';

            const copyButton = document.createElement('button');
            copyButton.className = 'conversation-log-copy';
            copyButton.type = 'button';
            copyButton.textContent = 'コピー';
            copyButton.setAttribute('aria-label', 'この翻訳をコピー');
            copyButton.addEventListener('click', async () => {
                if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
                    return;
                }
                try {
                    await navigator.clipboard.writeText(entry.translation);
                    copyButton.textContent = 'コピー済';
                    setTimeout(() => { copyButton.textContent = 'コピー'; }, 1200);
                } catch (error) {
                    console.error('会話履歴のコピーに失敗:', error);
                }
            });

            const replayButton = document.createElement('button');
            replayButton.className = 'conversation-log-replay';
            replayButton.type = 'button';
            replayButton.textContent = '再生';
            replayButton.setAttribute('aria-label', 'この翻訳を再生');
            replayButton.addEventListener('click', () => {
                playConversationEntry(entry);
            });

            actions.append(copyButton, replayButton);

            const originalRow = document.createElement('div');
            originalRow.className = 'conversation-log-row';

            const originalLabel = document.createElement('div');
            originalLabel.className = 'conversation-log-label';
            originalLabel.textContent = '原文';

            const originalTextElement = document.createElement('div');
            originalTextElement.className = 'conversation-log-text';
            originalTextElement.textContent = entry.original;

            const translationRow = document.createElement('div');
            translationRow.className = 'conversation-log-row';

            const translationLabel = document.createElement('div');
            translationLabel.className = 'conversation-log-label';
            translationLabel.textContent = '翻訳';

            const translationTextElement = document.createElement('div');
            translationTextElement.className = 'conversation-log-text';
            translationTextElement.textContent = entry.translation;

            itemHeader.append(meta, actions);
            originalRow.append(originalLabel, originalTextElement);
            translationRow.append(translationLabel, translationTextElement);
            item.append(itemHeader, originalRow, translationRow);
            conversationLogList.appendChild(item);
        });
    }

    function addConversationLogEntry(original, translation, sourceLanguage) {
        const trimmedOriginal = original && original.trim();
        const trimmedTranslation = translation && translation.trim();
        if (!trimmedOriginal || !trimmedTranslation || !isSupportedConversationLanguage(sourceLanguage)) {
            return;
        }

        conversationEntries = [
            { original: trimmedOriginal, translation: trimmedTranslation, sourceLanguage, timestamp: Date.now() },
            ...conversationEntries
        ].slice(0, MAX_CONVERSATION_ENTRIES);
        saveConversationLog();
        renderConversationLog();
    }

    function isSupportedConversationLanguage(language) {
        return language === 'ja' || language === 'ne';
    }

    function saveConversationLog() {
        try {
            AppSettingsStorage.setConversationLog(conversationEntries);
        } catch (e) {
            console.error('会話履歴の保存に失敗:', e);
        }
    }

    function loadConversationLog() {
        try {
            conversationEntries = AppSettingsStorage.getConversationLog().slice(0, MAX_CONVERSATION_ENTRIES);
        } catch (e) {
            console.error('会話履歴の読み込みに失敗:', e);
            conversationEntries = [];
        }
        renderConversationLog();
    }

    function clearConversationLog() {
        conversationEntries = [];
        AppSettingsStorage.clearConversationLog();
        renderConversationLog();
    }

    function playConversationEntry(entry) {
        if (!entry || !entry.translation || !entry.translation.trim() || !isSupportedConversationLanguage(entry.sourceLanguage)) {
            return;
        }

        if (!ttsInitialized && 'speechSynthesis' in window) {
            initializeTTSForIOS();
        }

        if (isTTSPlaying) {
            stopTTS();
        }

        speakTranslation(entry.translation, entry.sourceLanguage);
    }

    // 手動TTS再生関数（再生ボタン用）
    function playTranslation() {
        // iOS Safari対策: ユーザーのタップ時にTTSを初期化
        if (!ttsInitialized && 'speechSynthesis' in window) {
            initializeTTSForIOS();
        }

        if (!lastTranslationResult || !lastTranslationResult.trim()) {
            console.log('再生する翻訳結果がありません');
            return;
        }

        // TTS再生中なら停止する（音声入力の自動再開は行わない＝ターン終了方式）
        if (isTTSPlaying) {
            stopTTS();
            return;
        }

        console.log('手動TTS再生を開始:', lastTranslationResult.substring(0, 50) + '...');
        speakTranslation(lastTranslationResult, selectedLanguage);
    }

    async function copyTranslation(event) {
        if (event) {
            event.stopPropagation();
        }

        const textToCopy = lastTranslationResult.trim();
        if (!textToCopy || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            errorMessage.textContent = 'このブラウザではコピー機能を利用できません';
            setTimeout(() => { errorMessage.textContent = ''; }, 3000);
            return;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            if (copyTranslationBtn) {
                const label = copyTranslationBtn.querySelector('span');
                if (!label) {
                    console.error('コピーボタンのラベル要素が見つかりません');
                    return;
                }

                if (copyStateTimeoutId) {
                    clearTimeout(copyStateTimeoutId);
                }

                copyTranslationBtn.classList.add('copied');
                label.textContent = 'コピー済み';
                copyStateTimeoutId = setTimeout(() => {
                    copyTranslationBtn.classList.remove('copied');
                    label.textContent = 'コピー';
                    copyStateTimeoutId = null;
                }, 1200);
            }
        } catch (error) {
            console.error('翻訳結果のコピーに失敗:', error);
            errorMessage.textContent = 'クリップボードへのコピーに失敗しました';
            setTimeout(() => { errorMessage.textContent = ''; }, 3000);
        }
    }

    // 大型表示（相手に見せる）モードを開く
    function openPresentMode(event) {
        if (event) {
            event.stopPropagation();
        }

        const translation = (lastTranslationResult || '').trim();
        if (!translation || !presentModal) {
            return;
        }

        if (presentText) {
            presentText.textContent = translation;
        }
        if (presentOriginal) {
            presentOriginal.textContent = (originalText.textContent || '').trim();
        }

        presentModal.style.display = 'flex';
    }

    // 大型表示モードを閉じる
    function closePresentMode() {
        if (presentModal) {
            presentModal.style.display = 'none';
        }
    }

    // APIキー読み込み
    function loadApiKeys() {
        OPENAI_API_KEY = AppSettingsStorage.getOpenaiKey();

        // TTS設定を読み込み
        isTTSEnabled = AppSettingsStorage.getTtsEnabled(true);

        // 会話モード（停止後の自動読み上げ）設定を読み込み
        isAutoTTSEnabled = AppSettingsStorage.getAutoTtsEnabled(false);

        // TTS速度を読み込み（検証付き）
        ttsSpeed = AppSettingsStorage.getTtsSpeed(TTS_SPEED_DEFAULT, TTS_SPEED_MIN, TTS_SPEED_MAX);
        updateSpeedButtonsUI(ttsSpeed);

        // デバウンスデータを読み込み
        loadDebounceData();

        console.log('TTS設定読み込み:', {
            isTTSEnabled: isTTSEnabled,
            ttsSpeed: ttsSpeed,
            storedValue: AppSettingsStorage.getTtsEnabled(true)
        });

        if (!OPENAI_API_KEY) {
            openaiKeyInput.value = DEFAULT_OPENAI_API_KEY;
            const firstRunIntro = document.getElementById('firstRunIntro');
            if (firstRunIntro) {
                firstRunIntro.hidden = false; // 初回セットアップガイド（キー保存済みなら出さない）
            }
            apiModal.style.display = 'flex';
            lockBodyScroll();
        } else {
            initializeApp();
        }
    }

    // デバウンスデータの読み込み
    function loadDebounceData() {
        try {
            // デバウンスデータ
            const parsed = AppSettingsStorage.getDebounceData();
            if (parsed) {
                // 型と構造の検証
                if (parsed && typeof parsed === 'object') {
                    // 各言語のデータを検証してフィルタリング
                    ['ja', 'ne'].forEach(lang => {
                        if (Array.isArray(parsed[lang])) {
                            // 有効な数値のみ保持（範囲チェック付き）
                            debounceData[lang] = parsed[lang].filter(
                                val => typeof val === 'number' &&
                                       !isNaN(val) &&
                                       val >= RESULT_INTERVAL_MIN_MS &&
                                       val <= RESULT_INTERVAL_MAX_MS
                            );
                        }
                    });
                }
            }

            // 最適化されたデバウンス値（言語ごとに独立して保存・適用）
            const optimized = AppSettingsStorage.getOptimizedDebounce();
            if (optimized && typeof optimized === 'object') {
                ['ja', 'ne'].forEach(lang => {
                    const val = optimized[lang];
                    if (typeof val === 'number' && !isNaN(val) && val >= DEBOUNCE_MIN_MS && val <= DEBOUNCE_MAX_MS) {
                        currentDebounce[lang] = val;
                        debounceOptimized[lang] = true;
                    } else {
                        currentDebounce[lang] = DEFAULT_DEBOUNCE[lang];
                        debounceOptimized[lang] = false;
                    }
                });
            }

            // 最適化日時を読み込み
            const storedOptimizedAt = AppSettingsStorage.getDebounceOptimizedAt();
            if (storedOptimizedAt) {
                debounceOptimizedAt = storedOptimizedAt;
            }

            // UI更新
            updateDebounceUI();
        } catch (e) {
            console.error('デバウンスデータ読み込みエラー:', e);
            // エラー時はデフォルト値にリセット
            debounceData = { 'ja': [], 'ne': [] };
            currentDebounce['ja'] = DEFAULT_DEBOUNCE['ja'];
            currentDebounce['ne'] = DEFAULT_DEBOUNCE['ne'];
            debounceOptimized = { 'ja': false, 'ne': false };
        }
    }

    // デバウンスデータの保存
    function saveDebounceData() {
        try {
            AppSettingsStorage.setDebounceData(debounceData);
        } catch (e) {
            console.error('デバウンスデータ保存エラー:', e);
        }
    }

    // デバウンスUI更新
    function updateDebounceUI() {
        const jaValueEl = document.getElementById('debounceJaValue');
        const neValueEl = document.getElementById('debounceNeValue');
        const jaTypeEl = document.getElementById('debounceJaType');
        const neTypeEl = document.getElementById('debounceNeType');
        const progressFill = document.getElementById('debounceProgressFill');
        const progressText = document.getElementById('debounceProgressText');
        const optimizeBtn = document.getElementById('optimizeDebounceBtn');
        const optimizedAtEl = document.getElementById('debounceOptimizedAt');
        const remainingInfoEl = document.getElementById('debounceRemainingInfo');

        if (jaValueEl) jaValueEl.textContent = `${currentDebounce['ja']}ms`;
        if (neValueEl) neValueEl.textContent = `${currentDebounce['ne']}ms`;

        if (jaTypeEl) {
            jaTypeEl.textContent = debounceOptimized['ja'] ? '(最適化済み)' : '(デフォルト)';
            jaTypeEl.className = debounceOptimized['ja'] ? 'debounce-type optimized' : 'debounce-type';
        }
        if (neTypeEl) {
            neTypeEl.textContent = debounceOptimized['ne'] ? '(最適化済み)' : '(デフォルト)';
            neTypeEl.className = debounceOptimized['ne'] ? 'debounce-type optimized' : 'debounce-type';
        }

        // 最適化日時の表示
        if (optimizedAtEl) {
            if (debounceOptimizedAt) {
                optimizedAtEl.textContent = `最終最適化: ${debounceOptimizedAt}`;
                optimizedAtEl.style.display = 'block';
            } else {
                optimizedAtEl.style.display = 'none';
            }
        }

        // プログレスバー更新（言語別・日本語・ネパール語は独立して最適化可能）
        const jaSamples = debounceData['ja'].length;
        const neSamples = debounceData['ne'].length;
        const jaReady = jaSamples >= DEBOUNCE_SAMPLES_REQUIRED;
        const neReady = neSamples >= DEBOUNCE_SAMPLES_REQUIRED;
        const progress = Math.min((Math.max(jaSamples, neSamples) / DEBOUNCE_SAMPLES_REQUIRED) * 100, 100);
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) {
            progressText.textContent = `データ収集: 日本語 ${Math.min(jaSamples, DEBOUNCE_SAMPLES_REQUIRED)}/${DEBOUNCE_SAMPLES_REQUIRED}件 ・ ネパール語 ${Math.min(neSamples, DEBOUNCE_SAMPLES_REQUIRED)}/${DEBOUNCE_SAMPLES_REQUIRED}件`;
        }

        // 最適化可能状況の表示（片方の言語だけでも最適化できる）
        if (remainingInfoEl) {
            const readyLangs = [];
            if (jaReady) readyLangs.push('日本語');
            if (neReady) readyLangs.push('ネパール語');

            if (readyLangs.length > 0) {
                remainingInfoEl.textContent = `✓ ${readyLangs.join('・')}を最適化できます（言語ごとに独立して適用されます）`;
                remainingInfoEl.style.display = 'block';
                remainingInfoEl.className = 'remaining-info ready';
            } else {
                const jaRemaining = DEBOUNCE_SAMPLES_REQUIRED - jaSamples;
                const neRemaining = DEBOUNCE_SAMPLES_REQUIRED - neSamples;
                remainingInfoEl.textContent = `必要残り: 日本語${jaRemaining}件 / ネパール語${neRemaining}件（どちらか一方だけでも最適化できます）`;
                remainingInfoEl.style.display = 'block';
                remainingInfoEl.className = 'remaining-info';
            }
        }

        // 最適化ボタンの有効/無効（いずれかの言語が規定数に達していれば有効）
        if (optimizeBtn) {
            const canOptimize = jaReady || neReady;
            optimizeBtn.disabled = !canOptimize;
            optimizeBtn.className = canOptimize ? 'debounce-btn optimize ready' : 'debounce-btn optimize disabled';
        }
    }

    // TTS速度ボタンUI更新
    function updateSpeedButtonsUI(speed) {
        const speedBtns = document.querySelectorAll('.speed-btn');
        speedBtns.forEach(btn => {
            btn.classList.remove('active');
            if (parseFloat(btn.dataset.speed) === speed) {
                btn.classList.add('active');
            }
        });
    }

    // デバウンス最適化計算
    // 認識結果の更新間隔の90パーセンタイル × バッファを最適値とする。
    // 通常の更新間隔の9割をカバーする待ち時間より長く待っても更新が来なければ
    // 「発話が区切れた」と判断できる、という考え方。
    function calculateOptimalDebounce(language) {
        const data = debounceData[language];
        if (data.length < DEBOUNCE_SAMPLES_REQUIRED) {
            return DEFAULT_DEBOUNCE[language]; // データ不足時はデフォルト
        }

        // ソートして90パーセンタイルを計算（外れ値に強い）
        const sorted = [...data].sort((a, b) => a - b);
        const percentileIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
        const percentile90 = sorted[percentileIndex];

        // 90パーセンタイルにバッファを追加し、安全範囲内に収める
        const optimal = Math.round(percentile90 * DEBOUNCE_BUFFER_FACTOR);

        return Math.max(DEBOUNCE_MIN_MS, Math.min(DEBOUNCE_MAX_MS, optimal));
    }

    // 規定サンプル数に達した言語は、新しいデータが入るたびに最適値を自動で再計算・適用する。
    // ローリングウィンドウ上の90パーセンタイルに常に追従するため、手動の「最適化を実行」を
    // 待たなくてもデバウンスがパーソナライズされる（ボタンは即時実行手段として残置）。
    function autoApplyOptimalDebounce(language) {
        if (language !== 'ja' && language !== 'ne') return;
        if (debounceData[language].length < DEBOUNCE_SAMPLES_REQUIRED) return;

        const optimal = calculateOptimalDebounce(language);
        debounceOptimized[language] = true;
        if (optimal === currentDebounce[language]) return;

        currentDebounce[language] = optimal;

        const storedValues = {};
        ['ja', 'ne'].forEach((lang) => {
            if (debounceOptimized[lang]) {
                storedValues[lang] = currentDebounce[lang];
            }
        });
        AppSettingsStorage.setOptimizedDebounce(storedValues);
        debounceOptimizedAt = new Date().toLocaleString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        AppSettingsStorage.setDebounceOptimizedAt(debounceOptimizedAt);
        console.log('デバウンス自動最適化:', language, '=', optimal + 'ms');
    }

    // 認識結果の更新間隔を記録（テキストが変化した結果イベントごとに呼ばれる）
    function recordResultInterval(language) {
        const now = Date.now();
        if (lastResultEventTime > 0 && (language === 'ja' || language === 'ne')) {
            const interval = now - lastResultEventTime;
            // 有効な範囲のデータのみ記録
            // （極端に短い間隔と、発話の区切り＝ポーズによる長い間隔を除外）
            if (interval >= RESULT_INTERVAL_MIN_MS && interval <= RESULT_INTERVAL_MAX_MS) {
                debounceData[language].push(interval);
                // ローリングウィンドウ: 最新サンプルのみ保持
                if (debounceData[language].length > DEBOUNCE_SAMPLE_SIZE) {
                    debounceData[language].shift();
                }
                // 保存とUI更新をデバウンス（連続呼び出し時の負荷軽減）
                if (debounceDataSaveTimer) {
                    clearTimeout(debounceDataSaveTimer);
                }
                debounceDataSaveTimer = setTimeout(() => {
                    autoApplyOptimalDebounce(language);
                    saveDebounceData();
                    updateDebounceUI();
                    debounceDataSaveTimer = null;
                }, DEBOUNCE_DATA_SAVE_DELAY);
            }
        }
        lastResultEventTime = now;
    }
    
    // APIキー保存
    saveApiKeysBtn.addEventListener('click', () => {
        const openaiKey = openaiKeyInput.value.trim();
        
        if (!openaiKey) {
            alert('OpenAI APIキーを入力してください。');
            return;
        }
        
        // APIキーを保存する前に不要なスペースを確実に削除
        AppSettingsStorage.setOpenaiKey(openaiKey);
        
        OPENAI_API_KEY = openaiKey.trim();
        
        // TTS設定も保存
        if (ttsToggle) {
            isTTSEnabled = ttsToggle.checked;
            AppSettingsStorage.setTtsEnabled(isTTSEnabled);
        }
        if (autoTtsToggle) {
            isAutoTTSEnabled = autoTtsToggle.checked;
            AppSettingsStorage.setAutoTtsEnabled(isAutoTTSEnabled);
        }
        
        apiModal.style.display = 'none';
        unlockBodyScroll();
        initializeApp();
    });

    // 設定モーダルを開く
    settingsButton.addEventListener('click', () => {
        openaiKeyInput.value = OPENAI_API_KEY;
        if (ttsToggle) {
            ttsToggle.checked = isTTSEnabled;
        }
        if (autoTtsToggle) {
            autoTtsToggle.checked = isAutoTTSEnabled;
        }
        apiModal.style.display = 'flex';
        lockBodyScroll();
    });

    // APIキーリセット
    resetKeysBtn.addEventListener('click', () => {
        if (confirm('APIキーをリセットしますか？')) {
            AppSettingsStorage.clearApiSettings();
            unlockBodyScroll();
            location.reload();
        }
    });

    // モーダル外クリックで閉じる
    apiModal.addEventListener('click', (e) => {
        if (e.target === apiModal) {
            apiModal.style.display = 'none';
            unlockBodyScroll();
        }
    });

    // 会話履歴モーダル（履歴をメイン画面から分離し、入力・翻訳枠の縮小を防ぐ）
    if (historyButton && historyModal) {
        historyButton.addEventListener('click', () => {
            renderConversationLog();
            historyModal.style.display = 'flex';
            lockBodyScroll();
        });
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) {
                historyModal.style.display = 'none';
                unlockBodyScroll();
            }
        });
    }
    if (closeHistoryBtn && historyModal) {
        closeHistoryBtn.addEventListener('click', () => {
            historyModal.style.display = 'none';
            unlockBodyScroll();
        });
    }
    
    // TTS設定の変更を監視
    if (ttsToggle) {
        ttsToggle.addEventListener('change', () => {
            isTTSEnabled = ttsToggle.checked;
            AppSettingsStorage.setTtsEnabled(isTTSEnabled);
            console.log('TTS設定変更:', isTTSEnabled ? '有効' : '無効');
            // TTS設定変更時に再生ボタンの状態を更新
            updateTranslationBoxState(!!lastTranslationResult);
        });
    }

    // 会話モード（停止後の自動読み上げ）設定の変更を監視
    if (autoTtsToggle) {
        autoTtsToggle.addEventListener('change', () => {
            isAutoTTSEnabled = autoTtsToggle.checked;
            AppSettingsStorage.setAutoTtsEnabled(isAutoTTSEnabled);
            console.log('自動読み上げ設定変更:', isAutoTTSEnabled ? '有効' : '無効');
        });
    }

    // TTS速度ボタンの設定
    const speedBtns = document.querySelectorAll('.speed-btn');
    speedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const speed = parseFloat(btn.dataset.speed);
            // data-speed属性の検証（NaNまたは範囲外の場合はデフォルト値を使用）
            if (isNaN(speed) || speed < TTS_SPEED_MIN || speed > TTS_SPEED_MAX) {
                console.warn('無効なTTS速度値:', btn.dataset.speed);
                return;
            }
            ttsSpeed = speed;
            AppSettingsStorage.setTtsSpeed(speed);
            updateSpeedButtonsUI(speed);
            console.log('TTS速度変更:', speed);
        });
    });

    // 日本語の読み上げ音声の選択
    const ttsVoiceJaSelect = document.getElementById('ttsVoiceJaSelect');
    let ttsVoiceJa = AppSettingsStorage.getTtsVoiceJa();

    function populateTtsVoiceJaSelect() {
        if (!ttsVoiceJaSelect || !window.TtsService) return;
        if (window.TtsService.voices.length === 0) {
            window.TtsService.loadVoices();
        }
        const jaVoices = window.TtsService.voices.filter((voice) => voice.lang.startsWith('ja'));

        ttsVoiceJaSelect.replaceChildren();
        const autoOption = document.createElement('option');
        autoOption.value = '';
        autoOption.textContent = '自動（高品質を優先）';
        ttsVoiceJaSelect.appendChild(autoOption);

        jaVoices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = voice.name;
            ttsVoiceJaSelect.appendChild(option);
        });
        // 保存済みの音声が端末に存在しない場合は「自動」に表示を戻す
        ttsVoiceJaSelect.value = jaVoices.some((voice) => voice.name === ttsVoiceJa) ? ttsVoiceJa : '';
    }

    if (ttsVoiceJaSelect) {
        populateTtsVoiceJaSelect();
        // iOSでは音声リストの読み込みが遅れることがあるため、開いた時に再取得する
        ttsVoiceJaSelect.addEventListener('focus', populateTtsVoiceJaSelect);
        ttsVoiceJaSelect.addEventListener('change', () => {
            ttsVoiceJa = ttsVoiceJaSelect.value;
            AppSettingsStorage.setTtsVoiceJa(ttsVoiceJa);
            console.log('日本語読み上げ音声を変更:', ttsVoiceJa || '自動');
        });
    }

    // デバウンス最適化ボタン
    const optimizeDebounceBtn = document.getElementById('optimizeDebounceBtn');
    if (optimizeDebounceBtn) {
        optimizeDebounceBtn.addEventListener('click', () => {
            // 規定サンプル数に達した言語のみ最適化（日本語・ネパール語は独立。片方だけでも可）
            const results = [];
            ['ja', 'ne'].forEach((lang) => {
                if (debounceData[lang].length >= DEBOUNCE_SAMPLES_REQUIRED) {
                    currentDebounce[lang] = calculateOptimalDebounce(lang);
                    debounceOptimized[lang] = true;
                    results.push(`${lang === 'ja' ? '日本語' : 'ネパール語'}: ${currentDebounce[lang]}ms`);
                }
            });

            if (results.length === 0) {
                return;
            }

            // 最適化日時を記録
            const now = new Date();
            debounceOptimizedAt = now.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 保存（最適化済みの言語の値のみ保存し、未最適化の言語はデフォルトを維持）
            const storedValues = {};
            ['ja', 'ne'].forEach((lang) => {
                if (debounceOptimized[lang]) {
                    storedValues[lang] = currentDebounce[lang];
                }
            });
            AppSettingsStorage.setOptimizedDebounce(storedValues);
            AppSettingsStorage.setDebounceOptimizedAt(debounceOptimizedAt);

            // UI更新
            updateDebounceUI();

            console.log('デバウンス最適化完了:', {
                optimized: storedValues,
                optimizedAt: debounceOptimizedAt
            });

            alert(`デバウンス最適化が完了しました！\n\n${results.join('\n')}\n\n最適化日時: ${debounceOptimizedAt}`);
        });
    }

    // デバウンスリセットボタン（設定のみリセット、データは保持）
    const resetDebounceBtn = document.getElementById('resetDebounceBtn');
    if (resetDebounceBtn) {
        resetDebounceBtn.addEventListener('click', () => {
            if (confirm('デバウンス設定をデフォルトに戻しますか？\n収集したデータは保持されます。')) {
                currentDebounce['ja'] = DEFAULT_DEBOUNCE['ja'];
                currentDebounce['ne'] = DEFAULT_DEBOUNCE['ne'];
                debounceOptimized = { 'ja': false, 'ne': false };
                debounceOptimizedAt = null;

                AppSettingsStorage.clearOptimizedDebounce();

                updateDebounceUI();

                console.log('デバウンス設定をデフォルトにリセット');
            }
        });
    }

    // デバウンス完全リセットボタン（設定とデータの両方をリセット）
    const fullResetDebounceBtn = document.getElementById('fullResetDebounceBtn');
    if (fullResetDebounceBtn) {
        fullResetDebounceBtn.addEventListener('click', () => {
            if (confirm('デバウンス設定と収集データを完全にリセットしますか？\n\n⚠️ この操作は取り消せません。\n収集した全てのデータが削除されます。')) {
                // 設定をリセット
                currentDebounce['ja'] = DEFAULT_DEBOUNCE['ja'];
                currentDebounce['ne'] = DEFAULT_DEBOUNCE['ne'];
                debounceOptimized = { 'ja': false, 'ne': false };
                debounceOptimizedAt = null;

                // データをリセット
                debounceData = { 'ja': [], 'ne': [] };
                lastResultEventTime = 0;

                // ストレージをクリア
                AppSettingsStorage.clearOptimizedDebounce();
                AppSettingsStorage.clearDebounceData();

                updateDebounceUI();

                console.log('デバウンス設定とデータを完全リセット');
                alert('デバウンス設定とデータを完全にリセットしました。');
            }
        });
    }

    // フォントサイズ変更ボタンの設定（モーダル内でAPIキー入力前から使えるように早期バインド）
    if (fontSizeSmallBtn) fontSizeSmallBtn.addEventListener('click', () => changeFontSize('small'));
    if (fontSizeMediumBtn) fontSizeMediumBtn.addEventListener('click', () => changeFontSize('medium'));
    if (fontSizeLargeBtn) fontSizeLargeBtn.addEventListener('click', () => changeFontSize('large'));
    if (fontSizeXLargeBtn) fontSizeXLargeBtn.addEventListener('click', () => changeFontSize('xlarge'));
    if (fontSizeToggleBtn) fontSizeToggleBtn.addEventListener('click', cycleFontSize);

    // 保存されたフォントサイズ設定を早期適用（APIキー入力前から反映）
    const initialFontSize = AppSettingsStorage.getFontSize('medium');
    changeFontSize(initialFontSize);

    // ========================================
    // テーマ（ライト/ダーク/自動）切り替え
    // ========================================
    const themeButtons = document.querySelectorAll('.theme-btn');

    function applyTheme(theme) {
        // 'auto' は属性を外してシステム設定（prefers-color-scheme）に追従
        if (theme === 'light' || theme === 'dark') {
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        themeButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    themeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            AppSettingsStorage.setTheme(theme);
            applyTheme(theme);
        });
    });

    // 保存されたテーマを早期適用（index.htmlのインラインスクリプトと同じ状態に同期）
    applyTheme(AppSettingsStorage.getTheme('auto'));

    // ========================================
    // 翻訳モード（会話領域）とユーザー辞書
    // ========================================
    const domainButtons = document.querySelectorAll('.domain-btn');
    const domainBadge = document.getElementById('domainBadge');
    const dictReadingInput = document.getElementById('dictReading');
    const dictSurfaceInput = document.getElementById('dictSurface');
    const dictNepaliInput = document.getElementById('dictNepali');
    const dictAliasesInput = document.getElementById('dictAliases');
    const dictAddBtn = document.getElementById('dictAddBtn');
    const dictListElement = document.getElementById('dictList');

    const DOMAIN_LABELS = { medical: '医療・介護・福祉', daily: '日常会話' };
    let translationDomain = AppSettingsStorage.getTranslationDomain('medical');
    let userDictionary = AppSettingsStorage.getUserDictionary();

    // 録音セッション中に使う辞書のスナップショット（録音開始時に確定）。
    // 録音中に辞書を編集すると、置換結果が変わって処理済み判定（resultId）が
    // 崩れ、確定結果の重複処理が起こり得るため、セッション内では固定する。
    let recordingDictionarySnapshot = null;

    // 数字境界を考慮した置換: エイリアスが数字で始まる/終わる場合、
    // 隣接文字が数字なら別の数値の一部（例:「960円」の中の「60円」）と
    // みなして置換しない
    const DIGIT_PATTERN = /[0-9０-９]/;
    function replaceAliasWithBoundary(text, alias, surface) {
        let result = '';
        let index = 0;
        while (index <= text.length) {
            const found = text.indexOf(alias, index);
            if (found === -1) {
                result += text.slice(index);
                break;
            }
            const prevChar = found > 0 ? text[found - 1] : '';
            const nextChar = text[found + alias.length] || '';
            const headBlocked = DIGIT_PATTERN.test(alias[0]) && DIGIT_PATTERN.test(prevChar);
            const tailBlocked = DIGIT_PATTERN.test(alias[alias.length - 1]) && DIGIT_PATTERN.test(nextChar);
            if (headBlocked || tailBlocked) {
                result += text.slice(index, found + alias.length);
            } else {
                result += text.slice(index, found) + surface;
            }
            index = found + alias.length;
        }
        return result;
    }

    // 辞書の誤認識パターン置換: 音声認識が固有名詞を「読みが同じ別語」に
    // 書き起こした場合（例:「禄寿園」→「60円」）、LLMには「60円=禄寿園」という
    // 知識がなくプロンプトだけでは復元できない。認識テキストの段階で
    // 正しい表記へ決定的に文字列置換して保証する。
    function applyDictionaryAliases(text) {
        if (!text) return text;
        const dictionary = recordingDictionarySnapshot || userDictionary;
        let result = text;
        dictionary.forEach((entry) => {
            if (!Array.isArray(entry.aliases)) return;
            entry.aliases.forEach((alias) => {
                // 包含関係にあるエイリアスは誤爆する（例: surface「さくら苑」に
                // alias「さくら」→「さくら苑苑」）ため適用しない
                if (!alias || alias === entry.surface ||
                    entry.surface.includes(alias) || alias.includes(entry.surface)) {
                    return;
                }
                if (result.includes(alias)) {
                    result = replaceAliasWithBoundary(result, alias, entry.surface);
                }
            });
        });
        return result;
    }

    function applyTranslationDomain(domain) {
        translationDomain = domain === 'daily' ? 'daily' : 'medical';
        domainButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.domain === translationDomain);
        });
        if (domainBadge) {
            domainBadge.textContent = DOMAIN_LABELS[translationDomain];
            domainBadge.hidden = false;
        }
    }

    domainButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            AppSettingsStorage.setTranslationDomain(btn.dataset.domain);
            applyTranslationDomain(btn.dataset.domain);
        });
    });

    applyTranslationDomain(translationDomain);

    // ========================================
    // 翻訳方式（順送り=石畳方式・既定 / 標準=全文再翻訳・フォールバック）
    // ========================================
    const strategyButtons = document.querySelectorAll('#strategyControls .strategy-btn');
    let translationStrategy = AppSettingsStorage.getTranslationStrategy('monotonic');
    let activeTranslationStrategy = 'retranslation'; // 録音セッションに適用中の方式（録音開始時に確定）

    function applyTranslationStrategy(strategy) {
        translationStrategy = strategy === 'monotonic' ? 'monotonic' : 'retranslation';
        strategyButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.strategy === translationStrategy);
        });
    }

    strategyButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            AppSettingsStorage.setTranslationStrategy(btn.dataset.strategy);
            applyTranslationStrategy(btn.dataset.strategy);
        });
    });

    applyTranslationStrategy(translationStrategy);

    function renderUserDictionary() {
        if (!dictListElement) return;
        dictListElement.replaceChildren();

        if (userDictionary.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'user-dict-empty';
            empty.textContent = '登録された語はありません';
            dictListElement.appendChild(empty);
            return;
        }

        userDictionary.forEach((entry, index) => {
            const row = document.createElement('div');
            row.className = 'user-dict-row';

            const text = document.createElement('span');
            text.className = 'user-dict-text';
            const reading = entry.reading ? entry.reading + '｜' : '';
            const aliases = Array.isArray(entry.aliases) && entry.aliases.length > 0
                ? '（誤認識: ' + entry.aliases.join('、') + '）'
                : '';
            text.textContent = reading + entry.surface + ' → ' + (entry.nepali || '（ローマ字）') + aliases;

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'user-dict-remove';
            removeButton.textContent = '削除';
            removeButton.setAttribute('aria-label', entry.surface + ' を辞書から削除');
            removeButton.addEventListener('click', () => {
                userDictionary.splice(index, 1);
                AppSettingsStorage.setUserDictionary(userDictionary);
                renderUserDictionary();
            });

            row.append(text, removeButton);
            dictListElement.appendChild(row);
        });
    }

    if (dictAddBtn) {
        dictAddBtn.addEventListener('click', () => {
            const surface = dictSurfaceInput ? dictSurfaceInput.value.trim() : '';
            if (!surface) {
                if (dictSurfaceInput) dictSurfaceInput.focus();
                return;
            }
            const aliases = dictAliasesInput
                ? dictAliasesInput.value.split(/[、,，/／]/)
                    .map((alias) => alias.trim())
                    // 表記と包含関係にあるパターンは置換誤爆の原因になるため登録しない
                    .filter((alias) => alias !== '' && alias !== surface &&
                        !surface.includes(alias) && !alias.includes(surface))
                : [];
            userDictionary.push({
                reading: dictReadingInput ? dictReadingInput.value.trim() : '',
                surface: surface,
                nepali: dictNepaliInput ? dictNepaliInput.value.trim() : '',
                aliases: aliases
            });
            AppSettingsStorage.setUserDictionary(userDictionary);
            if (dictReadingInput) dictReadingInput.value = '';
            if (dictSurfaceInput) dictSurfaceInput.value = '';
            if (dictNepaliInput) dictNepaliInput.value = '';
            if (dictAliasesInput) dictAliasesInput.value = '';
            renderUserDictionary();
        });
    }

    renderUserDictionary();

    // ========================================
    // レイテンシ計測（F12・KPI-1の実測）
    // ========================================
    const LATENCY_MAX_SAMPLES = 100;
    let latencyData = AppSettingsStorage.getLatencyData();

    function latencyPercentile(values, ratio) {
        if (values.length === 0) return null;
        const sorted = [...values].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
    }

    function updateLatencyUI() {
        const openElement = document.getElementById('latencyOpenValue');
        const doneElement = document.getElementById('latencyDoneValue');
        const samplesElement = document.getElementById('latencySamples');
        if (!openElement || !doneElement || !samplesElement) return;

        if (latencyData.length === 0) {
            openElement.textContent = '--';
            doneElement.textContent = '--';
            samplesElement.textContent = 'データなし（翻訳すると自動記録されます）';
            return;
        }
        const opens = latencyData.map((sample) => sample.o);
        const dones = latencyData.map((sample) => sample.d);
        openElement.textContent = `中央値 ${latencyPercentile(opens, 0.5)}ms ・ 95p ${latencyPercentile(opens, 0.95)}ms`;
        doneElement.textContent = `中央値 ${latencyPercentile(dones, 0.5)}ms ・ 95p ${latencyPercentile(dones, 0.95)}ms`;
        samplesElement.textContent = `サンプル: 直近${latencyData.length}件`;
    }

    function recordLatencySample(openMs, doneMs) {
        latencyData.push({ o: Math.round(openMs), d: Math.round(doneMs), t: Date.now() });
        if (latencyData.length > LATENCY_MAX_SAMPLES) {
            latencyData = latencyData.slice(-LATENCY_MAX_SAMPLES);
        }
        AppSettingsStorage.setLatencyData(latencyData);
        updateLatencyUI();
    }

    // ---- API使用量の概算（F15: 使用量の可視化） ----
    const NANO_PRICE_IN = 0.10 / 1e6;      // USD/トークン（gpt-4.1-nano 非キャッシュ入力）
    const NANO_PRICE_CACHED = 0.025 / 1e6; // 同キャッシュ済み入力
    const NANO_PRICE_OUT = 0.40 / 1e6;     // 同出力
    let usageTotals = AppSettingsStorage.getUsageTotals();

    function updateUsageUI() {
        const element = document.getElementById('apiUsageSummary');
        if (!element) return;
        const totalTokens = usageTotals.inTokens + usageTotals.cachedTokens + usageTotals.outTokens;
        if (totalTokens === 0) {
            element.textContent = 'まだ使用データがありません';
            return;
        }
        const cost = usageTotals.inTokens * NANO_PRICE_IN +
            usageTotals.cachedTokens * NANO_PRICE_CACHED +
            usageTotals.outTokens * NANO_PRICE_OUT;
        const since = new Date(usageTotals.since).toLocaleDateString('ja-JP');
        element.textContent = `${since}から 約${totalTokens.toLocaleString()}トークン ≒ $${cost.toFixed(3)}`;
    }

    function recordApiUsage(usage) {
        if (!usage || typeof usage.prompt_tokens !== 'number') return;
        const cached = (usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || 0;
        usageTotals.inTokens += Math.max(0, usage.prompt_tokens - cached);
        usageTotals.cachedTokens += cached;
        usageTotals.outTokens += usage.completion_tokens || 0;
        AppSettingsStorage.setUsageTotals(usageTotals);
        updateUsageUI();
    }

    const resetUsageBtn = document.getElementById('resetUsageBtn');
    if (resetUsageBtn) {
        resetUsageBtn.addEventListener('click', () => {
            usageTotals = { inTokens: 0, cachedTokens: 0, outTokens: 0, since: Date.now() };
            AppSettingsStorage.clearUsageTotals();
            updateUsageUI();
        });
    }
    updateUsageUI();

    // ---- レイテンシ計測データのIssue送信（開発協力・アカウント不要） ----
    const sendLatencyBtn = document.getElementById('sendLatencyBtn');
    if (sendLatencyBtn) {
        sendLatencyBtn.addEventListener('click', async () => {
            if (latencyData.length === 0) {
                alert('まだ計測データがありません。翻訳を数回使ってから送信してください。');
                return;
            }
            const opens = latencyData.map((sample) => sample.o);
            const dones = latencyData.map((sample) => sample.d);
            const version = getCurrentAppVersion() || '不明';
            const environment = window.__BRIDGE_TTS_NATIVE_APP__ ? 'iOSネイティブ' : 'ブラウザ/PWA';
            const openMedian = latencyPercentile(opens, 0.5);
            const title = `レイテンシ報告: v${version} 訳出開始 中央値${openMedian}ms（${environment}）`;
            const body = [
                '## レイテンシ計測レポート',
                `- バージョン: v${version} / 環境: ${environment}`,
                `- サンプル: 直近${latencyData.length}件`,
                `- 訳出開始: 中央値 ${openMedian}ms ・ 95p ${latencyPercentile(opens, 0.95)}ms（目標: 中央値700ms）`,
                `- 訳の確定: 中央値 ${latencyPercentile(dones, 0.5)}ms ・ 95p ${latencyPercentile(dones, 0.95)}ms（目標: 中央値1200ms）`,
                `- デバウンス: ja ${currentDebounce['ja']}ms / ne ${currentDebounce['ne']}ms`,
                `- UA: ${navigator.userAgent}`
            ].join('\n');

            sendLatencyBtn.disabled = true;
            sendLatencyBtn.textContent = '送信中...';
            try {
                const issueUrl = await window.ErrorReporter.postIssue({
                    title: title, body: body, labels: ['latency-report']
                });
                alert(issueUrl
                    ? '計測データを送信しました。ご協力ありがとうございます。'
                    : 'Issue作成画面を開きました。内容を確認して送信してください。');
            } catch (error) {
                alert('送信に失敗しました: ' + (error && error.message ? error.message : error));
            } finally {
                sendLatencyBtn.disabled = false;
                sendLatencyBtn.textContent = '計測データを送信';
            }
        });
    }

    const resetLatencyBtn = document.getElementById('resetLatencyBtn');
    if (resetLatencyBtn) {
        resetLatencyBtn.addEventListener('click', () => {
            latencyData = [];
            AppSettingsStorage.clearLatencyData();
            updateLatencyUI();
        });
    }
    updateLatencyUI();

    // 翻訳API接続のウォームアップ（録音開始時にTLS/HTTP2接続を先行確立し、
    // 最初の翻訳リクエストの接続コスト100〜300msをゼロにする）
    let lastConnectionWarmupAt = 0;
    function warmUpTranslationConnection() {
        const now = Date.now();
        if (now - lastConnectionWarmupAt < 60000) return;
        lastConnectionWarmupAt = now;
        fetch('https://api.openai.com/v1/models', { method: 'HEAD', cache: 'no-store' }).catch(() => {});
    }

    // ========================================
    // アプリ更新の自動検知（ネイティブ版のみ。PWAはService Workerが自動更新）
    // ========================================
    const UPDATE_CHECK_URL = 'https://aichirofunakoshi.github.io/BrigeTTS-Nepali/apps.json';
    const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6時間
    const DISMISSED_UPDATE_KEY = 'translatorDismissedUpdate';
    let lastUpdateCheckAt = 0;

    function compareAppVersions(a, b) {
        const partsA = String(a).split('.').map(Number);
        const partsB = String(b).split('.').map(Number);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const diff = (partsA[i] || 0) - (partsB[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    }

    function getCurrentAppVersion() {
        const title = document.querySelector('.app-title');
        const match = title && title.textContent.match(/v(\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
    }

    async function checkForAppUpdate() {
        if (!window.__BRIDGE_TTS_NATIVE_APP__) return;
        const now = Date.now();
        if (now - lastUpdateCheckAt < UPDATE_CHECK_INTERVAL_MS) return;
        lastUpdateCheckAt = now;
        try {
            const response = await fetch(UPDATE_CHECK_URL, { cache: 'no-store' });
            const source = await response.json();
            const latest = source && source.apps && source.apps[0] &&
                source.apps[0].versions && source.apps[0].versions[0] &&
                source.apps[0].versions[0].version;
            const current = getCurrentAppVersion();
            if (!latest || !current || compareAppVersions(latest, current) <= 0) return;
            if (AppSettingsStorage.getString(DISMISSED_UPDATE_KEY) === latest) return;

            const banner = document.getElementById('updateBanner');
            const bannerText = document.getElementById('updateBannerText');
            if (!banner || !bannerText) return;
            bannerText.textContent = `新しいバージョン v${latest} が利用可能です`;
            banner.dataset.version = latest;
            banner.hidden = false;
        } catch (error) {
            // オフライン・一時的な失敗は無視（次回の起動/復帰時に再試行）
        }
    }

    const updateBannerOpenBtn = document.getElementById('updateBannerOpen');
    const updateBannerCloseBtn = document.getElementById('updateBannerClose');
    if (updateBannerOpenBtn) {
        updateBannerOpenBtn.addEventListener('click', () => {
            // WKWebViewではwindow.openが外部アプリ起動(UIApplication.open)に委譲される
            window.open('altstore://', '_blank');
        });
    }
    if (updateBannerCloseBtn) {
        updateBannerCloseBtn.addEventListener('click', () => {
            const banner = document.getElementById('updateBanner');
            if (banner) {
                AppSettingsStorage.setString(DISMISSED_UPDATE_KEY, banner.dataset.version || '');
                banner.hidden = true;
            }
        });
    }
    checkForAppUpdate();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkForAppUpdate();
        }
    });

    // ========================================
    // 設定のエクスポート / インポート
    // ========================================
    const exportSettingsBtn = document.getElementById('exportSettingsBtn');
    const importSettingsBtn = document.getElementById('importSettingsBtn');

    if (exportSettingsBtn) {
        exportSettingsBtn.addEventListener('click', async () => {
            const json = AppSettingsStorage.exportSettings();
            try {
                await navigator.clipboard.writeText(json);
                alert('設定をクリップボードにコピーしました。\nメモ等に保管するか、移行先の端末の「インポート」で貼り付けてください。');
            } catch (error) {
                prompt('自動コピーできませんでした。以下を手動でコピーしてください:', json);
            }
        });
    }

    if (importSettingsBtn) {
        importSettingsBtn.addEventListener('click', async () => {
            let text = '';
            if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
                try {
                    text = await navigator.clipboard.readText();
                } catch (error) {
                    text = '';
                }
            }
            if (!text || !text.trim()) {
                text = prompt('エクスポートした設定データを貼り付けてください:') || '';
            }
            if (!text.trim()) return;

            const check = AppSettingsStorage.importSettings(text.trim(), { dryRun: true });
            if (!check.ok) {
                alert('インポートできません: ' + check.error);
                return;
            }
            if (!confirm(check.count + '項目の設定を取り込みます。\n現在の設定は上書きされ、アプリを再読み込みします。よろしいですか？')) {
                return;
            }
            AppSettingsStorage.importSettings(text.trim());
            location.reload();
        });
    }

    // 保存された会話履歴を復元
    loadConversationLog();

    // フォントサイズプレビューの更新関数
    function updateFontSizePreview(size) {
        if (!fontSizePreview) return;

        // サイズに応じたフォントサイズを設定
        const fontSizes = {
            'small': '14px',
            'medium': '18px',
            'large': '24px',
            'xlarge': '32px'
        };

        const previewText = fontSizePreview.querySelector('.preview-text');
        if (previewText) {
            previewText.style.fontSize = fontSizes[size] || '18px';
        }

        // ボタンのアクティブ状態を更新
        [fontSizeSmallBtn, fontSizeMediumBtn, fontSizeLargeBtn, fontSizeXLargeBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        const buttonMap = {
            'small': fontSizeSmallBtn,
            'medium': fontSizeMediumBtn,
            'large': fontSizeLargeBtn,
            'xlarge': fontSizeXLargeBtn
        };

        if (buttonMap[size]) {
            buttonMap[size].classList.add('active');
        }
    }

    // フォントサイズ変更関数
    function changeFontSize(size) {
        // すべてのサイズクラスを削除
        originalText.classList.remove('size-small', 'size-medium', 'size-large', 'size-xlarge');
        translatedText.classList.remove('size-small', 'size-medium', 'size-large', 'size-xlarge');

        // 選択されたサイズクラスを追加
        originalText.classList.add(`size-${size}`);
        translatedText.classList.add(`size-${size}`);

        // ローカルストレージに保存してユーザー設定を記憶
        AppSettingsStorage.setFontSize(size);

        // プレビューも更新
        updateFontSizePreview(size);

        // ヘッダーの即時切替ボタンのラベルを現在のサイズに同期（アクセシビリティ）
        if (fontSizeToggleBtn) {
            const sizeLabels = { small: '小', medium: '中', large: '大', xlarge: '特大' };
            fontSizeToggleBtn.setAttribute('aria-label', `文字サイズ: ${sizeLabels[size] || size}（タップで変更）`);
        }
    }

    // 文字サイズを次の段階へ循環させる（設定モーダルを開かずに画面上で即時変更）
    function cycleFontSize() {
        const order = AppSettingsStorage.fontSizeValues; // ['small','medium','large','xlarge']
        const current = AppSettingsStorage.getFontSize('medium');
        const currentIndex = order.indexOf(current);
        const next = order[(currentIndex + 1) % order.length];
        changeFontSize(next);
    }
    
    // アプリの初期化
    function initializeApp() {
        // 既に初期化済みの場合は早期リターン
        if (appInitialized) {
            console.log('アプリは既に初期化済みです。再初期化をスキップします。');
            // TTS設定の同期のみ実行（毎回必要）
            if (ttsToggle) {
                ttsToggle.checked = isTTSEnabled;
            }
            return;
        }

        // エラーメッセージをクリア
        errorMessage.textContent = '';

        // Web Speech APIのサポート確認
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            setupSpeechRecognition();
        } else {
            status.textContent = 'このブラウザは音声認識に対応していません。';
            status.classList.remove('idle');
            status.classList.add('error');
            errorMessage.textContent = 'ブラウザが音声認識に対応していません。Chrome、Safari、またはEdgeをお使いください。';
            return;
        }

        // TTS対応確認と音声リストの初期化
        if (window.TtsService.isSupported()) {
            window.TtsService.bindVoiceChanges();
        } else {
            console.warn('このブラウザはTTSに対応していません');
        }

        // TTS設定の初期化
        if (ttsToggle) {
            ttsToggle.checked = isTTSEnabled;
        }

        // 言語ボタンを有効化
        startJapaneseBtn.addEventListener('click', () => startRecording('ja'));
        startNepaliBtn.addEventListener('click', () => startRecording('ne'));
        stopBtn.addEventListener('click', stopRecording);
        resetBtn.addEventListener('click', resetContent);

        // 翻訳ボックスのタップ/キーボードでTTS再生
        if (translationBox) {
            translationBox.addEventListener('click', playTranslation);
            // キーボードアクセシビリティ対応（Enter/Space）
            translationBox.addEventListener('keydown', (e) => {
                if (e.target.closest('button')) {
                    return;
                }
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    playTranslation();
                }
            });
            // 初期状態は無効
            updateTranslationBoxState(false);
        }

        if (copyTranslationBtn) {
            copyTranslationBtn.addEventListener('click', copyTranslation);
        }

        if (presentTranslationBtn) {
            presentTranslationBtn.addEventListener('click', openPresentMode);
        }

        if (presentModal) {
            // 背景タップで閉じる（ステージ外側）
            presentModal.addEventListener('click', (e) => {
                if (e.target === presentModal) {
                    closePresentMode();
                }
            });
        }

        if (presentCloseBtn) {
            presentCloseBtn.addEventListener('click', closePresentMode);
        }

        if (presentReplayBtn) {
            presentReplayBtn.addEventListener('click', (e) => {
                if (e) {
                    e.stopPropagation();
                }
                const translation = (lastTranslationResult || '').trim();
                if (translation) {
                    speakTranslation(translation, selectedLanguage);
                }
            });
        }

        // Escキーで大型表示を閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && presentModal && presentModal.style.display === 'flex') {
                closePresentMode();
            }
        });

        if (clearConversationLogBtn) {
            clearConversationLogBtn.addEventListener('click', () => {
                if (conversationEntries.length === 0) return;
                if (confirm('会話履歴をすべて消去しますか？')) {
                    clearConversationLog();
                }
            });
        }

        // 初期化完了フラグを設定
        appInitialized = true;
        console.log('アプリ初期化完了');
    }
    
    // コンテンツリセット機能
    function resetContent() {
        // TTS停止・自動読み上げ待機解除
        stopTTS();
        disarmAutoSpeak();

        // リセット処理
        processedResultIds.clear();
        lastTranslatedText = '';
        lastTranslationResult = ''; // TTS用の翻訳結果もクリア
        resetMonotonicState(); // 順送り訳（β）の状態もクリア
        originalText.textContent = '';
        translatedText.textContent = '';
        // 注意: 会話履歴は端末に保存されるため、リセットでは消去しない
        // （履歴の消去は会話履歴パネルの「消去」ボタンから行う）

        // 翻訳品質警告の履歴もクリア
        translationQualityWarningHistory.clear();

        // 翻訳品質警告の要素も削除
        const warningElement = document.getElementById('translationQualityWarning');
        if (warningElement) {
            warningElement.remove();
        }

        // 再生ボタンを無効化
        updateTranslationBoxState(false);

        // 視覚状態をすべてクリア
        updateRecordingState(false);
        updateTranslatingState(false);
        updateTranslationCompleteState(false);

        // ステータス表示も更新
        status.textContent = '待機中';
        status.classList.remove('recording', 'processing', 'error');
        status.classList.add('idle');

        errorMessage.textContent = '';

        console.log('コンテンツリセット完了');
    }
    
    // 音声認識の設定
    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            status.textContent = 'このブラウザは音声認識に対応していません。';
            status.classList.remove('idle');
            status.classList.add('error');
            errorMessage.textContent = 'ブラウザが音声認識に対応していません。Chrome、Safari、またはEdgeをお使いください。';
            return;
        }
        
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        recognition.onstart = function() {
            console.log('音声認識開始。言語:', recognition.lang);
            recognitionSessionId += 1;
            isRecognitionRunning = true;
            listeningIndicator.classList.add('visible');

            // マイク準備完了。ここから話し始めてよいことをユーザーに伝える
            if (isRecording) {
                status.textContent = '聞き取り中';
            }

            // 音声認識が正常に開始したので、再起動カウンターをリセット
            recognitionRestartAttempts = 0;
            // エラーメッセージもクリア
            if (errorMessage) {
                errorMessage.textContent = '';
            }
        };

        recognition.onend = function() {
            console.log('音声認識終了');
            isRecognitionRunning = false;
            listeningIndicator.classList.remove('visible');

            // 録音中の場合のみ再開を検討
            if (isRecording) {
                // TTS再生中は再開しない
                if (isTTSPlaying) {
                    console.log('TTS再生中のため音声認識は再開しない');
                    return;
                }

                // 少し遅延を入れて再開（連続再開を防ぐ）
                safeRestartRecognition(100, 'onend');
            }
        };
        
        // 音声認識結果の処理 - デバウンス最適化版
        recognition.onresult = function(event) {
            // 最後の結果受信時刻を更新（状態監視用）
            lastRecognitionResultTime = Date.now();

            // 現在の文字起こし内容を構築
            let interimText = '';
            let finalText = '';
            let hasNewContent = false;

            // 各認識結果に対して処理
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                // 辞書の誤認識パターンを正しい表記へ置換してから処理する
                // （表示・翻訳・順送りチャンクのすべてに適用される）
                const transcript = applyDictionaryAliases(result[0].transcript.trim());

                // 各結果に一意のIDを生成（セッション＋位置＋内容）
                const resultId = `${recognitionSessionId}-${i}-${transcript}`;

                // 確定した結果の場合
                if (result.isFinal) {
                    // まだ処理していない結果の場合のみ追加
                    if (!processedResultIds.has(resultId)) {
                        processedResultIds.add(resultId);
                        hasNewContent = true;

                        // メモリリーク対策: processedResultIdsが大きくなりすぎたら古いものを削除
                        if (processedResultIds.size > PROCESSED_IDS_MAX_SIZE) {
                            console.log(`processedResultIdsが${PROCESSED_IDS_MAX_SIZE}件を超えました。古いデータを削除します。`);
                            const idsArray = Array.from(processedResultIds);
                            // 古い半分を削除（FIFOのように動作）
                            const idsToKeep = idsArray.slice(Math.floor(idsArray.length / 2));
                            processedResultIds = new Set(idsToKeep);
                        }

                        // 日本語入力の場合、文章を整形
                        const formattedTranscript = selectedLanguage === 'ja'
                            ? japaneseFormatter.format(transcript)
                            : transcript;
                        finalText += formattedTranscript + ' ';

                        // 順送り訳（β）: 確定セグメントをチャンクとして積み上げる
                        if (activeTranslationStrategy === 'monotonic') {
                            enqueueMonotonicChunk(formattedTranscript);
                        }
                    } else {
                        // 処理済みの確定結果も表示用には追加
                        finalText += transcript + ' ';
                    }
                } else {
                    // 暫定結果
                    interimText += transcript + ' ';
                    hasNewContent = true;
                }
            }
            
            // 表示テキスト (確定結果 + 暫定結果)
            // 順送り訳（β）では確定チャンクを認識セッションをまたいで保持・表示する
            const displayText = activeTranslationStrategy === 'monotonic'
                ? (monoSourceSegments.join(' ') + ' ' + interimText).trim()
                : (finalText + interimText).trim();

            // デバウンス最適化用: 認識結果が実際に変化した間隔を記録
            // （順送りβは学習の対象外。全文再翻訳方式のデバウンス値を汚染しないため）
            if (activeTranslationStrategy !== 'monotonic' && displayText && displayText !== originalText.textContent) {
                recordResultInterval(selectedLanguage);
            }

            // UIを更新
            originalText.textContent = displayText;
            
            // 言語インジケータを更新
            if (selectedLanguage === 'ja') {
                sourceLanguage.textContent = '日本語';
                targetLanguage.textContent = 'ネパール語';
            } else {
                sourceLanguage.textContent = 'ネパール語';
                targetLanguage.textContent = '日本語';
            }
            
            // 新しいコンテンツがある場合、翻訳をトリガー（順送りβはチャンク確定時に翻訳するため対象外）
            if (activeTranslationStrategy !== 'monotonic' && hasNewContent && displayText !== lastTranslatedText) {
                // 翻訳処理をデバウンス（言語に応じて動的調整）
                clearTimeout(translationDebounceTimer);
                const dynamicDebounce = getOptimalDebounce(selectedLanguage);
                translationDebounceTimer = setTimeout(() => {
                    lastTranslatedText = displayText;
                    translateText(displayText);
                }, dynamicDebounce); // 言語に応じて動的変更
            }
        };
        
        recognition.onerror = function(event) {
            // no-speechとabortedは正常な状態として扱う
            if (event.error === 'no-speech') {
                // 音声が検出されない - 正常な状態
                console.log('音声認識: 音声が検出されません');
            } else if (event.error === 'aborted') {
                // TTS再生等のために意図的に停止された - 正常な状態
                console.log('音声認識が中断されました（意図的な停止）');
            } else if (event.error === 'audio-capture') {
                console.error('音声認識エラー:', event.error);
                status.textContent = 'マイクが検出されません';
                status.classList.remove('idle', 'recording');
                status.classList.add('error');
                errorMessage.textContent = 'マイクが検出できません。デバイス設定を確認してください。';
                stopRecording();
            } else if (event.error === 'not-allowed') {
                console.error('音声認識エラー:', event.error);
                status.textContent = 'マイク権限が拒否されています';
                status.classList.remove('idle', 'recording');
                status.classList.add('error');
                errorMessage.textContent = 'マイクアクセスが拒否されました。ブラウザ設定でマイク権限を許可してください。';
                stopRecording();
            } else {
                // その他の未知のエラー
                console.error('音声認識エラー:', event.error);
            }
        };
    }
    
    // 録音状態のボタン表示切り替え
    function updateButtonVisibility(isRecordingState) {
        if (isRecordingState) {
            // 開始ボタンを非表示、停止ボタンを表示
            startJapaneseBtn.style.display = 'none';
            startNepaliBtn.style.display = 'none';
            stopBtn.style.display = 'flex';
            stopBtn.disabled = false;
            resetBtn.disabled = true; // 録音中はリセット無効化
            resetBtn.style.opacity = '0.5';
        } else {
            // 開始ボタンを表示、停止ボタンを非表示
            startJapaneseBtn.style.display = 'flex';
            startNepaliBtn.style.display = 'flex';
            startJapaneseBtn.disabled = false;
            startNepaliBtn.disabled = false;
            stopBtn.style.display = 'none';
            stopBtn.disabled = true;
            resetBtn.disabled = false; // 録音停止中はリセット有効化
            resetBtn.style.opacity = '1';
        }
    }
    
    // 指定された言語で録音開始
    async function startRecording(language) {
        // iOS Safari対策: ユーザーのタップ時にTTSを初期化
        if (!ttsInitialized && 'speechSynthesis' in window) {
            initializeTTSForIOS();
        }

        // エラーメッセージをクリア
        errorMessage.textContent = '';

        // 前のターンの自動読み上げ待機を解除
        disarmAutoSpeak();

        // 選択言語を設定
        selectedLanguage = language;

        // 翻訳方式をこのセッションに確定し、順送り訳（β）の状態をリセット
        activeTranslationStrategy = translationStrategy;
        resetMonotonicState();

        // UIと変数をリセット
        processedResultIds.clear();
        lastTranslatedText = '';
        lastTranslationResult = ''; // 前回の翻訳結果をクリア
        originalText.textContent = '';
        translatedText.textContent = '';

        // 再生ボタンを無効化
        updateTranslationBoxState(false);

        // TTS停止
        stopTTS();
        
        // 言語インジケータを更新
        if (language === 'ja') {
            sourceLanguage.textContent = '日本語';
            targetLanguage.textContent = 'ネパール語';
            // 停止ボタンのテキストを日本語に設定
            stopBtnText.textContent = '停止';
        } else {
            sourceLanguage.textContent = 'ネパール語';
            targetLanguage.textContent = '日本語';
            // 停止ボタンのテキストをネパール語に設定
            stopBtnText.textContent = 'रोक्नुहोस्';
        }
        
        // UIを更新（マイク準備完了＝recognition.onstart で「録音中」に切り替わる。
        // 準備完了前に話し始めて冒頭が欠けるのを防ぐための表示）
        isRecording = true;
        document.body.classList.add('recording');
        status.textContent = 'マイク準備中…';
        status.classList.remove('idle', 'error');
        status.classList.add('recording');

        // 録音状態の視覚的フィードバックを更新
        updateRecordingState(true);
        updateTranslationCompleteState(false);

        // ボタン表示を更新 - 開始ボタンを非表示、停止ボタンを表示
        updateButtonVisibility(true);
        
        // Web Speech APIを使用して言語を明示的に設定
        try {
            // 再起動カウンターをリセット
            recognitionRestartAttempts = 0;
            // 最後の結果受信時刻を初期化
            lastRecognitionResultTime = Date.now();
            // デバウンス学習用の更新間隔計測をリセット
            lastResultEventTime = 0;

            // 認識言語を設定
            warmUpTranslationConnection();
            recognition.lang = language === 'ja' ? 'ja-JP' : 'ne-NP';
            recognition.start();

            // 音声認識の状態監視を開始
            startRecognitionHealthCheck();

            // 辞書スナップショットをこのセッション用に確定
            recordingDictionarySnapshot = userDictionary.slice();

            // 異常終了検出: 録音中であることを記録（フリーズ→強制終了の事後検出用）
            if (window.ErrorReporter) {
                window.ErrorReporter.markSession(true);
            }
        } catch (e) {
            console.error('音声認識開始エラー', e);
            errorMessage.textContent = '音声認識の開始に失敗しました: ' + (e?.message || e);
            stopRecording();
        }
    }
    
    // 録音停止（停止ボタン・自動停止用）
    function stopRecording() {
        finishRecordingSession({ stopTts: true });
        // 順送り訳（β）: 残チャンクの訳出完了を待って整形パスを実行
        if (activeTranslationStrategy === 'monotonic') {
            scheduleMonotonicFinalize();
        }
        // 会話モード: 停止後に最後の翻訳結果を自動読み上げ（設定有効時のみ）
        armAutoSpeak();
    }

    // 音声入力セッションを終了する共通処理
    // stopTts=false はTTS再生（ターン終了）から呼ばれる場合で、
    // これから再生するTTSを止めないためにTTS停止をスキップする
    function finishRecordingSession({ stopTts = true } = {}) {
        isRecording = false;
        document.body.classList.remove('recording');
        status.textContent = '処理中';
        status.classList.remove('recording');
        status.classList.add('processing');

        // 録音状態の視覚的フィードバックを解除
        updateRecordingState(false);

        // 音声認識の状態監視を停止
        stopRecognitionHealthCheck();

        // 異常終了検出: 正常に録音を終了したことを記録
        if (window.ErrorReporter) {
            window.ErrorReporter.markSession(false);
        }

        // 再起動カウンターをリセット
        recognitionRestartAttempts = 0;

        // TTS停止（ターン終了によるTTS再生時はスキップ）
        if (stopTts) {
            stopTTS();
        }

        // ボタン表示を更新 - 開始ボタンを表示、停止ボタンを非表示
        updateButtonVisibility(false);

        try {
            recognition.stop();
        } catch (e) {
            console.error('音声認識停止エラー', e);
        }

        // 処理完了後にステータスを更新
        setTimeout(() => {
            status.textContent = '待機中';
            status.classList.remove('processing');
            status.classList.add('idle');
        }, 1000);

        console.log('録音停止');
    }
    
    /**
     * 翻訳結果の品質をチェックする
     * 日本語からネパール語への翻訳で未翻訳の日本語が残っている場合に警告を表示
     * 括弧内の日本語（例：「staff meeting (担当者会議)」）は正常な翻訳として扱う
     * @param {string} originalText - 元のテキスト
     * @param {string} translatedText - 翻訳されたテキスト
     * @param {string} sourceLanguage - 元の言語（'ja' または 'ne'）
     * @param {HTMLElement} targetElement - 警告を表示する要素（translationBox）
     * @returns {boolean} - 品質に問題がある場合true
     */
    function checkTranslationQuality(originalText, translatedText, sourceLanguage, targetElement) {
        // 日本語からネパール語への翻訳の場合のみチェック
        if (sourceLanguage !== 'ja') {
            return false;
        }

        // 日本語文字（漢字、ひらがな、カタカナ）の正規表現
        const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

        // 括弧内の日本語を一時的に除外してからチェック
        // 半角括弧: "staff meeting (担当者会議)" → "staff meeting ()"
        // 全角括弧: "staff meeting（担当者会議）" → "staff meeting（）"
        let textWithoutParentheses = translatedText;
        // 半角括弧内の日本語を除外
        textWithoutParentheses = textWithoutParentheses.replace(/\([^)]*[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF][^)]*\)/g, '()');
        // 全角括弧内の日本語を除外
        textWithoutParentheses = textWithoutParentheses.replace(/\uFF08[^\uFF09]*[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF][^\uFF09]*\uFF09/g, '（）');

        // 括弧外に日本語が含まれているかチェック
        const hasUntranslatedJapanese = japanesePattern.test(textWithoutParentheses);

        if (hasUntranslatedJapanese) {
            // 同じテキストに対する警告回数をチェック
            const warningCount = translationQualityWarningHistory.get(originalText) || 0;
            if (warningCount >= MAX_QUALITY_WARNING_COUNT) {
                console.log('翻訳品質警告: 最大警告回数に達したため警告をスキップ', {
                    original: originalText,
                    warningCount: warningCount
                });
                return false; // 警告を表示しない
            }

            console.warn('翻訳品質警告: 翻訳結果に日本語が残っています', {
                original: originalText,
                translated: translatedText,
                afterFiltering: textWithoutParentheses,
                warningCount: warningCount + 1
            });

            // 警告回数をインクリメント
            translationQualityWarningHistory.set(originalText, warningCount + 1);

            // Mapのサイズ上限チェック（メモリ最適化）
            if (translationQualityWarningHistory.size > MAX_WARNING_HISTORY_SIZE) {
                // 最も古いエントリを削除（Mapは挿入順を保持）
                const firstKey = translationQualityWarningHistory.keys().next().value;
                translationQualityWarningHistory.delete(firstKey);
                console.log('警告履歴の最大サイズに達したため、古いエントリを削除しました');
            }

            showTranslationQualityWarning(originalText, targetElement);
            return true;
        }

        return false;
    }

    /**
     * 翻訳品質の警告を表示し、再翻訳オプションを提供
     * @param {string} originalText - 元のテキスト
     * @param {HTMLElement} targetElement - 警告を表示する要素（translationBox）
     */
    function showTranslationQualityWarning(originalText, targetElement) {
        // 既存の警告があれば削除
        const existingWarning = document.getElementById('translationQualityWarning');
        if (existingWarning) {
            existingWarning.remove();
        }

        // 警告要素を作成
        const warning = document.createElement('div');
        warning.id = 'translationQualityWarning';
        warning.className = 'translation-quality-warning';
        warning.innerHTML = `
            <div class="warning-content">
                <span class="warning-icon">⚠️</span>
                <span class="warning-text">一部が翻訳されていない可能性があります</span>
                <button class="retry-translation-btn" id="retryTranslationBtn">再翻訳</button>
                <button class="close-warning-btn" id="closeWarningBtn">×</button>
            </div>
        `;

        // 翻訳ボックスに追加
        targetElement.appendChild(warning);

        // 警告要素全体のクリックイベントを処理（TTS再生イベントの伝播を防止）
        warning.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 再翻訳ボタンのイベントリスナー
        document.getElementById('retryTranslationBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // TTS再生イベントの伝播を防止
            console.log('再翻訳を実行:', originalText);
            warning.remove();
            translateText(originalText);
        });

        // 閉じるボタンのイベントリスナー
        document.getElementById('closeWarningBtn').addEventListener('click', (e) => {
            e.stopPropagation(); // TTS再生イベントの伝播を防止
            warning.remove();
        });

        // 10秒後に自動的に閉じる（再翻訳ボタンは押されない場合のみ）
        setTimeout(() => {
            if (document.getElementById('translationQualityWarning')) {
                warning.remove();
            }
        }, 10000);
    }

    // OpenAI API（gpt-4.1-nanoモデル）を使用してテキストを翻訳
    async function translateText(text) {
        // 翻訳処理の実行条件をチェック
        if (!text || !text.trim()) {
            console.log('翻訳スキップ: 空のテキスト');
            return;
        }

        // 前回の翻訳品質警告を削除（新しい翻訳が始まる際に古い警告が残らないように）
        const staleWarning = document.getElementById('translationQualityWarning');
        if (staleWarning) {
            staleWarning.remove();
        }

        // レイテンシ計測: 区切り検出（デバウンス満了）を起点とする
        const latencyStartedAt = performance.now();
        let latencyFirstChunkAt = null;

        // 既に翻訳中の場合は新しいリクエストで上書き
        if (translationInProgress) {
            // 既存のリクエストを中断
            if (currentTranslationController) {
                currentTranslationController.abort();
                currentTranslationController = null;
            }
            // 前のTTSも停止
            stopTTS();
        }
        
        translationInProgress = true;
        activeTranslationId += 1;
        const translationId = activeTranslationId;
        lastTranslationTime = Date.now();
        translatingIndicator.classList.add('visible');

        // 翻訳中の視覚的フィードバックを更新
        updateTranslatingState(true);

        // エラーメッセージをクリア
        errorMessage.textContent = '';
        
        try {
            // 新しいAbortControllerを作成
            currentTranslationController = new AbortController();
            const signal = currentTranslationController.signal;
            
            console.log(`テキスト翻訳中 (${text.length} 文字): "${text.substring(0, 30)}..."`);
            console.log('OpenAI APIに翻訳リクエストを送信中...');
            console.log('翻訳ストリーム開始');
            
            // 新しい翻訳開始時は以前の内容をクリア
            translatedText.textContent = '';

            if (!window.TranslatorService || typeof window.TranslatorService.translateStream !== 'function') {
                throw new Error('翻訳モジュールの読み込みに失敗しました。ページを再読み込みしてください。');
            }

            if (!window.PromptService || typeof window.PromptService.getTranslationSystemPrompt !== 'function') {
                throw new Error('翻訳モジュールの読み込みに失敗しました。ページを再読み込みしてください。');
            }

            const translationResult = await window.TranslatorService.translateStream({
                apiKey: OPENAI_API_KEY,
                text: text,
                sourceLanguage: selectedLanguage,
                systemPrompt: window.PromptService.getTranslationSystemPrompt({
                    domain: translationDomain,
                    dictionary: userDictionary
                }),
                signal: signal,
                onUsage: recordApiUsage,
                onChunk: (currentText) => {
                    if (translationId !== activeTranslationId) {
                        return;
                    }
                    if (latencyFirstChunkAt === null) {
                        latencyFirstChunkAt = performance.now();
                    }
                    translatedText.textContent = currentText;
                }
            });

            if (translationId !== activeTranslationId) {
                return;
            }

            if (latencyFirstChunkAt !== null) {
                recordLatencySample(
                    latencyFirstChunkAt - latencyStartedAt,
                    performance.now() - latencyStartedAt
                );
            }

            console.log('翻訳完了:', {
                resultLength: translationResult.length,
                selectedLanguage: selectedLanguage
            });

            // 翻訳結果を保存（手動TTS再生用）
            if (translationResult && translationResult.trim()) {
                lastTranslationResult = translationResult;
                // 再生ボタンを有効化
                updateTranslationBoxState(true);
                // 翻訳完了の視覚的フィードバック
                updateTranslationCompleteState(true);
                console.log('翻訳結果を保存しました。再生ボタンで読み上げ可能です。');
                addConversationLogEntry(text, translationResult, selectedLanguage);

                // 翻訳品質チェック
                checkTranslationQuality(text, translationResult, selectedLanguage, translationBox);

                // 会話モード: 録音停止後に完了した翻訳を自動読み上げ
                if (autoSpeakArmed && !isRecording) {
                    triggerAutoSpeak();
                }
            } else {
                lastTranslationResult = '';
                updateTranslationBoxState(false);
                updateTranslationCompleteState(false);
            }

            // 現在のコントローラーをリセット
            currentTranslationController = null;
            
        } catch (error) {
            if (translationId !== activeTranslationId) {
                return;
            }

            // 中断エラーは無視
            if (error.name === 'AbortError') {
                console.log('翻訳リクエストが中断されました');
            } else {
                console.error('翻訳エラー:', error);
                errorMessage.textContent = error.message;
                if (translatedText.textContent === '') {
                    translatedText.textContent = '(翻訳エラー - 再度お試しください)';
                }
            }
        } finally {
            if (translationId === activeTranslationId) {
                currentTranslationController = null;
                translationInProgress = false;
                translatingIndicator.classList.remove('visible');
                // 翻訳中の視覚的フィードバックを解除
                updateTranslatingState(false);
            }
        }
    }
    
    // ========================================
    // 順送り訳（β）: チャンク逐次訳出＋停止時整形パス
    // ========================================
    // 設計: docs/POST_MEASUREMENT_PLAN.md §3（増分翻訳）の凍結方式を土台に、
    // 録音停止時の整形パス（誤訳・冗長の修正。順送りの語順骨格は保持）を追加した試験機能。
    // 既存の全文再翻訳経路（translateText）には手を入れず、翻訳方式の設定で切り替える。
    let monoSourceSegments = [];     // 確定した原文チャンク（発話順）
    let monoTranslatedCount = 0;     // 訳出済みチャンク数
    let monoTranslation = '';        // 確定訳の連結（凍結。以後再翻訳しない）
    let monoChunkInFlight = false;   // チャンク翻訳の実行中フラグ
    let monoRefineInFlight = false;  // 整形パスの実行中フラグ
    let monoFinalizePending = false; // 停止後の整形パス待機フラグ
    let monoGeneration = 0;          // リセット世代（非同期処理の取り違え防止）
    let monoAbortController = null;
    const MONO_CONTEXT_SEGMENTS = 2;             // チャンク翻訳に添える直前原文の数
    const MONO_CONTEXT_TRANSLATION_CHARS = 200;  // チャンク翻訳に添える直前訳文の最大文字数
    const MONO_FINALIZE_DELAY_MS = 400;          // 停止後、遅延到着する確定結果を待つ時間

    function resetMonotonicState() {
        monoGeneration += 1;
        if (monoAbortController) {
            monoAbortController.abort();
            monoAbortController = null;
        }
        if (monoChunkInFlight || monoRefineInFlight) {
            // 中断した非同期処理のfinallyは世代不一致でスキップされるため、ここで表示状態を戻す
            translationInProgress = false;
            translatingIndicator.classList.remove('visible');
            updateTranslatingState(false);
        }
        monoSourceSegments = [];
        monoTranslatedCount = 0;
        monoTranslation = '';
        monoChunkInFlight = false;
        monoRefineInFlight = false;
        monoFinalizePending = false;
    }

    // 確定訳と追加分の結合（ネパール語はスペース区切り、日本語はそのまま連結）
    function joinMonoTranslation(base, addition) {
        const trimmedAddition = (addition || '').trim();
        if (!trimmedAddition) return base;
        if (!base) return trimmedAddition;
        return selectedLanguage === 'ja' ? base + ' ' + trimmedAddition : base + trimmedAddition;
    }

    function renderMonotonicTranslation(streamingText) {
        translatedText.textContent = joinMonoTranslation(monoTranslation, streamingText || '');
    }

    function enqueueMonotonicChunk(chunk) {
        const trimmed = (chunk || '').trim();
        if (!trimmed) return;
        monoSourceSegments.push(trimmed);
        if (!isRecording) {
            // 停止後に遅延到着した確定結果: 訳出後に整形・確定をやり直す
            monoFinalizePending = true;
        }
        pumpMonotonicQueue();
    }

    function buildMonotonicUserContent(chunk) {
        const sourceLabel = selectedLanguage === 'ja' ? '日本語' : 'ネパール語';
        const targetLabel = selectedLanguage === 'ja' ? 'ネパール語' : '日本語';
        let context = '';
        if (monoTranslatedCount > 0) {
            const contextSource = monoSourceSegments
                .slice(Math.max(0, monoTranslatedCount - MONO_CONTEXT_SEGMENTS), monoTranslatedCount)
                .join(' ');
            const contextTranslation = monoTranslation.slice(-MONO_CONTEXT_TRANSLATION_CHARS);
            context = `直前の発話（文脈。翻訳しないこと）:\n原文: ${contextSource}\n訳文: ${contextTranslation}\n\n`;
        }
        return `${context}以下の${sourceLabel}テキストは発話の続きである。上の文脈に自然につながる${targetLabel}訳のみを出力してください:\n\n${chunk}`;
    }

    // 未訳チャンクを発話順に1件ずつ翻訳する（直列実行。順序保証のため並列化しない。
    // 整形パス実行中は待機し、整形完了後に再開される）
    async function pumpMonotonicQueue() {
        if (monoChunkInFlight || monoRefineInFlight) return;
        if (monoTranslatedCount >= monoSourceSegments.length) {
            maybeRunMonotonicRefine();
            return;
        }
        const generation = monoGeneration;
        const chunk = monoSourceSegments[monoTranslatedCount];
        monoChunkInFlight = true;
        translationInProgress = true;
        translatingIndicator.classList.add('visible');
        updateTranslatingState(true);
        errorMessage.textContent = '';
        try {
            monoAbortController = new AbortController();
            const result = await window.TranslatorService.translateStream({
                apiKey: OPENAI_API_KEY,
                text: chunk,
                sourceLanguage: selectedLanguage,
                systemPrompt: window.PromptService.getTranslationSystemPrompt({
                    domain: translationDomain,
                    dictionary: userDictionary
                }),
                userContent: buildMonotonicUserContent(chunk),
                signal: monoAbortController.signal,
                onUsage: recordApiUsage,
                onChunk: (currentText) => {
                    if (generation !== monoGeneration) return;
                    renderMonotonicTranslation(currentText);
                }
            });
            if (generation !== monoGeneration) return;
            monoTranslation = joinMonoTranslation(monoTranslation, result);
            monoTranslatedCount += 1;
            renderMonotonicTranslation('');
        } catch (error) {
            // 世代が進んでいればリセットによる中断（表示・状態は resetMonotonicState が処理済み）
            if (generation !== monoGeneration) return;
            // 世代一致のままの AbortError は translateStream 内部のタイムアウト
            console.error('順送り訳: チャンク翻訳エラー:', error);
            errorMessage.textContent = error.name === 'AbortError'
                ? '翻訳リクエストがタイムアウトしました。'
                : error.message;
            // 訳抜けは停止時の整形パスが原文全体と照合して回収するため、次のチャンクへ進む
            monoTranslatedCount += 1;
        } finally {
            if (generation === monoGeneration) {
                monoChunkInFlight = false;
                translationInProgress = false;
                translatingIndicator.classList.remove('visible');
                updateTranslatingState(false);
            }
        }
        if (generation === monoGeneration) {
            pumpMonotonicQueue();
        }
    }

    // 録音停止時: 遅延到着する確定結果を待ってから整形パスへ
    function scheduleMonotonicFinalize() {
        const generation = monoGeneration;
        setTimeout(() => {
            if (generation !== monoGeneration) return;
            monoFinalizePending = true;
            pumpMonotonicQueue();
        }, MONO_FINALIZE_DELAY_MS);
    }

    function maybeRunMonotonicRefine() {
        if (!monoFinalizePending || monoChunkInFlight || isRecording) return;
        if (monoTranslatedCount < monoSourceSegments.length) return;
        monoFinalizePending = false;

        const fullSource = monoSourceSegments.join(' ').trim();
        const draft = monoTranslation.trim();
        if (!fullSource || !draft) return;

        if (monoSourceSegments.length < 2) {
            // 単一チャンクはチャンク訳＝全文訳のため整形を省略（短い発話の応答を速く保つ）
            commitMonotonicResult(fullSource, draft);
            return;
        }
        runMonotonicRefine(fullSource, draft);
    }

    // 訳の確定処理（履歴保存・TTS用保存・自動読み上げ）。translateText完了時と同じ扱いに揃える
    function commitMonotonicResult(fullSource, finalTranslation) {
        monoTranslation = finalTranslation;
        translatedText.textContent = finalTranslation;
        lastTranslationResult = finalTranslation;
        updateTranslationBoxState(true);
        updateTranslationCompleteState(true);
        addConversationLogEntry(fullSource, finalTranslation, selectedLanguage);
        checkTranslationQuality(fullSource, finalTranslation, selectedLanguage, translationBox);
        if (autoSpeakArmed && !isRecording) {
            triggerAutoSpeak();
        }
    }

    // 整形パス: 原文全体と下書き訳を突き合わせ、誤訳・冗長・音の紛らわしさを修正する
    // （語順の骨格＝順送りは保持。プロンプトは PromptService.refinementSystemPrompt）
    async function runMonotonicRefine(fullSource, draft) {
        const generation = monoGeneration;
        monoRefineInFlight = true;
        translationInProgress = true;
        translatingIndicator.classList.add('visible');
        updateTranslatingState(true);
        try {
            monoAbortController = new AbortController();
            const sourceLabel = selectedLanguage === 'ja' ? '日本語' : 'ネパール語';
            const result = await window.TranslatorService.translateStream({
                apiKey: OPENAI_API_KEY,
                text: draft,
                sourceLanguage: selectedLanguage,
                systemPrompt: window.PromptService.getRefinementSystemPrompt({
                    domain: translationDomain,
                    dictionary: userDictionary
                }),
                userContent: `原文（${sourceLabel}）:\n${fullSource}\n\n下書き訳:\n${draft}\n\n方針に従って下書き訳を仕上げ、完成した訳文のみを出力してください。`,
                signal: monoAbortController.signal,
                onUsage: recordApiUsage,
                onChunk: (currentText) => {
                    if (generation !== monoGeneration) return;
                    translatedText.textContent = currentText;
                }
            });
            if (generation !== monoGeneration) return;
            const refined = (result || '').trim();
            commitMonotonicResult(fullSource, refined || draft);
        } catch (error) {
            // 世代が進んでいればリセットによる中断（表示・状態は resetMonotonicState が処理済み）
            if (generation !== monoGeneration) return;
            // 世代一致のままの AbortError は translateStream 内部のタイムアウト
            console.error('順送り訳: 整形パスエラー:', error);
            errorMessage.textContent = error.name === 'AbortError'
                ? '整形リクエストがタイムアウトしました。'
                : error.message;
            // 整形に失敗しても下書き訳を確定として使う（訳が消えるより良い）
            commitMonotonicResult(fullSource, draft);
        } finally {
            if (generation === monoGeneration) {
                monoRefineInFlight = false;
                translationInProgress = false;
                translatingIndicator.classList.remove('visible');
                updateTranslatingState(false);
                // 整形中に遅延到着したチャンクがあれば訳出→再整形する
                pumpMonotonicQueue();
            }
        }
    }

    // 異常終了検出: 前回セッションがフリーズ/強制終了で終わっていないか確認する。
    // 意図的な終了を異常扱いにしないため、pagehideに加えてvisibilitychange(hidden)でも
    // 記録を解除する（iOSではバックグラウンド中のOS強制終了や手動終了でpagehideが
    // 発火しないため。復帰後も録音中ならハートビートが5秒以内に記録を再開する）
    if (window.ErrorReporter) {
        window.ErrorReporter.checkPreviousSession();
        window.addEventListener('pagehide', () => {
            window.ErrorReporter.markSession(false);
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                window.ErrorReporter.markSession(false);
            }
        });
    }

    // アプリ初期化
    loadApiKeys();
});
