# BrigeTTS英語版 GPT-5.4 mini移行 引き継ぎ手順

この文書は、BrigeTTS英語版を現在のOpenAIモデルから固定スナップショット `gpt-5.4-mini-2026-03-17` へ安全に移行するための作業指示書です。英語版の作業フォルダ直下へコピーし、Codexへの最初の指示と一緒に渡してください。

## 1. Codexへの依頼文

以下をそのまま利用できます。

> このリポジトリはBrigeTTSの日本語・英語版です。既存のmainと公開版を直接変更せず、`codex/gpt-5-4-mini` ブランチで作業してください。翻訳モデルを `gpt-5.4-mini-2026-03-17` へ移行し、日本語・英語の既存動作を維持してください。本書の手順に従い、OpenAI公式仕様、実API翻訳評価、ストリーミング、Playwright、PWAキャッシュ、iOS版数、料金表示、文書を確認してください。PRを作成してCodeRabbitレビュー完了まで待ち、私が「確認して」と指示するまでマージしないでください。

作業開始時に、ユーザーが別途指定する英語版のローカル作業フォルダを正として扱います。

## 2. 変更方針

- 対象モデル: `gpt-5.4-mini-2026-03-17`
- API: 既存の `/v1/chat/completions` とSSEストリーミングを維持
- 推論: `reasoning_effort: "none"`
- 揺らぎ: `temperature: 0`
- 出力量: `verbosity: "low"`
- ストリーミング: `stream: true`
- 使用量: `stream_options: { include_usage: true }`
- モデルエイリアスではなく固定スナップショットを使い、品質評価を再現可能にする
- Responses APIへの移行や音声認識・TTS方式の変更は、このPRに混ぜない

標準ペイロードの目安:

```js
{
  model: 'gpt-5.4-mini-2026-03-17',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ],
  stream: true,
  stream_options: { include_usage: true },
  reasoning_effort: 'none',
  temperature: 0,
  verbosity: 'low'
}
```

## 3. 事前確認

1. `AGENTS.md`、`CLAUDE.md`、README、package scriptsを読む。
2. `git status -sb` でユーザーの未コミット変更がないか確認する。
3. mainから専用ブランチを作る。
4. `OPENAI_API_KEY` の有無を値を表示せず確認する。
5. APIキーを保存する場合は、Gitに無視された `.env` または既存規約のenvファイルだけを使う。
6. `.env`、評価結果、APIキーをコミットしない。

## 4. コード調査

最低限、次の文字列を全リポジトリで検索します。

```bash
rg -n "gpt-4|gpt-5|temperature|chat/completions|NANO_PRICE|CACHE_VERSION|MARKETING_VERSION" . \
  --glob '!node_modules' --glob '!.git'
```

確認対象の代表例:

- `translator-service.js`: 実際のモデル、ペイロード、ストリーミング解析
- `prompt-service.js`: 日本語・英語の翻訳契約
- `eval/run-eval.js`: 評価用モデルとAPIパラメータ
- `tests/smoke.test.js`: モデル設定、プロンプト、UIの回帰テスト
- `app.js`: 料金概算、モデル名のコメント、石畳方式の文脈処理
- `index.html`: モデル説明と版数
- `sw.js`: PWAキャッシュ番号
- `package.json`、`package-lock.json`: アプリ版数
- `ios/project.yml`: iOS `MARKETING_VERSION`
- README、CHANGELOG、図解・引き継ぎ文書

過去のリリース履歴や旧評価の記録は、現在仕様の説明と混同しない限り書き換えません。

## 5. 英語版プロンプトの更新

ネパール版の言語固有プロンプトをコピーしてはいけません。英語版の既存ルールを保ち、次の優先契約だけを追加・整理します。

