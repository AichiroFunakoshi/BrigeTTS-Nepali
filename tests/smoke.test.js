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
    await expect(page.locator('.app-title')).toHaveText('BridgeTTS v2.5.0');
    await expect(page.locator('#startJapaneseBtn')).toBeVisible();
    await expect(page.locator('#startEnglishBtn')).toBeVisible();
    await expect(page.locator('#translationBox')).toBeVisible();
    await expect(page.locator('#copyTranslationBtn')).toBeDisabled();
    await expect(page.locator('#presentTranslationBtn')).toBeVisible();
    await expect(page.locator('#presentTranslationBtn')).toBeDisabled();
    await expect(page.locator('#presentModal')).toHaveCount(1);
    await expect(page.locator('#presentModal')).toBeHidden();
    await expect(page.locator('#presentModal')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#presentModal')).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#conversationLog')).toHaveCount(1);
    await expect(page.locator('#conversationLogList')).toHaveCount(1);
    await expect(page.locator('#clearConversationLogBtn')).toHaveCount(1);
    await expect(page.locator('.conversation-log-replay')).toHaveCount(0);
    await expect(page.locator('#conversationLog')).toBeHidden();
    await expect(page.locator('#historyButton')).toBeVisible();
    await expect(page.locator('#domainControls .domain-btn')).toHaveCount(2);
    await expect(page.locator('#dictAddBtn')).toHaveCount(1);
    await expect(page.locator('#domainBadge')).toHaveText('医療・介護・福祉');
    await expect(page.locator('#fontSizeToggleBtn')).toBeVisible();
    await expect(page.locator('.app-subtitle')).toHaveText('日英リアルタイム音声翻訳');

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

    // 翻訳モード（会話領域）とユーザー辞書のプロンプト注入
    const injectedPrompt = await page.evaluate(() => window.PromptService.getTranslationSystemPrompt({
        domain: 'medical',
        dictionary: [{ reading: 'さくらえん', surface: 'さくら苑', english: 'Sakura-en' }]
    }));
    expect(injectedPrompt).toContain('医療・介護・福祉');
    expect(injectedPrompt).toContain('さくら苑');
    expect(injectedPrompt).toContain('Sakura-en');
    expect(injectedPrompt).toContain('ユーザー辞書');

    const dailyPrompt = await page.evaluate(() => window.PromptService.getTranslationSystemPrompt({ domain: 'daily' }));
    expect(dailyPrompt).toContain('日常会話');
    expect(dailyPrompt).not.toContain('ユーザー辞書');
});

test('uses side-by-side result boxes in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await page.locator('#apiModal').evaluate((modal) => {
        modal.style.display = 'none';
    });

    const layout = await page.evaluate(() => {
        const containerStyle = getComputedStyle(document.querySelector('.result-container'));
        const originalRect = document.querySelector('#originalBox').getBoundingClientRect();
        const translationRect = document.querySelector('#translationBox').getBoundingClientRect();
        const jaRect = document.querySelector('#startJapaneseBtn').getBoundingClientRect();
        const enRect = document.querySelector('#startEnglishBtn').getBoundingClientRect();
        const resetRect = document.querySelector('#resetBtn').getBoundingClientRect();

        return {
            direction: containerStyle.flexDirection,
            sameRow: Math.abs(originalRect.top - translationRect.top) < 4,
            originalLeft: originalRect.left,
            translationLeft: translationRect.left,
            // 言語ボタンが1段（折り返さない）で横幅いっぱいに広がること
            controlsSameRow: Math.abs(jaRect.top - enRect.top) < 4,
            englishRightOfJapanese: enRect.left > jaRect.left,
            primaryWiderThanReset: jaRect.width > resetRect.width
        };
    });

    expect(layout.direction).toBe('row');
    expect(layout.sameRow).toBe(true);
    expect(layout.translationLeft).toBeGreaterThan(layout.originalLeft);
    expect(layout.controlsSameRow).toBe(true);
    expect(layout.englishRightOfJapanese).toBe(true);
    expect(layout.primaryWiderThanReset).toBe(true);
});

test('keeps primary controls thumb-friendly in portrait', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('#apiModal').evaluate((modal) => {
        modal.style.display = 'none';
    });

    const layout = await page.evaluate(() => {
        const japaneseRect = document.querySelector('#startJapaneseBtn').getBoundingClientRect();
        const englishRect = document.querySelector('#startEnglishBtn').getBoundingClientRect();
        const resetRect = document.querySelector('#resetBtn').getBoundingClientRect();

        return {
            sameRow: Math.abs(japaneseRect.top - englishRect.top) < 4,
            similarPrimaryWidth: Math.abs(japaneseRect.width - englishRect.width) < 8,
            primaryMinHeight: Math.min(japaneseRect.height, englishRect.height),
            resetWidth: resetRect.width,
            japaneseWidth: japaneseRect.width
        };
    });

    expect(layout.sameRow).toBe(true);
    expect(layout.similarPrimaryWidth).toBe(true);
    expect(layout.primaryMinHeight).toBeGreaterThanOrEqual(44);
    expect(layout.resetWidth).toBeLessThan(layout.japaneseWidth);
});

