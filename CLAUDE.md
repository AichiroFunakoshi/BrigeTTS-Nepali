# CLAUDE.md — BridgeTTS 作業ガイド（AIアシスタント向け）

このファイルは、このリポジトリで作業するAIアシスタント（Claude等）の動作ベース。
**セッション開始時に必ず参照し、ここの規律に従うこと。**

## プロジェクト概要
- **BridgeTTS**: 日英リアルタイム音声翻訳アプリ。**PWA（ブラウザ）** と **iOSネイティブ（AltStore配布）** の2形態。
- 翻訳: OpenAI `gpt-4.1-nano`（端末から直接呼び出し）。音声: Web Speech API（iOSは `SFSpeechRecognizer` ブリッジで補完）。
- 主要ファイル: `app.js`（本体・認識制御/翻訳トリガー/UI）, `translator-service.js`, `prompt-service.js`, `tts-service.js`, `native-speech.js`, `settings-storage.js`, `error-reporter.js`, `sw.js`, `index.html`, `style.css`, `ios/`。

## 触れてはいけない核（要・慎重）
- **翻訳・音声認識・TTSのコアロジック**（`app.js` の認識制御、`translator-service.js` / `tts-service.js` / `prompt-service.js`）は、検証なしに変更しない。
- 変更は **「追加中心・最小差分」** を基本とし、既存の挙動を変えない。
- **TTSの言語**: `TtsService.speak({ sourceLanguage })` は内部で言語を反転して発話言語を決める（`tts-service.js` 内 `sourceLanguage === 'ja' ? 'en-US' : 'ja-JP'`）。呼び出し側には **ソース（入力）言語** を渡す。呼び出し側での反転は二重反転になり禁止。

## 作業環境・リポジトリ規律
- 作業フォルダは **iCloud Drive の外** のローカル実体（例 `~/Bridge-TTS(Codex)`）。iCloud内コピーはクラウド専用化で読み書き・gitが不安定なので使わない。
- **Node 22** を使用（`.nvmrc`）。
- 変更は必ず **ブランチ → PR → マージ**。`main` は保護され直接pushは不可。
- リリースは **`v*` タグ** のpushで自動化（GitHub Actions が IPAビルド → Release添付 → AltStore配信）。**`v*` 以外のタグは発火しない**。
- **安定版アンカー**: タグ `stable-fable5-v2.3.0`（= `v2.3.0` / コミット `723eb06`）。不具合時のロールバック基点。手順は `docs/HANDOFF.md` の「🔙 ロールバック / 安定版アンカー」を参照。

## PR前セルフレビュー・チェックリスト（必須）
PRを出す前に、サンドボックス等で以下を実行・確認する（CodeRabbitの“静的解析の穴”を事前に潰す目的）:

1. **構文**: 変更した全 `.js` に `node --check` を実行。
2. **lint / 静的解析**（方針A=軽量。設定ファイルはコミットせず、その都度実行）:
   - CSS: `npx stylelint "**/*.css"`（非推奨プロパティ等を確認。例: `word-break: break-word` → `overflow-wrap`）。
   - JS: `npx eslint .`（軽量設定で）。
   - ※ リポジトリにlint設定が無ければ一時導入して走らせてよい（リポジトリは汚さない）。
3. **振る舞いの検証**: `npm run test:smoke`（Playwright）。ブラウザ不可の環境では jsdom 等でDOM/配線を確認。
4. **差分の自己確認**: `git diff` を読み直し、意図と無関係な変更が無いか・影響範囲が限定的かを確認。
5. **キャッシュ**: cached資産（`index.html`/`style.css`/`*.js`/アイコン等）を変えたら `sw.js` の `CACHE_VERSION` を上げる。
6. **高リスク変更**: 別エージェントで敵対的レビューを1回かける。

## 運用の癖・注意点
- **PRは束ねて出す**。小刻みな連続PRは CodeRabbit のレビュー回数上限（rate limit）に当たり、レビューされないまま積み上がる。最終的に CodeRabbit にも一度通すこと。
- **リリース時は版数を全ファイルで整合**: `package.json` / `ios/project.yml`（`MARKETING_VERSION`）/ `index.html`（タイトル・フッター）/ `tests/smoke.test.js`（期待値）。
- 変更内容は `CHANGELOG.md` の `[Unreleased]` に記録する。
- この共同作業環境では、コミット時に `.git` に空ロックが残ることがある。掃除（プロジェクト内で実行）: `rm -f .git/HEAD.lock .git/index.lock .git/objects/*/tmp_obj_*`

## 参照
- 作業継続ガイド: `docs/HANDOFF.md`
- 目標・改善計画: `docs/PROJECT_GOALS_AND_IMPROVEMENT_PLAN.md`
- 変更履歴: `CHANGELOG.md`
