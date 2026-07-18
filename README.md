# BrigeTTS(Nepali)

![BrigeTTS(Nepali)](images/icons/ios-appicon-1024.png)

日本語とネパール語のリアルタイム音声翻訳アプリです。音声認識で文字起こしし、OpenAI API（gpt-5.4-mini）で翻訳します。Web Speech APIを利用した音声読み上げ（TTS）の実装も保持しています。**PWA（ブラウザ）** と **iOSネイティブアプリ（AltStore配布）** の2形態で動作します。

このリポジトリは [Bridge-TTS-Codex-](https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-) の履歴を保った独立コピーです。元の日英版へ変更を送らず、日本語・ネパール語版として別に更新します。

iOS版は固有Bundle ID `com.a16.bridgetts.nepali` を使用します。日英版の `com.a16.bridgetts` とは別アプリとして、同じiPhoneへ同時にインストールできます。

> [!IMPORTANT]
> **ネパール語TTSの現状（2026-07-18）**: iPhone実機では、OS内蔵のネパール語音声を利用した読み上げが動作しないことを確認しています。そのため現段階では、設定の「音声読み上げ（TTS）」をOFFにして使うことを推奨します。将来、外部の音声合成サービスなどと連携してネパール語読み上げを実現できる可能性に備え、TTSのコードと設定項目は削除せず機能として保持しています。今後の連携方法と提供時期は未定です。日本語TTSを含め、実際に利用できる音声はOS・ブラウザ・インストール済み音声に依存します。

> ネパール語の音声認識は `ne-NP` を指定します。ネパール語デバウンスの初期値300msは暫定値で、30件の利用データから端末ごとに自動最適化されます。

- 更新履歴: [CHANGELOG.md](CHANGELOG.md)
- iOSアプリのビルド・インストール手順: [docs/IOS_APP.md](docs/IOS_APP.md)
- 図解仕様書: [docs/VISUAL_GUIDE.html](docs/VISUAL_GUIDE.html)
- 開発の引き継ぎ・別PCでの作業継続: [docs/HANDOFF.md](docs/HANDOFF.md)
- 順送り翻訳（石畳方式）の設計文書: 仕様書 [docs/MONOTONIC_BETA_SPEC.md](docs/MONOTONIC_BETA_SPEC.md) / 論文 [docs/ISHIDATAMI_SCHEME.md](docs/ISHIDATAMI_SCHEME.md)
- 進捗ダッシュボード: https://aichirofunakoshi.github.io/BrigeTTS-Nepali/dashboard.html

## インストール

### iOSネイティブアプリ（推奨）

1. AltStore/AltServerをセットアップ（初回のみ。[docs/IOS_APP.md](docs/IOS_APP.md)参照）
2. iPhoneのSafariで **https://aichirofunakoshi.github.io/BrigeTTS-Nepali/altstore.html** を開き「AltStoreにソースを追加」
3. AltStoreの Browse から BrigeTTS(Nepali) をインストール

以後の更新はAltStoreの「アップデート」からワンタップで行えます（設定・履歴・APIキーは引き継がれます）。

### PWA（ブラウザ）

1. https://aichirofunakoshi.github.io/BrigeTTS-Nepali/ をSafari（iOS）/Chrome（Android）で開く
2. iPhone/iPad: 共有ボタン →「ホーム画面に追加」 / Android: メニュー →「アプリをインストール」

### 必要なもの