1. 出力は相手言語の翻訳文だけ。説明、前置き、原文、引用符を付けない。
2. 原文の肯定・否定、疑問・命令・条件を変えない。
3. 数値、日時、数量、単位、薬剤名、固有名詞を保持する。
4. 音声認識誤りの修復は、音の近さと文脈の両方に根拠がある場合だけ行う。
5. 原文にない症状、予定、因果関係、数値を追加しない。
6. ユーザー辞書の指定を最優先する。
7. 日本語は自然な日本語、英語は自然で簡潔な会話英語にする。
8. 石畳方式では、直前文脈で代名詞・省略主語の参照先が特定でき、対象人物の取り違えにつながる場合は訳文で明示する。

`temperature: 0` を既定とし、自然さに明確な問題が出る場合だけ、同一評価ケースで `0.2` と比較します。

## 6. 料金表示

gpt-5.4-miniの概算単価を、コードと文書で統一します。

- 入力: `$0.75 / 100万トークン`
- キャッシュ入力: `$0.075 / 100万トークン`
- 出力: `$4.50 / 100万トークン`

既存の使用量記録で、通常入力とキャッシュ入力が別々に累積されていることも確認します。

## 7. 版数とキャッシュ

モデル変更を利用端末へ確実に配信するため、次を同時に更新します。

- パッチ版数（Web、package、iOS）
- Service Workerの`CACHE_VERSION`
- UIに表示する版数
- テストで期待する版数
- CHANGELOGの現在変更欄

キャッシュ番号を更新しないと、PWAで旧 `translator-service.js` が残る可能性があります。

## 8. 評価ケース

日本語→英語と英語→日本語の両方向で、最低限次を含めます。

- 日常会話
- 否定と禁止
- 数字、日時、回数、単位
- 医療・介護用語
- 人名・施設名・ユーザー辞書
- 音声認識の類音誤り
- 代名詞と省略主語
- 石畳方式の前文脈接続

致命的ケースは、否定反転、数値変更、人物取り違え、薬剤・症状・身体部位の変更です。

## 9. 検証順序

```bash
node --check translator-service.js
node --check prompt-service.js
node --check eval/run-eval.js
node eval/run-eval.js --dry-run
node eval/run-eval.js --dry-run --monotonic
npm run test:smoke -- --reporter=line
git diff --check
```

APIキーが利用できる場合:

```bash
set -a
. ./.env
set +a
node eval/run-eval.js
node eval/run-eval.js --monotonic
```

合格条件:

- 通常評価と石畳評価が全件合格
- critical 0件
- Playwright全件合格
- 実APIがモデル名、`reasoning_effort`、temperature、verbosityを受理
- ストリーミングの先頭出力と最終結果が正常
- APIキーや `.env` が差分に含まれない

## 10. GitHubとCodeRabbit

1. 対象ファイルだけを明示してstageする。
2. 検証結果を含むコミットを作る。
3. 専用ブランチをGitHubへpushする。
4. ドラフトではないPRを作り、CodeRabbitを起動する。
5. PR本文に変更理由、API設定、評価件数、critical件数、Playwright結果を書く。
6. CodeRabbitの未解決スレッドをGraphQL対応の手順で確認する。
7. 妥当な指摘は最小修正し、再テスト・追加push・再レビューを行う。
8. ユーザーが「確認して」と指示するまでマージしない。
9. 指示後、未解決指摘とCIを再確認し、問題がなければmainへマージしてブランチを整理する。

## 11. ロールバック

問題があれば、モデル設定と直接関連するプロンプト変更だけを直前モデルへ戻します。音声認識、TTS、石畳方式、保存設定など、モデル移行と無関係な構造は巻き戻しません。

## 12. ネパール版で確認できた実績

- `gpt-5.4-mini-2026-03-17` をChat Completionsで利用可能
- `reasoning_effort: none`、`temperature: 0`、`verbosity: low` を実APIが受理
- 通常翻訳評価8/8合格
- 石畳方式評価3/3合格
- critical 0件
- Playwright 14/14合格
- GitHub Actions合格

英語版でも同じ合格基準を満たした後にモデル切り替えを確定してください。
