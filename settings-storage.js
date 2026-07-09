// ブラウザローカル設定の読み書き
const AppSettingsStorage = {
    keys: {
        openaiKey: 'translatorOpenaiKey',
        ttsEnabled: 'translatorTTSEnabled',
        autoTtsEnabled: 'translatorAutoTTSEnabled',
        ttsSpeed: 'translatorTTSSpeed',
        ttsVoiceJa: 'translatorTTSVoiceJa',
        fontSize: 'translatorFontSize',
        debounceData: 'translatorDebounceData',
        optimizedDebounce: 'translatorOptimizedDebounce',
        debounceOptimizedAt: 'translatorDebounceOptimizedAt',
        theme: 'translatorTheme',
        conversationLog: 'translatorConversationLog',
        translationDomain: 'translatorTranslationDomain',
        translationStrategy: 'translatorTranslationStrategy',
        userDictionary: 'translatorUserDictionary',
        latencyData: 'translatorLatencyData',
        usageTotals: 'translatorUsageTotals'
    },

    fontSizeValues: ['small', 'medium', 'large', 'xlarge'],
    themeValues: ['auto', 'light', 'dark'],
    domainValues: ['medical', 'daily'],
    strategyValues: ['retranslation', 'monotonic'],

    normalizeFontSize: function(value, fallback = 'medium') {
        const normalizedFallback = this.fontSizeValues.includes(String(fallback).trim().toLowerCase())
            ? String(fallback).trim().toLowerCase()
            : 'medium';
        const normalizedValue = String(value).trim().toLowerCase();
        return this.fontSizeValues.includes(normalizedValue) ? normalizedValue : normalizedFallback;
    },

    getString: function(key, fallback = '') {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    },

    setString: function(key, value) {
        localStorage.setItem(key, String(value));
    },

    remove: function(key) {
        localStorage.removeItem(key);
    },

    getOpenaiKey: function() {
        return this.getString(this.keys.openaiKey).trim();
    },

    setOpenaiKey: function(value) {
        this.setString(this.keys.openaiKey, String(value).trim());
    },

    clearApiSettings: function() {
        this.remove(this.keys.openaiKey);
        this.remove(this.keys.ttsEnabled);
    },

    getTtsEnabled: function(defaultValue = true) {
        const value = localStorage.getItem(this.keys.ttsEnabled);
        return value === null ? defaultValue : value === 'true';
    },

    setTtsEnabled: function(value) {
        this.setString(this.keys.ttsEnabled, Boolean(value));
    },

    getAutoTtsEnabled: function(defaultValue = false) {
        const value = localStorage.getItem(this.keys.autoTtsEnabled);
        return value === null ? defaultValue : value === 'true';
    },

    setAutoTtsEnabled: function(value) {
        this.setString(this.keys.autoTtsEnabled, Boolean(value));
    },

    getTtsSpeed: function(defaultValue, minValue, maxValue) {
        const value = localStorage.getItem(this.keys.ttsSpeed);
        if (value === null) return defaultValue;

        const parsed = parseFloat(value);
        if (Number.isNaN(parsed) || parsed < minValue || parsed > maxValue) {
            this.setTtsSpeed(defaultValue);
            return defaultValue;
        }

        return parsed;
    },

    setTtsSpeed: function(value) {
        this.setString(this.keys.ttsSpeed, value);
    },

    // 日本語読み上げ音声のユーザー指定（音声名）。空文字=自動選択。
    // 端末ごとに利用可能な音声が異なるためエクスポート対象には含めない。
    getTtsVoiceJa: function() {
        return this.getString(this.keys.ttsVoiceJa, '').trim();
    },

    setTtsVoiceJa: function(value) {
        this.setString(this.keys.ttsVoiceJa, String(value).trim());
    },

    getFontSize: function(defaultValue = 'medium') {
        const fallback = this.normalizeFontSize(defaultValue);
        const savedValue = localStorage.getItem(this.keys.fontSize);
        if (savedValue === null) return fallback;

        const normalizedValue = this.normalizeFontSize(savedValue, fallback);
        if (normalizedValue !== savedValue) {
            this.setFontSize(normalizedValue);
        }

        return normalizedValue;
    },

    setFontSize: function(value) {
        this.setString(this.keys.fontSize, this.normalizeFontSize(value));
    },

    getJson: function(key, fallback = null) {
        const value = localStorage.getItem(key);
        if (!value) return fallback;

        try {
            return JSON.parse(value);
        } catch (error) {
            console.error('設定JSONの読み込みに失敗:', key, error);
            this.remove(key);
            return fallback;
        }
    },

    setJson: function(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    getDebounceData: function() {
        return this.getJson(this.keys.debounceData, null);
    },

    setDebounceData: function(value) {
        this.setJson(this.keys.debounceData, value);
    },

    clearDebounceData: function() {
        this.remove(this.keys.debounceData);
    },

    getOptimizedDebounce: function() {
        return this.getJson(this.keys.optimizedDebounce, null);
    },

    setOptimizedDebounce: function(value) {
        this.setJson(this.keys.optimizedDebounce, value);
    },

    clearOptimizedDebounce: function() {
        this.remove(this.keys.optimizedDebounce);
        this.remove(this.keys.debounceOptimizedAt);
    },

    getDebounceOptimizedAt: function() {
        return this.getString(this.keys.debounceOptimizedAt, null);
    },

    setDebounceOptimizedAt: function(value) {
        this.setString(this.keys.debounceOptimizedAt, value);
    },

    getTheme: function(defaultValue = 'auto') {
        const value = localStorage.getItem(this.keys.theme);
        return this.themeValues.includes(value) ? value : defaultValue;
    },

    setTheme: function(value) {
        this.setString(this.keys.theme, this.themeValues.includes(value) ? value : 'auto');
    },

    getTranslationDomain: function(defaultValue = 'medical') {
        const value = localStorage.getItem(this.keys.translationDomain);
        return this.domainValues.includes(value) ? value : defaultValue;
    },

    setTranslationDomain: function(value) {
        this.setString(this.keys.translationDomain, this.domainValues.includes(value) ? value : 'medical');
    },

    // 翻訳方式: 'monotonic'（順送り＝石畳方式・既定） / 'retranslation'（標準・全文再翻訳＝フォールバック）
    // v2.9.3（#73第1段階）で既定を順送りに反転。保存済みの設定は尊重する（未設定のみ新既定を適用）
    getTranslationStrategy: function(defaultValue = 'monotonic') {
        const value = localStorage.getItem(this.keys.translationStrategy);
        return this.strategyValues.includes(value) ? value : defaultValue;
    },

    setTranslationStrategy: function(value) {
        this.setString(this.keys.translationStrategy, this.strategyValues.includes(value) ? value : 'monotonic');
    },

    getUserDictionary: function() {
        const entries = this.getJson(this.keys.userDictionary, []);
        if (!Array.isArray(entries)) return [];
        return entries.filter((entry) =>
            entry && typeof entry.surface === 'string' && entry.surface.trim() !== ''
        ).map((entry) => ({
            reading: typeof entry.reading === 'string' ? entry.reading : '',
            surface: entry.surface,
            english: typeof entry.english === 'string' ? entry.english : '',
            // 誤認識パターン: 音声認識がこの語に書き起こしがちな別表記
            // （例: 禄寿園に対する「60円」）。翻訳前にsurfaceへ決定的に置換される。
            aliases: Array.isArray(entry.aliases)
                ? entry.aliases
                    .filter((alias) => typeof alias === 'string' && alias.trim() !== '')
                    .map((alias) => alias.trim())
                : []
        }));
    },

    setUserDictionary: function(entries) {
        this.setJson(this.keys.userDictionary, Array.isArray(entries) ? entries : []);
    },

    // レイテンシ計測（F12）: {o: 訳出開始ms, d: 確定ms, t: 記録時刻} の配列
    getLatencyData: function() {
        const entries = this.getJson(this.keys.latencyData, []);
        if (!Array.isArray(entries)) return [];
        return entries.filter((entry) =>
            entry && typeof entry.o === 'number' && typeof entry.d === 'number'
        );
    },

    setLatencyData: function(entries) {
        this.setJson(this.keys.latencyData, Array.isArray(entries) ? entries : []);
    },

    clearLatencyData: function() {
        this.remove(this.keys.latencyData);
    },

    // API使用量の累計（F15: 使用量の可視化）
    getUsageTotals: function() {
        const totals = this.getJson(this.keys.usageTotals, null);
        if (totals && typeof totals.inTokens === 'number' && typeof totals.outTokens === 'number') {
            return {
                inTokens: totals.inTokens,
                cachedTokens: typeof totals.cachedTokens === 'number' ? totals.cachedTokens : 0,
                outTokens: totals.outTokens,
                since: totals.since || Date.now()
            };
        }
        return { inTokens: 0, cachedTokens: 0, outTokens: 0, since: Date.now() };
    },

    setUsageTotals: function(totals) {
        this.setJson(this.keys.usageTotals, totals);
    },

    clearUsageTotals: function() {
        this.remove(this.keys.usageTotals);
    },

    // 設定の一括エクスポート/インポート（APIキーと会話履歴は意図的に含めない）
    exportableKeys: ['ttsEnabled', 'autoTtsEnabled', 'ttsSpeed', 'fontSize', 'theme',
        'translationDomain', 'translationStrategy', 'userDictionary',
        'debounceData', 'optimizedDebounce', 'debounceOptimizedAt'],

    exportSettings: function() {
        const data = {};
        this.exportableKeys.forEach((name) => {
            const raw = localStorage.getItem(this.keys[name]);
            if (raw !== null) {
                data[name] = raw;
            }
        });
        return JSON.stringify({
            app: 'BridgeTTS',
            type: 'settings-export',
            formatVersion: 1,
            exportedAt: new Date().toISOString(),
            data: data
        });
    },

    importSettings: function(jsonText, options) {
        const dryRun = Boolean(options && options.dryRun);
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (error) {
            return { ok: false, error: 'JSONとして読み取れません' };
        }
        if (!parsed || parsed.app !== 'BridgeTTS' || parsed.type !== 'settings-export' ||
            typeof parsed.data !== 'object' || parsed.data === null) {
            return { ok: false, error: 'BridgeTTSの設定エクスポートではありません' };
        }
        let count = 0;
        this.exportableKeys.forEach((name) => {
            if (typeof parsed.data[name] === 'string') {
                if (!dryRun) {
                    localStorage.setItem(this.keys[name], parsed.data[name]);
                }
                count++;
            }
        });
        if (count === 0) {
            return { ok: false, error: '取り込める設定が含まれていません' };
        }
        return { ok: true, count: count };
    },

    getConversationLog: function() {
        const entries = this.getJson(this.keys.conversationLog, []);
        if (!Array.isArray(entries)) return [];

        return entries.filter((entry) =>
            entry && typeof entry === 'object' &&
            typeof entry.original === 'string' && entry.original.trim() !== '' &&
            typeof entry.translation === 'string' && entry.translation.trim() !== '' &&
            (entry.sourceLanguage === 'ja' || entry.sourceLanguage === 'en')
        );
    },

    setConversationLog: function(entries) {
        this.setJson(this.keys.conversationLog, Array.isArray(entries) ? entries : []);
    },

    clearConversationLog: function() {
        this.remove(this.keys.conversationLog);
    }
};

window.AppSettingsStorage = AppSettingsStorage;
