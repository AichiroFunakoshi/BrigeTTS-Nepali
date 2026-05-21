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

    addLog: function(level, args) {
        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
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

    showReportButton: function() {
        const existingButton = document.getElementById('errorReportButton');
        if (existingButton) return;

        const button = document.createElement('button');
        button.id = 'errorReportButton';
        button.className = 'error-report-button';
        button.innerHTML = '⚠️ エラーを報告';
        button.onclick = () => this.generateReport();
        document.body.appendChild(button);
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

        this.showReportModal(report);
    },

    showReportModal: function(report) {
        const modal = document.createElement('div');
        modal.className = 'error-report-modal';
        modal.innerHTML = `
            <div class="error-report-content">
                <h2>エラーレポート</h2>
                <p>以下の内容が報告されます：</p>
                <textarea readonly>${JSON.stringify(report, null, 2)}</textarea>
                <div class="error-report-buttons">
                    <button id="copyReportBtn">コピー</button>
                    <button id="sendReportBtn">GitHubで報告</button>
                    <button id="closeReportBtn">キャンセル</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('copyReportBtn').onclick = () => {
            navigator.clipboard.writeText(JSON.stringify(report, null, 2));
            alert('レポートをクリップボードにコピーしました');
        };

        document.getElementById('sendReportBtn').onclick = () => {
            this.openGitHubIssue(report);
        };

        document.getElementById('closeReportBtn').onclick = () => {
            modal.remove();
        };
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

    openGitHubIssue: function(report) {
        const errorAnalysis = this.analyzeErrorType(report.logs);
        const title = this.generateErrorTitle(errorAnalysis.category);
        const analysisSection = errorAnalysis.category !== 'other'
            ? `**エラー分類**: ${errorAnalysis.category}\n**検出キーワード**: ${errorAnalysis.keywords.join(', ')}\n\n`
            : '';

        const encodedTitle = encodeURIComponent(title);
        const body = encodeURIComponent(
            `## エラーレポート\n\n` +
            `**発生日時**: ${report.timestamp}\n\n` +
            analysisSection +
            `**環境情報**:\n` +
            `- ブラウザ: ${report.userAgent}\n` +
            `- プラットフォーム: ${report.platform}\n` +
            `- 言語: ${report.language}\n` +
            `- 画面サイズ: ${report.screenSize}\n\n` +
            `**ログ**:\n\`\`\`json\n${JSON.stringify(report.logs, null, 2)}\n\`\`\`\n\n` +
            `**再現手順**:\n` +
            `1. \n` +
            `2. \n` +
            `3. \n\n` +
            `**期待される動作**:\n\n` +
            `**実際の動作**:\n`
        );

        const issueUrl = `https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/issues/new?title=${encodedTitle}&body=${body}`;
        window.open(issueUrl, '_blank');
    }
};

ErrorReporter.init();
