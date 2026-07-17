# BrigeTTS(Nepali) 初期移植 申し送り（2026-07-17）

## 目的

稼働中の日英版 `AichiroFunakoshi/Bridge-TTS-Codex-` を変更せず、Git履歴と石畳方式を維持した日本語・ネパール語版を独立して開発・配布する。

## 完了

- ホーム直下の `~/BrigeTTS(Nepali)` に元リポジトリを履歴付きで複製
- 元リポジトリ接続を `upstream` として分離し、元への誤push経路を除去
- アプリ名を `BrigeTTS(Nepali)`、新規GitHubリポジトリ名を `BrigeTTS-Nepali` として統一
- 言語識別子を `en` から `ne`、音声認識とTTSのロケールを `en-US` から `ne-NP` へ変更
- UI、翻訳プロンプト、ユーザー辞書、会話履歴、デバウンス学習、Pages/Issue/AltStore参照先をネパール語版へ変更
- ネパール語は標準的なデーヴァナーガリー文字で出力し、ヒンディー語化・全文ローマ字化を避ける規則を追加
- ネパール語デバウンス初期値は、英語版の実測値を流用せず暫定300msとした。既存ロジックにより30件以降は端末別に自動最適化される
- 評価ハーネスの既定をネパール語ケース8件、`--monotonic` を文脈維持3件へ切り替え
- 公開リポジトリ `AichiroFunakoshi/BrigeTTS-Nepali` を作成し、検証済みコミットを `main` へpush
- GitHub PagesをActions方式で有効化し、PWAとAltStoreソースを公開

## 検証

- 変更対象JavaScriptの `node --check`: 合格
- `node eval/run-eval.js --dry-run`: 8件合格
- `node eval/run-eval.js --dry-run --monotonic`: 3件合格
- `npm run test:smoke -- --reporter=line`: 14/14合格
- smokeには日本語入力時のTTS言語が `ne-NP` になる検査を含む
- GitHub ActionsのWeb Smoke Tests: 合格
- GitHub ActionsのiOS未署名IPAビルド: 合格
- GitHub Pages / AltStore Source公開: 合格（PWAのHTTP 200を確認）

## 未完了

- `OPENAI_API_KEY` を使ったネパール語評価ケースの実行は未実施
- iPhone/Android実機で `ne-NP` 音声認識が利用できるか、ネパール語TTS音声がインストールされているかを確認する
- AltStoreソースは公開済みだが、初回 `v*` リリース前のため配布バージョンは0件

## 注意

- `ne-NP` の認識・TTS対応は端末とOSに依存する。TTS音声が見つからない場合でも翻訳テキストは利用できる
- `eval/cases.json` と `eval/cases-monotonic.json` は元の日英版ベースラインを履歴資料として残している。ネパール語版の実行対象は `cases-nepali*.json`
- 元リポジトリへはpushしない。新規GitHubリポジトリを `origin`、元の日英版を `upstream` として運用する
