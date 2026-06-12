# Changelog

このプロジェクトの注目すべき変更はすべてこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に準拠します。

## [Unreleased]

## [2.1.2] - 2026-06-12

### Added
- 更新履歴（CHANGELOG.md）を新設
- GitHub PagesでPWA本体の公開を開始（AltStoreソースと同居）

### Changed
- アプリ内の表記を「Bridge(Ver.4.1-nano)」から「BridgeTTS v2.1.2」へ統一（タイトル・フッター・使い方ガイド）
- READMEを全面改訂し、現状の機能・配布方法（AltStoreソース/PWA）・開発手順に一致する内容へ更新
- AltStoreソース追加ページを `/altstore.html` へ移動(ルートはPWA本体)

### Removed
- READMEから実装と一致しない記述を削除（存在しないOPTIMAL_DEBOUNCE定数のコード例、未設置のLICENSEファイルへの言及、旧リポジトリ前提の記述など）

## [2.1.1] - 2026-06-12

### Added
- アプリ内エラー報告のGitHub Issuesへの直接送信を有効化（CIビルド時にIssues作成専用トークンを注入）

## [2.1.0] - 2026-06-12

### Added
- AltStoreソース（apps.json）のGitHub Pages自動公開（ワンタップ更新・ソースURL共有による配布）
- アプリ内エラー報告基盤（トークンがあればGitHub Issuesへ直接作成、なければIssue下書きへフォールバック）
- iOS用1024pxネイティブアプリアイコン（文字なし版）とアイコンパイプラインへの組み込み
- 画面上のバージョン表記（v2.1.0）とMARKETING_VERSIONの統一
- 手順書（docs/IOS_APP.md）にAltStore事前準備・未署名IPAの注意点を追記

### Changed
- 会話履歴をメイン画面から専用モーダルへ分離（ヘッダーに履歴ボタンを新設、入力・翻訳枠の縮小を防止）
- 音声認識のセグメント確定間隔を1.0秒から1.3秒へ変更（文の途中切断を低減）

### Fixed
- ネイティブ版TTSの冒頭無音・フェードイン（再生前にAVAudioSessionを.playback/.spokenAudioへ切替＋無音ウォームアップ発話）
- ネイティブ版の音声認識精度低下（AVAudioSessionのモードを.measurementから.defaultへ変更しiOSの音声前処理を有効化、taskHint=.dictation指定）
- 翻訳プロンプトに音声認識の誤り（同音異義語・助詞の欠落等）を文脈から修正するルールを追加

## [2.0.0] - 2026-06-12

### Added
- iOSネイティブアプリ化（WKWebView + SFSpeechRecognizerブリッジによる音声認識補完）
- GitHub Actionsによる未署名IPAの自動ビルドとReleaseへの添付（v*タグ）
- 図解仕様書（docs/VISUAL_GUIDE.html）

## [1.x] - 2026-05-18 〜 2026-06-11（PWA期）

Bridge TTS PWAとして開発された時期。主な内容: 初期インポート、PWAシェルキャッシュ、
エラーレポート基盤、テーマ切替（自動/ライト/ダーク）、会話履歴の保存・コピー・リプレイ、
デバウンス最適化（学習型）、視認性・コントラスト改善、片手操作対応、Playwrightスモークテスト。

[Unreleased]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.1.2...HEAD
[2.1.2]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/releases/tag/v2.1.0
