# Changelog

このプロジェクトの注目すべき変更はすべてこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づき、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に準拠します。

## [Unreleased]

## [2.3.0] - 2026-06-12

### Added
- 会話モード（停止後の自動読み上げ）オプションを追加。音声入力を停止すると最後の翻訳結果を自動で読み上げる（Google翻訳の会話モード相当、デフォルトOFF・設定でON）

### Changed
- 翻訳プロンプトを強化: 「音の類似」による音声認識誤りの文脈復元を最重要ルール化（例:「醤油速度が遅い」→「処理速度が遅い」）。実在しない複合語を直訳で残さない・英語の同音誤認識（their/there等）の修正も明示
- デバウンス最適化を言語別に独立化: 従来は日英両方のデータが必要で片方の言語しか話さない場合に永久に最適化できなかった。言語ごとに30件で、その言語だけ最適化可能に

### Fixed
- エラー報告ボタンが一度表示されると消えない問題: 閉じる（×）ボタンを追加し、報告開始時・30秒無操作で自動的に消えるように変更（新しいエラーで再表示）

## [2.2.0] - 2026-06-12

### Changed
- **ターン制の会話フローへ変更**: TTS実行（翻訳ボックスのタップ）＝1ターンの終了として音声入力を完全停止し、TTS終了後の自動再開を廃止。次の入力は言語ボタンから開始する（TTS後の認識再開レースによる冒頭欠け・連続使用時の精度低下を解消。日英の言語切替も自然になる）
- 30秒間音声を検出しない場合は音声入力を自動停止（マイク常時ONによるメモリ消費・発熱対策。従来は通知のみ）
- 録音開始時はマイク準備完了まで「マイク準備中…」を表示し、準備完了（認識開始）で「録音中」に切り替え（準備完了前の発話による冒頭欠けを防止）
- デバウンス最適化を再設計: 従来の「確定結果同士の間隔」（ネイティブ版ではセグメント確定が1.3秒固定のため有効データがほぼ集まらず形骸化していた）から「音声認識結果の更新間隔」の学習に変更。90パーセンタイル×1.2を最適値とし、発話中の通常更新を区切りと誤判定しない待ち時間を端末・話者別に算出

### Fixed
- ネイティブ版TTSの再生開始が約1秒遅い問題: 無音ウォームアップ発話を廃止し、オーディオセッション切替完了をネイティブ側からJSへ通知（`__bridgeNativeTTSReady`）してから即時再生する方式に変更（フォールバック300ms）
- ネイティブ版で認識停止とTTS準備（`prepareTTS`）が競合するとセッション切替がスキップされ、TTS冒頭がフェードインするレースを解消（認識中でも確実に停止してから再生用セッションへ切替）

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

[Unreleased]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.1.2...v2.2.0
[2.1.2]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-/releases/tag/v2.1.0
