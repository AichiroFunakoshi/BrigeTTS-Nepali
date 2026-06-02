const { test, expect } = require('@playwright/test');

test('loads app shell and core browser modules', async ({ page }) => {
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });
    page.on('requestfailed', (request) => {
        failedRequests.push(request.url());
    });

    const response = await page.goto('/', { waitUntil: 'networkidle' });

    expect(response.status()).toBe(200);
    await expect(page.locator('.app-title')).toHaveText('Bridge(Ver.4.1-nano)');
    await expect(page.locator('#startJapaneseBtn')).toBeVisible();
    await expect(page.locator('#startEnglishBtn')).toBeVisible();
    await expect(page.locator('#translationBox')).toBeVisible();

    await expect(page.locator('#apiModal')).toBeVisible();
    await expect(page.locator('#openaiKey')).toBeVisible();

    const modules = await page.evaluate(() => ({
        settingsStorage: Boolean(window.AppSettingsStorage),
        promptService: Boolean(window.PromptService && typeof window.PromptService.getTranslationSystemPrompt === 'function'),
        translatorService: Boolean(window.TranslatorService && typeof window.TranslatorService.translateStream === 'function'),
        ttsService: Boolean(window.TtsService && typeof window.TtsService.speak === 'function')
    }));

    expect(modules).toEqual({
        settingsStorage: true,
        promptService: true,
        translatorService: true,
        ttsService: true
    });
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
});

test('loads the default translation prompt rules', async ({ page }) => {
    await page.goto('/');

    const prompt = await page.evaluate(() => window.PromptService.getTranslationSystemPrompt());

    expect(prompt).toContain('日本語の場合は英語');
    expect(prompt).toContain('英語の場合は日本語');
    expect(prompt).toContain('フィラー');
    expect(prompt).toContain('翻訳のみを出力');
});

test('parses translator service stream lines and payloads', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
        const contentLine = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
        const payload = window.TranslatorService.createPayload({
            text: 'こんにちは',
            sourceLanguage: 'ja',
            systemPrompt: 'system prompt'
        });

        return {
            content: window.TranslatorService.parseStreamLine(contentLine),
            done: window.TranslatorService.parseStreamLine('data: [DONE]'),
            ignored: window.TranslatorService.parseStreamLine('event: ping'),
            invalidJson: window.TranslatorService.parseStreamLine('data: {broken'),
            model: payload.model,
            stream: payload.stream,
            temperature: payload.temperature,
            systemPrompt: payload.messages[0].content,
            userPrompt: payload.messages[1].content
        };
    });

    expect(result).toEqual({
        content: 'Hello',
        done: '',
        ignored: '',
        invalidJson: '',
        model: 'gpt-4.1-nano',
        stream: true,
        temperature: 0.3,
        systemPrompt: 'system prompt',
        userPrompt: '以下の日本語テキストを翻訳してください:\n\nこんにちは'
    });
});
