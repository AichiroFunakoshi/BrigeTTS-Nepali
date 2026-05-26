// ブラウザローカル設定の読み書き
const AppSettingsStorage = {
    keys: {
        openaiKey: 'translatorOpenaiKey',
        ttsEnabled: 'translatorTTSEnabled',
        ttsSpeed: 'translatorTTSSpeed',
        fontSize: 'translatorFontSize',
        debounceData: 'translatorDebounceData',
        optimizedDebounce: 'translatorOptimizedDebounce',
        debounceOptimizedAt: 'translatorDebounceOptimizedAt'
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
        return this.getString(this.keys.fontSize, defaultValue);
    },

    setFontSize: function(value) {
        this.setString(this.keys.fontSize, value);
    },

    getJson: function(key, fallback = null) {
        const value = localStorage.getItem(key);
        if (!value) return fallback;

        try {
            return JSON.parse(value);
        } catch (error) {
            console.error('設定JSONの読み込みに失敗:', key, error);
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
    }
};

window.AppSettingsStorage = AppSettingsStorage;
