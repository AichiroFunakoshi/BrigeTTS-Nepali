// Web Speech APIを使ったTTS再生管理
const TtsService = {
    initialized: false,
    playing: false,
    currentUtterance: null,
    voices: [],

    isSupported: function() {
        return 'speechSynthesis' in window;
    },

    isInitialized: function() {
        return this.initialized;
    },

    isPlaying: function() {
        return this.playing;
    },

    loadVoices: function() {
        if (!this.isSupported()) {
            console.warn('speechSynthesis APIが利用できません');
            this.voices = [];
            return;
        }

        this.voices = window.speechSynthesis.getVoices();
        console.log('利用可能な音声:', this.voices.length, '件');
    },

    bindVoiceChanges: function() {
        if (!this.isSupported()) {
            console.warn('このブラウザはTTSに対応していません');
            return;
        }

        this.loadVoices();
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    },

    initializeForIOS: function() {
        if (this.initialized || !this.isSupported()) return;

        console.log('iOS Safari用TTS初期化を実行');
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
        this.initialized = true;
        console.log('TTS初期化完了');
    },

    isPremiumVoice: function(voice) {
        if (!voice || !voice.name) {
            return false;
        }

        const name = voice.name.toLowerCase();
        return name.includes('enhanced') ||
               name.includes('premium') ||
               name.includes('拡張') ||
               name.includes('siri') ||
               name.includes('o-ren') ||
               name.includes('hattori') ||
               name.includes('ayumi');
    },

    getBestVoiceForLanguage: function(langCode, preferredVoiceName) {
        if (!langCode || typeof langCode !== 'string') {
            console.warn('無効な言語コード:', langCode);
            return null;
        }

        if (this.voices.length === 0) {
            this.loadVoices();
        }

        const langPrefix = langCode.split('-')[0];
        const isJapanese = langPrefix === 'ja';

        // ユーザーが設定で明示的に選択した音声を最優先する
        if (preferredVoiceName) {
            const preferred = this.voices.find((voice) =>
                voice.name === preferredVoiceName && voice.lang.startsWith(langPrefix)
            );
            if (preferred) {
                console.log('音声選択（ユーザー指定）:', preferred.name, preferred.lang);
                return preferred;
            }
            console.warn('指定された音声が見つからないため自動選択します:', preferredVoiceName);
        }

        if (isJapanese) {
            const premiumVoice = this.voices.find((voice) =>
                voice.lang.startsWith('ja') && this.isPremiumVoice(voice)
            );
            if (premiumVoice) {
                console.log('音声選択（日本語・高品質）:', premiumVoice.name, premiumVoice.lang);
                return premiumVoice;
            }
        }

        let voice = this.voices.find((candidate) => candidate.lang === langCode && candidate.localService);
        if (voice) {
            console.log('音声選択（完全一致・ローカル）:', voice.name, voice.lang);
            return voice;
        }

        voice = this.voices.find((candidate) => candidate.lang.startsWith(langPrefix) && candidate.localService);
        if (voice) {
            console.log('音声選択（プレフィックス一致・ローカル）:', voice.name, voice.lang);
            return voice;
        }

        voice = this.voices.find((candidate) => candidate.lang === langCode);
        if (voice) {
            console.log('音声選択（完全一致）:', voice.name, voice.lang);
            return voice;
        }

        voice = this.voices.find((candidate) => candidate.lang.startsWith(langPrefix));
        if (voice) {
            console.log('音声選択（プレフィックス一致）:', voice.name, voice.lang);
            return voice;
        }

        console.warn('適切な音声が見つかりません:', langCode);
        return null;
    },

    speak: function({ text, sourceLanguage, enabled, speed, preferredVoiceName, onBeforeSpeak, onStart, onEnd, onError, onPlayingChange }) {
        console.log('speakTranslation呼び出し:', {
            text: text ? text.substring(0, 50) + '...' : 'null',
            language: sourceLanguage,
            isTTSEnabled: enabled,
            ttsInitialized: this.initialized,
            speechSynthesisAvailable: this.isSupported()
        });

        if (!enabled) {
            console.log('TTS無効: isTTSEnabled = false');
            return;
        }

        if (!text || !text.trim()) {
            console.log('TTS無効: テキストが空');
            return;
        }

        if (!this.isSupported()) {
            console.warn('このブラウザはWeb Speech API (TTS)に対応していません');
            return;
        }

        if (!this.initialized) {
            console.warn('TTS未初期化: ユーザー操作時に初期化されていません');
            this.initializeForIOS();
        }

        if (window.speechSynthesis.speaking) {
            console.log('前のTTS再生を停止');
            window.speechSynthesis.cancel();
        }

        this.playing = true;
        if (typeof onPlayingChange === 'function') {
            onPlayingChange(true);
        }
        if (typeof onBeforeSpeak === 'function') {
            onBeforeSpeak();
        }

        const isNativeApp = Boolean(window.__BRIDGE_TTS_NATIVE_APP__);

        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = sourceLanguage === 'ja' ? 'ne-NP' : 'ja-JP';
        utterance.lang = targetLang;

        const selectedVoice = this.getBestVoiceForLanguage(targetLang, preferredVoiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        console.log('TTS設定:', {
            lang: utterance.lang,
            voice: selectedVoice ? selectedVoice.name : 'デフォルト',
            textLength: text.length
        });

        utterance.rate = speed;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
            console.log('✓ TTS再生開始:', sourceLanguage === 'ja' ? 'ネパール語' : '日本語');
            if (typeof onStart === 'function') {
                onStart();
            }
        };

        utterance.onend = () => {
            console.log('✓ TTS再生終了');
            this.currentUtterance = null;
            this.playing = false;
            if (typeof onPlayingChange === 'function') {
                onPlayingChange(false);
            }
            if (typeof onEnd === 'function') {
                onEnd();
            }
        };

        utterance.onerror = (event) => {
            console.error('✗ TTS再生エラー:', event.error, event);
            this.currentUtterance = null;
            this.playing = false;
            if (typeof onPlayingChange === 'function') {
                onPlayingChange(false);
            }
            if (typeof onError === 'function') {
                onError(event);
            }
        };

        this.currentUtterance = utterance;

        const startSpeaking = () => {
            // 開始前に停止/別の再生に置き換えられていたら何もしない
            if (this.currentUtterance !== utterance) {
                return;
            }
            console.log('window.speechSynthesis.speak() を呼び出し');
            window.speechSynthesis.speak(utterance);
        };

        if (isNativeApp && typeof window.__bridgeNativePrepareTTS === 'function') {
            // ネイティブアプリ: 録音用オーディオセッションのままTTSを始めると
            // 冒頭がフェードイン/欠落するため、再生用セッションへの切替完了を
            // 待ってから発話を開始する（通知が来ない場合は300msで開始）。
            // 以前の「無音ウォームアップ発話」方式は約1秒の遅延があったため廃止。
            // さらに、切替通知の直後は出力経路がまだ安定せず最初の語
            // （"the" 等の短い語）が欠けることがあるため、150ms置いてから発話する。
            let started = false;
            const startOnce = () => {
                if (started) return;
                started = true;
                clearTimeout(fallbackTimer);
                setTimeout(startSpeaking, 150);
            };
            const fallbackTimer = setTimeout(startOnce, 300);
            window.__bridgeNativePrepareTTS(startOnce);
        } else {
            startSpeaking();
        }

        setTimeout(() => {
            console.log('TTS状態確認:', {
                speaking: window.speechSynthesis.speaking,
                pending: window.speechSynthesis.pending,
                paused: window.speechSynthesis.paused
            });
        }, 100);
    },

    stop: function({ onPlayingChange } = {}) {
        if (this.isSupported()) {
            window.speechSynthesis.cancel();
        }

        this.currentUtterance = null;
        this.playing = false;
        if (typeof onPlayingChange === 'function') {
            onPlayingChange(false);
        }
        console.log('TTS停止');
    }
};

window.TtsService = TtsService;
