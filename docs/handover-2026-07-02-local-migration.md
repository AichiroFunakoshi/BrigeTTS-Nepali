# 会話申し送り 2026-07-02（ローカル移行・Fable5規範・ダッシュボード）

## 🔄 現在の作業状況
- 作業内容: iCloud→ローカルへの開発環境移行の確定、マルチMac運用の整備、プロジェクト可視化
- コンテキスト: iCloud Drive上のリポジトリはgit不安定（stale lock・クラウド専用化）のため廃止。
  以後は GitHub(origin/main) を唯一の正とし、各Macのローカルクローン（`~/Bridge-TTS(Codex)`）で開発する。

## ✅ 完了事項
- 新ローカルクローンが origin/main（v2.4.0マージ済み・6e88d3f）と完全一致することを確認。iCloud版は古いスナップショットであることを確認（参照禁止に）
- CLAUDE.md にマルチMac運用手順と Claude Fable 5 行動規範を追記（PR #44）
- `PromptingClaudeFable5.md` をRTF→プレーンMarkdownに変換してリポジトリに追加
- プロジェクト進捗ダッシュボード `dashboard.html` を追加（GitHub Pages配信）
  - URL: https://aichirofunakoshi.github.io/Bridge-TTS-Codex-/dashboard.html
  - 表示内容: リリース/配信状況（main版数とタグの乖離を警告）・CHANGELOG[Unreleased]・直近コミット・オープンIssue/PR・CI状況
  - データはGitHub API（未認証・60回/時）。ビルドには含まれない（Pages配信のみ）

## 🔄 進行中の事項
- なし（本申し送りを含むPRのマージをもって区切り）

## ⏭️ 次のステップ
- **v2.4.0のリリース**: mainはv2.4.0相当だがタグ未push。`git tag v2.4.0 && git push origin v2.4.0` で
  IPAビルド→Release→AltStore配信まで自動実行される（実施はユーザー判断）
- 新しいCoworkチャットはこのプロジェクトフォルダ（ローカル側）から開き、CLAUDE.md → HANDOFF.md の順に参照して開始する

## 💡 重要な情報
- main保護中: 変更は必ずブランチ→PR→マージ。リリースは `v*` タグのみ発火
- エラー報告: アプリ内から `error-report` ラベルでIssue自動作成（現在オープン0件）
- 安定版アンカー: `stable-fable5-v2.3.0`（ロールバック手順はHANDOFF.md参照）

## ⚠️ 注意点
- iCloud内のコピー（`~/Library/Mobile Documents/.../AI-Workspace/Bridge-TTS(Codex)`）は使用しない。誤用防止のため削除またはリネームを推奨
- ダッシュボードのGitHub APIはレート制限（未認証60回/時）があるため、自動リロードはせず手動更新
