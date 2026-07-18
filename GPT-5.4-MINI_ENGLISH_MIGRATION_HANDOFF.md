# BrigeTTS英語版 GPT-5.4 mini移行 引き継ぎ手順

この文書は、BrigeTTS英語版を現在のOpenAIモデルから固定スナップショット `gpt-5.4-mini-2026-03-17` へ安全に移行するための作業指示書です。英語版の作業フォルダ直下へコピーし、Codexへの最初の指示と一緒に渡してください。

## 1. Codexへの依頼文

以下をそのまま利用できます。

> このリポジトリはBrigeTTSの日本語・英語版です。既存のmainと公開版を直接変更せず、`codex/gpt-5-4-mini` ブランチで作業してください。翻訳モデルを `gpt-5.4-mini-2026-03-17` へ移行し、日本語・英語の既存動作を維持してください。本書の手順に従い、OpenAI公式仕様、実API翻訳評価、ストリーミング、Playwright、PWAキャッシュ、iOS版数、料金表示、文書を確認してください。PRを作成してCodeRabbitレビュー完了まで待ち、私が「確認して」と指示するまでマージしないでください。

作業開始時に、ユーザーが別途指定する英語版のローカル作業フォルダを正として扱います。

### 英語版の配布識別情報（変更禁止）

この作業は既存の日英版アプリのモデル移行です。新規アプリ化ではないため、次の値を維持します。

| 項目 | 日英版の固定値 |
|---|---|
| GitHub | `AichiroFunakoshi/Bridge-TTS-Codex-` |
| Bundle ID | `com.a16.bridgetts` |
| AltStore Source ID | `com.a16.bridgetts.source` |
| Xcode `PRODUCT_NAME` | `BridgeTTS` |
| アプリ本体 | `BridgeTTS.app` |
| 配布IPA | `BridgeTTS-unsigned.ipa` |
| Actions Artifact | `BridgeTTS-unsigned-ipa` |

次のネパール版固有値を日英版へコピーしてはいけません。

```text
com.a16.bridgetts.nepali
com.a16.bridgetts.nepali.source
BrigeTTSNepali
BrigeTTS-Nepali-unsigned.ipa
BrigeTTS-Nepali-unsigned-ipa
```

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
- Bundle ID、製品名、IPA名、AltStore Source ID、Pages URL、GitHub参照先を変更しない

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
7. GitHubの最新Releaseとローカルの版数を確認する。2026-07-18時点の正式版は `v2.9.3` なので、変更がなければ移行版は `v2.9.4`。すでに新版がある場合は、その次のパッチ版を使う。
8. 作業前の配布識別情報を記録し、上表の固定値と一致しなければ作業を止めて原因を確認する。

## 4. コード調査

最低限、次の文字列を全リポジトリで検索します。

```bash
rg -n "gpt-4|gpt-5|temperature|chat/completions|NANO_PRICE|CACHE_VERSION|MARKETING_VERSION|PRODUCT_BUNDLE_IDENTIFIER|PRODUCT_NAME|bundleIdentifier|BridgeTTS-unsigned" . \
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
- `.github/workflows/ios-build.yml`、`altstore/generate_source.py`: 日英版固有のアプリ名・IPA名・Bundle ID・Source ID

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

モデル変更を利用端末へ確実に配信するため、既存の日英版系列の次のパッチ版へ更新します。

- パッチ版数（Web、package、iOS）
- Service Workerの`CACHE_VERSION`
- UIに表示する版数
- テストで期待する版数
- CHANGELOGの現在変更欄

日英版は既存アプリなので、版数を `1.0.0` に戻してはいけません。ネパール版の版数もコピーしません。作業時点で `v2.9.3` が最新なら `v2.9.4`、より新しいReleaseがあればその次のパッチ版を選びます。

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
python3 -m unittest tests/test_release_identity.py
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
- 日英版のBundle ID、Source ID、製品名、IPA名が変更されていない
- ネパール版固有の識別子・製品名・IPA名が差分や生成物に含まれない

### 実IPAの配布識別情報を検査する

PRブランチからiOSワークフローを手動実行し、生成されたIPAを展開して `Info.plist` を確認します。

```bash
gh workflow run ios-build.yml --ref codex/gpt-5-4-mini
# 完了後、run IDを指定
gh run download RUN_ID --name BridgeTTS-unsigned-ipa --dir /tmp/bridgetts-english-ipa
unzip -q /tmp/bridgetts-english-ipa/BridgeTTS-unsigned.ipa -d /tmp/bridgetts-english-ipa/extracted
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' /tmp/bridgetts-english-ipa/extracted/Payload/BridgeTTS.app/Info.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' /tmp/bridgetts-english-ipa/extracted/Payload/BridgeTTS.app/Info.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' /tmp/bridgetts-english-ipa/extracted/Payload/BridgeTTS.app/Info.plist
```

必須結果は、Bundle IDが `com.a16.bridgetts`、表示名が既存の日英版名、版数が今回のリリース予定版です。

### 配布識別情報の回帰テスト

CIに次の固定値を検査するテストを追加または維持します。

- `PRODUCT_BUNDLE_IDENTIFIER: com.a16.bridgetts`
- AltStore `bundleIdentifier: com.a16.bridgetts`
- Source ID `com.a16.bridgetts.source`
- `PRODUCT_NAME: BridgeTTS`
- `BridgeTTS.app`、`BridgeTTS-unsigned.ipa`、`BridgeTTS-unsigned-ipa`
- ネパール版固有値が混入していないこと

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
10. 正式リリース前に実IPAのBundle IDを検査する。ユーザーのリリース指示後にだけタグをpushする。
11. リリース後、GitHub ReleaseのIPA名、公開 `apps.json` のSource ID・Bundle ID・版数・URL、公開IPA内部の `Info.plist` を再確認する。
12. 既存の日英版Releaseやタグを削除・改名・上書きしない。

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
