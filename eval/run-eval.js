#!/usr/bin/env node
/**
 * BrigeTTS(Nepali) 翻訳品質評価ハーネス（F11）
 *
 * 使い方:
 *   OPENAI_API_KEY=sk-... node eval/run-eval.js            # ネパール語版ケースを実行
 *   node eval/run-eval.js --dry-run                        # API呼び出しなしで構成検証
 *   OPENAI_API_KEY=... node eval/run-eval.js --domain medical --limit 10
 *   OPENAI_API_KEY=... node eval/run-eval.js --id asr-01,dict-03
 *   OPENAI_API_KEY=... node eval/run-eval.js --monotonic     # 順送り訳β: 文脈付きチャンク翻訳の検証
 *
 * 判定:
 *   - mustInclude: 各要素が訳文に含まれること（要素が配列の場合はいずれか1つで可）
 *   - mustNotInclude: いずれも含まれないこと
 *   - 日本語→ネパール語はデーヴァナーガリー文字、日本語←ネパール語は日本語で部分一致
 *   - critical ケースの失敗は「致命的誤訳」としてKPI-3の判定対象
 *
 * 結果は eval/results/eval-<日時>.md に保存（gitignore対象）。
 * プロンプトやモデルを変更したら、変更前後で実行して合格数を比較する。
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ブラウザ用モジュールをNodeで読み込む
global.window = {};
require(path.join(__dirname, '..', 'prompt-service.js'));
const PromptService = global.window.PromptService;

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-nano';
const CONCURRENCY = 4;

function parseArgs(argv) {
    const args = { dryRun: false, domain: null, ids: null, limit: null, model: DEFAULT_MODEL, monotonic: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dry-run') args.dryRun = true;
        else if (a === '--domain') args.domain = argv[++i];
        else if (a === '--id') args.ids = argv[++i].split(',').map((s) => s.trim());
        else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
        else if (a === '--model') args.model = argv[++i];
        else if (a === '--monotonic') args.monotonic = true;
    }
    return args;
}

function flatten(list) {
    const out = [];
    (list || []).forEach((item) => {
        if (Array.isArray(item)) out.push(...item);
        else out.push(item);
    });
    return out;
}

function judge(testCase, output) {
    const haystack = testCase.lang === 'ja' ? output.toLowerCase() : output;
    const missing = [];
    (testCase.mustInclude || []).forEach((item) => {
        const candidates = Array.isArray(item) ? item : [item];
        if (!candidates.some((c) => haystack.includes(testCase.lang === 'ja' ? c.toLowerCase() : c))) {
            missing.push(candidates.join(' | '));
        }
    });
    const forbidden = flatten(testCase.mustNotInclude).filter((c) =>
        haystack.includes(testCase.lang === 'ja' ? c.toLowerCase() : c)
    );
    return { pass: missing.length === 0 && forbidden.length === 0, missing, forbidden };
}

async function translate(testCase, apiKey, model) {
    const systemPrompt = PromptService.getTranslationSystemPrompt({
        domain: testCase.domain === 'daily' ? 'daily' : 'medical',
        dictionary: testCase.dictionary || []
    });
    const label = testCase.lang === 'ja' ? '日本語' : 'ネパール語';
    const target = testCase.lang === 'ja' ? 'ネパール語' : '日本語';
    // 順送り訳β: 文脈付きチャンク翻訳（app.js buildMonotonicUserContent と同形式）
    const userContent = testCase.context
        ? `直前の発話（文脈。翻訳しないこと）:\n原文: ${testCase.context.source}\n訳文: ${testCase.context.translation}\n\n以下の${label}テキストは発話の続きである。上の文脈に自然につながる${target}訳のみを出力してください:\n\n${testCase.source}`
        : `以下の${label}テキストを${target}に翻訳してください:\n\n${testCase.source}`;
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            temperature: 0.3
        })
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    const data = await response.json();
    return (data.choices?.[0]?.message?.content || '').trim();
}

async function main() {
    const args = parseArgs(process.argv);
    const casesFile = JSON.parse(fs.readFileSync(
        path.join(__dirname, args.monotonic ? 'cases-nepali-monotonic.json' : 'cases-nepali.json'), 'utf8'));
    let cases = casesFile.cases;
    if (args.domain) cases = cases.filter((c) => c.domain === args.domain);
    if (args.ids) cases = cases.filter((c) => args.ids.includes(c.id));
    if (args.limit) cases = cases.slice(0, args.limit);

    console.log(`評価ケース: ${cases.length}件 / モデル: ${args.model}`);

    if (args.dryRun) {
        // 構成検証のみ: プロンプト生成と判定ロジックを通す
        cases.forEach((c) => {
            const prompt = PromptService.getTranslationSystemPrompt({
                domain: c.domain === 'daily' ? 'daily' : 'medical',
                dictionary: c.dictionary || []
            });
            if (!prompt || prompt.length < 100) throw new Error(`プロンプト生成失敗: ${c.id}`);
            judge(c, 'dummy output');
        });
        console.log('dry-run OK: 全ケースのプロンプト生成・判定ロジックが有効です');
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('環境変数 OPENAI_API_KEY を設定してください（--dry-run なら不要）');
        process.exit(1);
    }

    const results = [];
    let index = 0;
    async function worker() {
        while (index < cases.length) {
            const testCase = cases[index++];
            try {
                const started = Date.now();
                const output = await translate(testCase, apiKey, args.model);
                const verdict = judge(testCase, output);
                results.push({ testCase, output, verdict, ms: Date.now() - started });
                process.stdout.write(verdict.pass ? '.' : (testCase.critical ? 'C' : 'F'));
            } catch (error) {
                results.push({ testCase, output: '', verdict: { pass: false, missing: ['(APIエラー)'], forbidden: [] }, error: String(error).slice(0, 200) });
                process.stdout.write('E');
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log('\n');

    results.sort((a, b) => a.testCase.id.localeCompare(b.testCase.id));
    const failed = results.filter((r) => !r.verdict.pass);
    const criticalFailed = failed.filter((r) => r.testCase.critical);
    const passRate = Math.round(((results.length - failed.length) / results.length) * 100);

    const lines = [];
    lines.push(`# 翻訳品質評価結果 ${new Date().toISOString()}`);
    lines.push(`- モデル: ${args.model} / ケース: ${results.length}件`);
    lines.push(`- 合格: ${results.length - failed.length}件（${passRate}%） / 不合格: ${failed.length}件 / うち致命的(critical): ${criticalFailed.length}件`);
    lines.push(`- KPI-3判定: 致命的誤訳${criticalFailed.length === 0 ? '0件 ✅' : `${criticalFailed.length}件 ❌`} / 要修正${100 - passRate <= 10 ? '10%以下 ✅' : `${100 - passRate}% ❌`}`);
    lines.push('');
    failed.forEach((r) => {
        lines.push(`## ${r.testCase.critical ? '🔴' : '🟡'} ${r.testCase.id}`);
        lines.push(`- 入力: ${r.testCase.source}`);
        lines.push(`- 出力: ${r.output || '(なし)'}`);
        if (r.verdict.missing.length) lines.push(`- 欠落: ${r.verdict.missing.join(' / ')}`);
        if (r.verdict.forbidden.length) lines.push(`- 禁止語混入: ${r.verdict.forbidden.join(' / ')}`);
        if (r.error) lines.push(`- エラー: ${r.error}`);
        lines.push('');
    });

    const report = lines.join('\n');
    console.log(report.split('\n').slice(0, 6).join('\n'));

    const resultsDir = path.join(__dirname, 'results');
    fs.mkdirSync(resultsDir, { recursive: true });
    const file = path.join(resultsDir, `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
    fs.writeFileSync(file, report);
    console.log(`\n詳細: ${file}`);

    process.exit(criticalFailed.length > 0 ? 2 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
