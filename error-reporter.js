// エラーレポートシステム
const ErrorReporter = {
    logs: [],
    maxLogs: 100,
    hasError: false,

    init: function() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            this.addLog('log', args);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            this.addLog('error', args);
            this.hasError = true;
            this.showReportButton();
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            this.addLog('warn', args);
            originalWarn.apply(console, args);
        };

        window.addEventListener('error', (event) => {
            this.addLog('error', [`グローバルエラー: ${event.message}`, event.filename, event.lineno]);
            this.hasError = true;
            this.showReportButton();
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.addLog('error', [`未処理のPromise拒否: ${event.reason}`]);
            this.hasError = true;
            this.showReportButton();
        });
    },

    safeSerialize: function(value) {
        if (typeof value === 'string') return value;
        const seen = new WeakSet();
        try {
            return JSON.stringify(value, (key, nestedValue) => {
                if (typeof nestedValue === 'object' && nestedValue !== null) {
                    if (seen.has(nestedValue)) return '[Circular]';
                    seen.add(nestedValue);
                }
                return nestedValue;
            });
        } catch (error) {
            return `[Unserializable: ${error.message}]`;
        }
    },

    sanitizeText: function(text) {
        return String(text)
            .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_OPENAI_KEY]')
            .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer [REDACTED_TOKEN]')
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
            .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '[REDACTED_UUID]');
    },

    sanitizeReport: function(report) {
        return {
            ...report,
            userAgent: this.sanitizeText(report.userAgent),
            platform: this.sanitizeText(report.platform),
            language: this.sanitizeText(report.language),
            url: this.sanitizeText(report.url),
            logs: report.logs.map(log => ({
                ...log,
                message: this.sanitizeText(log.message)
            }))
        };
    },

    addLog: function(level, args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' && arg !== null ? this.safeSerialize(arg) : String(arg)
        ).join(' ');

        this.logs.push({
            timestamp,
            level,
            message
        });

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    },

    // ボタンの自動消去タイマー（ms）。出しっぱなしを防ぐ
    reportButtonTimeoutMs: 30000,
    reportButtonTimer: null,

    showReportButton: function() {
        const existingContainer = document.getElementById('errorReportButton');
        if (existingContainer) {
            // 既に表示中なら自動消去タイマーだけ延長（新しいエラーが続いている）
            this.scheduleReportButtonHide();
            return;
        }

        const container = document.createElement('div');
        container.id = 'errorReportButton';
        container.className = 'error-report-button';
        container.setAttribute('role', 'alert');

        const reportButton = document.createElement('button');
        reportButton.type = 'button';
        reportButton.className = 'error-report-button-main';
        reportButton.textContent = '⚠️ エラーを報告';
        reportButton.onclick = () => {
            this.hideReportButton();
            this.generateReport();
        };

        const dismissButton = document.createElement('button');
        dismissButton.type = 'button';
        dismissButton.className = 'error-report-button-dismiss';
        dismissButton.textContent = '×';
        dismissButton.setAttribute('aria-label', 'エラー報告ボタンを閉じる');
        dismissButton.onclick = (e) => {
            e.stopPropagation();
            this.hideReportButton();
        };

        container.append(reportButton, dismissButton);
        document.body.appendChild(container);

        // 一定時間操作がなければ自動で消す（新しいエラーが出れば再表示される）
        this.scheduleReportButtonHide();
    },

    scheduleReportButtonHide: function() {
        if (this.reportButtonTimer) {
            clearTimeout(this.reportButtonTimer);
        }
        this.reportButtonTimer = setTimeout(() => {
            this.hideReportButton();
        }, this.reportButtonTimeoutMs);
    },

    hideReportButton: function() {
        if (this.reportButtonTimer) {
            clearTimeout(this.reportButtonTimer);
            this.reportButtonTimer = null;
        }
        const container = document.getElementById('errorReportButton');
        if (container) {
            container.remove();
        }
        // 次のエラーで再表示できるように状態をリセット
        this.hasError = false;
    },

    generateReport: function() {
        const report = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            url: window.location.href,
            logs: this.logs.slice(-50)
        };

        this.showReportModal(this.sanitizeReport(report));
    },

    showReportModal: function(report) {
        const modal = document.createElement('div');
        modal.className = 'error-report-modal';

        const content = document.createElement('div');
        content.className = 'error-report-content';

        const title = document.createElement('h2');
        title.textContent = 'エラーレポート';

        const description = document.createElement('p');
        description.textContent = '以下の内容が報告されます：';

        const textarea = document.createElement('textarea');
        textarea.readOnly = true;
        textarea.value = JSON.stringify(report, null, 2);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'error-report-buttons';

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.textContent = 'コピー';

        const sendButton = document.createElement('button');
        sendButton.type = 'button';
        sendButton.textContent = this.getReportToken() ? '報告を送信' : 'GitHubで報告';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'キャンセル';

        buttonRow.append(copyButton, sendButton, closeButton);
        content.append(title, description, textarea, buttonRow);
        modal.appendChild(content);

        document.body.appendChild(modal);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(report, null, 2));
            alert('レポートをクリップボードにコピーしました');
        });

        sendButton.addEventListener('click', async () => {
            const token = this.getReportToken();
            if (!token) {
                this.openGitHubIssue(report);
                return;
            }
            sendButton.disabled = true;
            sendButton.textContent = '送信中...';
            try {
                const issueUrl = await this.sendToGitHub(report, token);
                alert('エラーレポートを送信しました。ご協力ありがとうございます。\n' + issueUrl);
                modal.remove();
            } catch (error) {
                sendButton.disabled = false;
                sendButton.textContent = '報告を送信';
                alert('送信に失敗しました。「コピー」でレポートを控えてから、再度お試しください。\n' +
                    (error && error.message ? error.message : error));
            }
        });

        closeButton.addEventListener('click', () => {
            modal.remove();
        });
    },

    analyzeErrorType: function(logs) {
        const errorMessages = logs
            .filter(log => log.level === 'error' || log.level === 'warn')
            .map(log => log.message.toLowerCase());

        const allMessages = errorMessages.join(' ');

        const patterns = {
            microphone: {
                keywords: ['マイク', 'microphone', '音声認識', 'recognition', 'audio-capture', 'not-allowed', 'permission', '再起動', 'restart'],
                priority: 1
            },
            tts: {
                keywords: ['tts', 'speech synthesis', 'speechsynthesis', '音声合成', '読み上げ', 'utterance', 'speak'],
                priority: 2
            },
            translation: {
                keywords: ['翻訳', 'translation', 'openai', 'api', 'gpt', 'completions', '401', '429', 'rate limit'],
                priority: 3
            },
            network: {
                keywords: ['network', 'fetch', 'http', 'connection', 'ネットワーク', 'failed to fetch', 'cors'],
                priority: 4
            },
            timeout: {
                keywords: ['timeout', 'タイムアウト', '応答なし', '30秒', 'no response'],
                priority: 5
            }
        };

        let bestMatch = { category: 'other', score: 0, keywords: [] };

        for (const [category, config] of Object.entries(patterns)) {
            const matchedKeywords = config.keywords.filter(keyword =>
                allMessages.includes(keyword)
            );

            if (matchedKeywords.length > bestMatch.score) {
                bestMatch = {
                    category: category,
                    score: matchedKeywords.length,
                    keywords: matchedKeywords,
                    priority: config.priority
                };
            } else if (matchedKeywords.length === bestMatch.score && config.priority < bestMatch.priority) {
                bestMatch = {
                    category: category,
                    score: matchedKeywords.length,
                    keywords: matchedKeywords,
                    priority: config.priority
                };
            }
        }

        return bestMatch;
    },

    generateErrorTitle: function(category) {
        const titles = {
            microphone: 'エラーレポート: マイク/音声認識の問題',
            tts: 'エラーレポート: TTS（音声読み上げ）の問題',
            translation: 'エラーレポート: 翻訳APIの問題',
            network: 'エラーレポート: ネットワーク接続の問題',
            timeout: 'エラーレポート: タイムアウト・応答なしの問題',
            other: 'エラーレポート: アプリケーションエラー'
        };

        return titles[category] || titles.other;
    },

    buildIssueContent: function(report) {
        const safeReport = this.sanitizeReport(report);
        const errorAnalysis = this.analyzeErrorType(safeReport.logs);
        const title = this.generateErrorTitle(errorAnalysis.category);
        const analysisSection = errorAnalysis.category !== 'other'
            ? `**エラー分類**: ${errorAnalysis.category}\n**検出キーワード**: ${errorAnalysis.keywords.join(', ')}\n\n`
            : '';

        const isNativeApp = Boolean(window.__BRIDGE_TTS_NATIVE_APP__);
        const body =
            `## エラーレポート\n\n` +
            `**発生日時**: ${safeReport.timestamp}\n\n` +
            analysisSection +
            `**環境情報**:\n` +
            `- 実行環境: ${isNativeApp ? 'iOSネイティブアプリ' : 'ブラウザ/PWA'}\n` +
            `- ブラウザ: ${safeReport.userAgent}\n` +
            `- プラットフォーム: ${safeReport.platform}\n` +
            `- 言語: ${safeReport.language}\n` +
            `- 画面サイズ: ${safeReport.screenSize}\n\n` +
            `**ログ**:\n\`\`\`json\n${JSON.stringify(safeReport.logs, null, 2)}\n\`\`\`\n\n` +
            `**再現手順**:\n` +
            `1. \n` +
            `2. \n` +
            `3. \n\n` +
            `**期待される動作**:\n\n` +
            `**実際の動作**:\n`;

        return { title: title, body: body };
    },

    getReportToken: function() {
        try {
            const config = window.__ERROR_REPORT_CONFIG__;
            if (config && typeof config.t === 'string' && config.t) {
                return atob(config.t);
            }
        } catch (error) {
            // 設定が壊れている場合はフォールバック動作にする
        }
        return '';
    },

    sendToGitHub: async function(report, token) {
        const content = this.buildIssueContent(report);
        const response = await fetch('https://api.github.com/repos/AichiroFunakoshi/Bridge-TTS-Codex-/issues', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: content.title,
                body: content.body,
                labels: ['error-report']
            })
        });
        if (!response.ok) {
            throw new Error('GitHub APIエラー: HTTP ' + response.status);
        }
        const issue = await response.json();
        return issue.html_url;
    },

    openGitHubIssue: function(report) {
        const content = this.buildIssueContent(report);
        const issueUrl = 'https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/issues/new' +
            `?title=${encodeURIComponent(content.title)}&body=${encodeURIComponent(content.body)}`;
        window.open(issueUrl, '_blank');
    }
};

ErrorReporter.init();