- OpenAI APIキー（[取得はこちら](https://platform.openai.com/api-keys)）
- APIキーは端末のlocalStorageにのみ保存され、翻訳時にOpenAI APIへ直接送信されます。リポジトリやサーバーには保存されません。共有端末では使用後に「APIキーリセット」を実行してください。

## 主な機能

- **リアルタイム音声翻訳**: 日本語⇄ネパール語の双方向翻訳。話しながらストリーミングで翻訳結果を表示
- **順送り翻訳（石畳方式・既定）**: 発話の確定セグメントごとに前から訳を積み上げる凍結方式（確定訳は組み変わらない）。録音停止時に整形パスが原文全体と突き合わせて誤訳・訳抜けを修正する。従来の「標準（全文再翻訳）」も設定から選択可（フォールバック用）
- **音声認識の誤り補正**: 同音異義語の誤変換や助詞の欠落を、翻訳時に文脈から推定して修正
- **翻訳モード（会話領域スイッチ）**: 「医療・介護・福祉／日常会話」を設定で切替。領域に応じた翻訳方針をプロンプトに注入
- **ユーザー辞書**: 施設名・人名などの固有名詞（よみ／表記／ネパール語表記）を端末内に登録。音声認識が別語に書き起こす固有名詞は「誤認識される表記」の登録で認識段階から決定的に置換
- **TTS（音声読み上げ・実装保持）**: 翻訳ボックスをタップして再生/停止する実装と、ON/OFF・速度・日本語音声の設定を保持。iPhone実機ではネパール語読み上げが動作しないため、現段階ではTTSをOFFにして使うことを推奨。将来の外部音声合成サービス連携は未定
- **会話モード（オプション・TTS依存）**: 音声入力の停止後、最後の翻訳結果を自動で読み上げる実装（デフォルトOFF）。現段階のiPhoneではネパール語TTSを利用できないため、実用機能としては扱わない
- **ターン制の会話フロー**: TTS実行＝1ターンの終了として音声入力を自動停止。次の入力は言語ボタンから開始（TTS後の認識再開による冒頭欠け・精度低下を防止し、日本語・ネパール語の切替も自然に）。30秒間無音の場合も自動停止（電池・発熱対策）
- **会話履歴**: 直近20件をヘッダーの履歴ボタンから専用画面で閲覧。各エントリの再生・コピー、全消去に対応。端末内（localStorage）にのみ保存
- **デバウンス最適化（学習型）**: デフォルト値（日本語346ms/ネパール語300ms）から、音声認識の更新間隔を学習して翻訳開始の待ち時間を言語別に自己最適化（90パーセンタイル×1.2）。両言語は独立しており、片方の言語が30件に達すればその言語だけで最適化可能
- **テーマ切替**: 自動（端末設定に追従）/ライト/ダーク
- **フォントサイズ調整**: 小/中/大/特大の4段階
- **レスポンシブレイアウト**: 横画面では原文と翻訳を左右並列表示
- **視覚的状態フィードバック**: 録音中（青）/翻訳中（オレンジ）/完了（緑）を色で表示
- **設定のエクスポート/インポート**: ユーザー辞書・翻訳モード・デバウンス学習値・表示設定をJSON一括でコピー/貼り付けし、別端末へ移行可能
- **API使用量の表示**: 翻訳ごとのトークン数を端末内で累計し、設定画面に概算コスト（gpt-5.4-mini料金基準）を表示。レイテンシ統計の1タップ送信にも対応
- **エラー報告**: エラー発生時に「⚠️ エラーを報告」ボタンが出現。ネイティブアプリではGitHub Issuesへ直接送信（アカウント不要・APIキー等は自動マスク）、Web版ではIssue下書き画面を開く。録音中のフリーズ→強制終了もハートビートで検出し、次回起動時に直前ログ付きで報告可能

## iOSネイティブアプリの仕組み

WKWebViewでWebアプリ本体をそのまま動かし、WKWebViewに存在しない音声認識（webkitSpeechRecognition）をネイティブの `SFSpeechRecognizer` ブリッジ（`native-speech.js` + Swift）で補完しています。Webアプリ本体は両環境で共通です。

- `v*` タグのpushで、GitHub Actionsが未署名IPAをビルドしReleaseに添付
- 併せてAltStoreソース（apps.json）がGitHub Pagesへ自動公開され、AltStoreに更新が配信される

## 開発

```bash
git clone https://github.com/AichiroFunakoshi/BrigeTTS-Nepali.git 'BrigeTTS(Nepali)'
cd 'BrigeTTS(Nepali)'

# Node 22を使用（Playwright 1.60はNode 24/25で不安定なため）
nvm use  # .nvmrc準拠。Homebrewの場合: export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

npm install
npx playwright install chromium
npm run test:smoke -- --reporter=line
```

ローカル確認は `python3 -m http.server 4173` などで配信して `http://127.0.0.1:4173` を開きます（マイクを使う場合はHTTPSまたはlocalhostが必要）。iOSアプリのローカルビルドは [docs/IOS_APP.md](docs/IOS_APP.md) を参照してください。

### リリース手順

1. `ios/project.yml` の `MARKETING_VERSION`、`index.html` のバージョン表記（タイトル・フッター）、`package.json`、`tests/smoke.test.js` の期待値を更新
2. `CHANGELOG.md` に変更内容を記録
3. PRをmainへマージ後、`git tag vX.Y.Z && git push origin vX.Y.Z`
4. 以降は自動（IPAビルド → Release添付 → AltStoreソース更新）

### 主要ファイル

| ファイル | 役割 |
|---|---|
| `app.js` | アプリ本体（音声認識制御・翻訳トリガー・UI） |
| `translator-service.js` | OpenAI API（gpt-5.4-mini）ストリーミング翻訳 |
| `prompt-service.js` | 翻訳システムプロンプト（誤認識の文脈修正ルールを含む） |
| `tts-service.js` | 音声読み上げ（ネイティブ時はオーディオセッション切替＋ウォームアップ） |
| `native-speech.js` | iOSネイティブ音声認識ブリッジ（Web側） |
| `error-reporter.js` | エラー収集・マスク・GitHub Issues報告 |
| `ios/` | Swiftソース・XcodeGen設定・ビルドスクリプト |
| `altstore/generate_source.py` | AltStoreソース(apps.json)とPagesサイトの生成 |

## ブラウザ対応（PWA）

- iOS Safari / Android Chrome / Edge: 対応
- Firefox Mobile: 非対応（Web Speech API非搭載）

## 既知の制限

- 翻訳にはインターネット接続とOpenAI APIキーが必要（使用量に応じてAPI料金が発生）
- 対応言語ペアは日本語⇄ネパール語のみ
- iPhone実機ではOS内蔵機能によるネパール語TTSが動作しないため、現段階ではTTSをOFFにして使うことを推奨。将来の外部音声合成サービス連携に備えて実装は保持しているが、対応方法と時期は未定
- 無料Apple IDでのサイドロードは7日ごとの再署名（AltStoreが自動更新）と3アプリ制限あり
