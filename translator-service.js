// OpenAI翻訳APIとの通信とストリーミング解析
const TranslatorService = {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-nano',

    getSourceLanguageLabel: function(sourceLanguage) {
        return sourceLanguage === 'ja' ? '日本語' : '英語';
    },

    createPayload: function({ text, sourceLanguage, systemPrompt }) {
        return {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `以下の${this.getSourceLanguageLabel(sourceLanguage)}テキストを翻訳してください:\n\n${text}`
                }
            ],
            stream: true,
            temperature: 0.3
        };
    },

    createErrorFromResponse: async function(response) {
        let errorData = null;
        try {
            errorData = await response.json();
        } catch (error) {
            errorData = { error: { message: `HTTPエラー: ${response.status}` } };
        }

        console.error('OpenAI APIエラー:', errorData);
        const errorCode = errorData?.error?.code;
        if (errorCode === 'insufficient_quota') {
            return new Error('APIキーのクォータ（利用上限）を超えました。OpenAIのダッシュボードで残高・プランを確認し、APIキーを更新してください。');
        }

        return new Error(errorData?.error?.message || `OpenAI APIがステータスを返しました: ${response.status}`);
    },

    translateStream: async function({ apiKey, text, sourceLanguage, systemPrompt, signal, onChunk }) {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + String(apiKey).trim()
            },
            body: JSON.stringify(this.createPayload({ text, sourceLanguage, systemPrompt })),
            signal: signal
        });

        if (!response.ok) {
            throw await this.createErrorFromResponse(response);
        }

        if (!response.body) {
            throw new Error('OpenAI APIのストリーミングレスポンスを読み取れませんでした。');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let translationResult = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const content = this.parseStreamLine(line);
                if (!content) continue;

                translationResult += content;
                if (typeof onChunk === 'function') {
                    onChunk(translationResult, content);
                }
            }
        }

        buffer += decoder.decode();
        const remainingContent = this.parseStreamLine(buffer);
        if (remainingContent) {
            translationResult += remainingContent;
            if (typeof onChunk === 'function') {
                onChunk(translationResult, remainingContent);
            }
        }

        return translationResult;
    },

    parseStreamLine: function(line) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') {
            return '';
        }

        try {
            const data = JSON.parse(line.substring(6));
            return data.choices?.[0]?.delta?.content || '';
        } catch (error) {
            console.error('ストリーミングレスポンス解析エラー:', error);
            return '';
        }
    }
};

window.TranslatorService = TranslatorService;
