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
- **GitHub（origin/main）が唯一の正**。複数Macで開発する場合、各Macに `~/Bridge-TTS(Codex)` としてローカルクローンを置く。
- **セッション開始時の手順（指示がなくても必ず実施）**:
  1. ロック掃除→ `git fetch` → `git status -sb` と `git log --oneline -1` で**ローカルとorigin/mainの一致を確認**。
     このフォルダは手動コピーで他のMacから持ち込まれることがあり、古い状態・未コミット変更を含み得る。
     乖離や未知の変更があれば**触る前にユーザーへ報告**（GitHubが唯一の正。手動コピーは種にすぎない）。
  2. 一致していれば `git checkout main && git pull --ff-only` で最新化。
  3. `docs/HANDOFF.md`「現在の最新状態」→ `CHANGELOG.md`（[Unreleased]と直近リリース）→ 必要に応じ `docs/AGENT_PLAYBOOK.md` の順で読み、「次にやること」から再開する。
- **セッション終了時の手順（指示がなくても必ず実施）**: 区切りがついたら `docs/HANDOFF.md` の「現在の最新状態」を更新して作業内容のPRに含める（大きな節目では `docs/handover-YYYY-MM-DD-*.md` も作成）。これにより他のMac・他のセッションが指示なしで継続できる。
- 作業フォルダは **iCloud Drive の外** のローカル実体のみ。iCloud内コピー（`~/Library/Mobile Documents/.../AI-Workspace/Bridge-TTS(Codex)`）は**廃止済み・参照禁止**（クラウド専用化で読み書き・gitが不安定。内容も古い）。Cowork/Claude Codeのフォルダ選択も必ずローカル側を使う。
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

## Claude Fable 5 の行動規範（このリポジトリでの標準動作）
`PromptingClaudeFable5.md`（Anthropic公式ガイド・ローカル参照用）の要点をこのプロジェクト向けに抽出したもの:

- **十分な情報が揃ったら行動する**。会話で確定済みの事実を再導出しない。ユーザーが決めたことを蒸し返さない。採用しない選択肢を長々と並べない。
- **スコープ規律**: 求められた以上の機能追加・リファクタ・抽象化をしない。将来の仮想的要件を先回りしない。起こり得ないシナリオのエラー処理やフォールバックを書かない（検証は境界＝ユーザー入力と外部APIのみ）。
- **「確認だけ」と言われたら評価の報告が成果物**。修正は求められるまで適用しない。システム状態を変える操作（削除・設定変更・タグpush等）の前に、証拠がその操作を支持しているか確認する。
- **進捗・完了報告は実際のツール結果に基づく**。未検証のものは未検証と明言し、テストが失敗したら出力とともに失敗と報告する。実行していない作業を完了と報告しない。
- **ターン終了前チェック**: 最後の段落が「これから〜します」という宣言・計画・約束なら、ターンを終えずにその作業を実行する。
- **最終報告は結果から**。最初の一文で「何が起きたか/何が分かったか」に答える。作業中の略語・矢印記法・自作ラベルを最終報告に持ち込まない。
- **高リスク変更の検証は、文脈を持たない別エージェント**（fresh-contextのサブエージェント）によるレビューが自己レビューより有効。
- **教訓の記録**: ハマりどころや確認済みの正しい手法は `docs/HANDOFF.md` に追記する（既存メモの更新を優先し、重複を作らない。誤りと分かったメモは削除する）。

## 参照
- **エージェント実務手順（英語・ユーザー追記欄あり）: `docs/AGENT_PLAYBOOK.md`** ← セッション開始時に必読
- 作業継続ガイド: `docs/HANDOFF.md`
- 目標・改善計画: `docs/PROJECT_GOALS_AND_IMPROVEMENT_PLAN.md`
- 変更履歴: `CHANGELOG.md`