test('keeps core text contrast readable', async ({ page }) => {
    await page.goto('/');
    await page.locator('#apiModal').evaluate((modal) => {
        modal.style.display = 'none';
    });
    await page.locator('#status').evaluate((status) => {
        status.className = 'status processing';
    });

    const colors = await page.evaluate(() => ({
        resultTitle: getComputedStyle(document.querySelector('.result-title')).color,
        resultContent: getComputedStyle(document.querySelector('#originalText')).color,
        processingStatus: getComputedStyle(document.querySelector('#status')).color
    }));

    expect(colors.resultTitle).toBe('rgb(95, 99, 104)');
    expect(colors.resultContent).toBe('rgb(32, 33, 36)');
    expect(colors.processingStatus).toBe('rgb(138, 75, 0)');
});

test('renders replay controls for conversation history entries', async ({ page }) => {
    await page.goto('/');
    await page.locator('#apiModal').evaluate((modal) => {
        modal.style.display = 'none';
    });

    await page.evaluate(() => {
        const log = document.querySelector('#conversationLog');
        const list = document.querySelector('#conversationLogList');
        const item = document.createElement('div');
        item.className = 'conversation-log-item';
        item.innerHTML = `
            <div class="conversation-log-item-header">
                <button class="conversation-log-replay" type="button" aria-label="この翻訳を再生">再生</button>
            </div>
            <div class="conversation-log-row">
                <div class="conversation-log-label">原文</div>
                <div class="conversation-log-text">こんにちは</div>
            </div>
            <div class="conversation-log-row">
                <div class="conversation-log-label">翻訳</div>
                <div class="conversation-log-text">Hello</div>
            </div>
        `;
        list.replaceChildren(item);
        // 履歴はモーダル内に移動したため、モーダルを直接表示して検証する
        document.querySelector('#historyModal').style.display = 'flex';
    });

    await expect(page.locator('#conversationLog')).toBeVisible();
    await expect(page.locator('.conversation-log-replay')).toHaveText('再生');
    await expect(page.locator('.conversation-log-replay')).toHaveAttribute('aria-label', 'この翻訳を再生');
});

test('shows the large present mode with translation text', async ({ page }) => {
    await page.goto('/');
    await page.locator('#apiModal').evaluate((modal) => {
        modal.style.display = 'none';
    });

    // 大型表示モーダルへ翻訳と原文を流し込んで直接表示する
    await page.evaluate(() => {
        document.querySelector('#presentOriginal').textContent = 'こんにちは';
        document.querySelector('#presentText').textContent = 'Hello';
        document.querySelector('#presentModal').style.display = 'flex';
    });

    await expect(page.locator('#presentModal')).toBeVisible();
    await expect(page.locator('#presentText')).toBeVisible();
    await expect(page.locator('#presentText')).toHaveText('Hello');
    await expect(page.locator('#presentOriginal')).toHaveText('こんにちは');
    await expect(page.locator('#presentReplayBtn')).toBeVisible();
    await expect(page.locator('#presentCloseBtn')).toBeVisible();

    // 翻訳テキストは原文より十分大きく表示される
    const sizes = await page.evaluate(() => ({
        translation: parseFloat(getComputedStyle(document.querySelector('#presentText')).fontSize),
        original: parseFloat(getComputedStyle(document.querySelector('#presentOriginal')).fontSize)
    }));
    expect(sizes.translation).toBeGreaterThan(sizes.original);
    expect(sizes.translation).toBeGreaterThanOrEqual(34);
});

test('parses translator service stream lines and payloads', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

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
            expectedModel: window.TranslatorService.model,
            model: payload.model,
            stream: payload.stream,
            temperature: payload.temperature,
            systemPrompt: payload.messages[0].content,
            userPrompt: payload.messages[1].content
        };
    });

    expect(result.model).toBe(result.expectedModel);
    expect(result).toMatchObject({
        content: 'Hello',
        done: '',
        ignored: '',
        invalidJson: '',
        stream: true,
        temperature: 0.3,
        systemPrompt: 'system prompt',
        userPrompt: '以下の日本語テキストを翻訳してください:\n\nこんにちは'
    });
    expect(consoleErrors).toEqual(expect.arrayContaining([
        expect.stringContaining('ストリーミングレスポンス解析エラー')
    ]));
});

test('cycles font size from the header toggle', async ({ page }) => {
    await page.goto('/');
    await page.locator('#apiModal').evaluate((modal) => {
        modal.style.display = 'none';
    });

    await expect(page.locator('#fontSizeToggleBtn')).toBeVisible();
    // 初期はmedium（早期適用）。原文・翻訳の両方に反映される
    await expect(page.locator('#translatedText')).toHaveClass(/size-medium/);
    await expect(page.locator('#originalText')).toHaveClass(/size-medium/);

    // タップでmedium → large へ循環
    await page.locator('#fontSizeToggleBtn').click();
    await expect(page.locator('#translatedText')).toHaveClass(/size-large/);
    await expect(page.locator('#originalText')).toHaveClass(/size-large/);
});
