// ブラウザローカル設定の読み書き
const AppSettingsStorage = {
    keys: {
        openaiKey: 'translatorOpenaiKey',
        ttsEnabled: 'translatorTTSEnabled',
        autoTtsEnabled: 'translatorAutoTTSEnabled',
        ttsSpeed: 'translatorTTSSpeed',
        fontSize: 'translatorFontSize',
        debounceData: 'translatorDebounceData',
        optimizedDebounce: 'translatorOptimizedDebounce',
        debounceOptimizedAt: 'translatorDebounceOptimizedAt',
        theme: 'translatorTheme',
        conversationLog: 'translatorConversationLog',
        translationDomain: 'translatorTranslationDomain',
        userDictionary: 'translatorUserDictionary'
    },

    fontSizeValues: ['small', 'medium', 'large', 'xlarge'],
    themeValues: ['auto', 'light', 'dark'],
    domainValues: ['medical', 'daily'],

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

    getUserDictionary: function() {
        const entries = this.getJson(this.keys.userDictionary, []);
        if (!Array.isArray(entries)) return [];
        return entries.filter((entry) =>
            entry && typeof entry.surface === 'string' && entry.surface.trim() !== ''
        ).map((entry) => ({
            reading: typeof entry.reading === 'string' ? entry.reading : '',
            surface: entry.surface,
            english: typeof entry.english === 'string' ? entry.english : ''
        }));
    },

    setUserDictionary: function(entries) {
        this.setJson(this.keys.userDictionary, Array.isArray(entries) ? entries : []);
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
