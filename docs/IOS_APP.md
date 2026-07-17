# BridgeTTS iOSアプリ（AltStore配布）

このリポジトリのPWAを、iOSネイティブアプリとしてビルドし、AltStoreでサイドロードするためのガイドです。

## 仕組み

```
┌─────────────────────────────────────────────┐
│ BridgeTTS.app (iOS)                          │
│ ┌──────────────────────────────────────────┐ │
│ │ WKWebView                                 │ │
│ │  - バンドル内の www/（PWAのコピー）を表示  │ │
│ │  - 翻訳: fetch → OpenAI API（従来どおり） │ │
│ │  - TTS: speechSynthesis（従来どおり）     │ │
│ └────────────▲─────────────────────────────┘ │
│              │ JSブリッジ (native-speech.js)  │
│ ┌────────────┴─────────────────────────────┐ │
│ │ SpeechRecognitionBridge (Swift)           │ │
│ │  - SFSpeechRecognizer + AVAudioEngine     │ │
│ │  - webkitSpeechRecognition互換APIを提供   │ │
│ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**重要なポイント**: iOSのWKWebViewにはWeb Speech APIの音声認識（`webkitSpeechRecognition`）が存在しません。そのため、ネイティブの音声認識（`SFSpeechRecognizer`）をJavaScriptに橋渡しする `native-speech.js` シムを用意しています。シムはネイティブアプリ内でのみ有効化され、通常のブラウザ/PWAでは何もしません。Webアプリ本体（app.js）は一切変更せずに両環境で動作します。

## IPAの入手方法

### 方法1: GitHub Actionsの成果物をダウンロード（推奨）

1. GitHubリポジトリの **Actions** タブ → **Build iOS App (unsigned IPA)** を開く
2. 最新の成功したワークフロー実行を開く
3. **Artifacts** から `BridgeTTS-unsigned-ipa` をダウンロード
4. zipを展開して `BridgeTTS-unsigned.ipa` を取り出す

`v` で始まるタグ（例 `v2.0.0`）をpushすると、Releaseが自動作成されIPAが添付されます。

### 方法2: ローカル（Mac）でビルド

必要なもの: macOS + Xcode 15以降 + [XcodeGen](https://github.com/yonaskolb/XcodeGen)（`brew install xcodegen`）

```bash
# 1. Webアセットとアイコンを準備
bash ios/scripts/prepare-www.sh

# 2. Xcodeプロジェクトを生成
xcodegen generate --spec ios/project.yml --project ios

# 3a. Xcodeで開いて実機にRun（開発時はこちらが簡単）
open ios/BridgeTTS.xcodeproj

# 3b. または未署名IPAをCLIでビルド
xcodebuild -project ios/BridgeTTS.xcodeproj -scheme BridgeTTS \
  -configuration Release -sdk iphoneos -derivedDataPath ios/build \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO build
mkdir -p ios/build/Payload
cp -R ios/build/Build/Products/Release-iphoneos/BridgeTTS.app ios/build/Payload/
(cd ios/build && zip -qry BridgeTTS-unsigned.ipa Payload)
```

## AltStoreソースからのインストール・更新（推奨）

ソースを登録しておくと、IPAを手動転送せずにAltStoreだけでインストール・更新が完結します。

1. iPhoneのSafariで https://aichirofunakoshi.github.io/BrigeTTS-Nepali/altstore.html を開き「AltStoreにソースを追加」をタップ
   （またはAltStoreの **Sources** → **＋** に `https://aichirofunakoshi.github.io/BrigeTTS-Nepali/apps.json` を貼り付け）
2. AltStoreの **Browse** にBridgeTTSが表示されるので **FREE** をタップしてインストール
3. 新バージョンが公開されると **My Apps** に「アップデート」が表示され、ワンタップで更新できます
   （アプリのデータ・APIキー・設定は引き継がれます）

他の人に使ってもらう場合も、このソースURLを伝えるだけです（各自のMac/PCでのAltServerセットアップと、無料Apple IDの場合は7日ごとの更新・3アプリ制限は同様に必要です）。

新しいリリースの公開は `v` で始まるタグ（例 `v2.1.0`）をpushするだけで、IPAビルド→Release添付→ソース(apps.json)更新まで自動で行われます。

## 更新の受け取り

新バージョンの通知は二重化されています。①アプリ内バナー（v2.7.1以降）: 起動時に新版を検知して画面上部に表示、タップでAltStoreへ。②AltStore自身の通知: iPhoneの設定→アプリ→AltStore→「Appのバックグラウンド更新」をONにすると、更新の検知通知と7日署名の自動リフレッシュが働きます。配信の全体像と開発者向け手順は [RELEASE_GUIDE.md](RELEASE_GUIDE.md) を参照。

## アプリ内エラー報告

アプリ（およびWeb版）でエラーが発生すると「⚠️ エラーを報告」ボタンが表示されます。
タップするとログ（APIキー等は自動マスク）を確認のうえ送信できます。

- **ネイティブアプリ**: GitHubの[Issues](https://github.com/AichiroFunakoshi/BrigeTTS-Nepali/issues)に `error-report` ラベル付きで直接作成されます（アカウント不要・アプリ内完結）
- **Web/PWA版**: GitHubのIssue作成画面が下書き付きで開きます（GitHubアカウントが必要）

ネイティブアプリの直接送信を有効にするには、リポジトリ管理者が以下を一度だけ設定します:

1. [Fine-grained PAT](https://github.com/settings/personal-access-tokens/new) を作成
   （Repository access: このリポジトリのみ / Permissions: **Issues = Read and write** のみ / 有効期限は任意）
2. `gh secret set ERROR_REPORT_TOKEN` でActionsシークレットに登録
3. 次回のIPAビルドから自動で有効化（未設定の場合はIssue下書き方式に自動フォールバック）

※ 配布物にトークンが含まれるため、漏えい時の影響をIssue作成のみに限定した専用トークンを使うこと。

## AltStoreでのインストール手順

> **⚠️ 重要（よくあるつまずき）**: `BridgeTTS-unsigned.ipa` は**Mac上でダブルクリックしてもインストールできません**。未署名のため「整合性を確認できなかったためインストールできませんでした」というエラーになります。これはiOSの仕様で、必ずiPhoneに転送し、**iPhone上のAltStoreから**開いて署名・インストールしてください。

### 事前準備（初回のみ）

1. **Mac**: [altstore.io](https://altstore.io/) から **AltServer** をダウンロードしてインストールし、起動する（メニューバーに常駐）
2. **Mac**: iPhoneをUSB接続（またはWi-Fi同期を有効化）し、メニューバーのAltServerアイコン → **Install AltStore** → 自分のiPhoneを選択 → Apple IDでサインイン
3. **iPhone**: 設定 → 一般 → VPNとデバイス管理 → 自分のApple IDのプロファイルを「信頼」
4. **iPhone（iOS 16以降）**: 設定 → プライバシーとセキュリティ → **デベロッパモード** をオンにして再起動


1. [AltStore](https://altstore.io/) をPC/Mac経由でiPhoneにインストールしておく（AltServerが必要）
2. `BridgeTTS-unsigned.ipa` をiPhoneに転送（AirDrop、ファイルApp、iCloud Driveなど）
3. iPhoneでAltStoreを開く → **My Apps** → 左上の **＋** → ダウンロードしたIPAを選択
4. Apple IDで署名されてインストールされる
5. 初回起動時にマイクと音声認識の権限を許可する

### 注意事項

- **7日間の有効期限**: 無料のApple IDで署名したアプリは7日で期限切れになります。AltStoreのバックグラウンド更新、または手動の「Refresh」で更新してください
- **3アプリ制限**: 無料Apple IDでサイドロードできるアプリは同時に3つまでです
- APIキーや設定はアプリ内に保存され、ブラウザ版とは独立しています

## ネイティブ版とPWA版の違い

| 項目 | PWA（Safari） | ネイティブアプリ |
|------|---------------|------------------|
| 音声認識 | Web Speech API（サーバー処理） | SFSpeechRecognizer（端末上処理が可能） |
| 音声読み上げ | speechSynthesis | speechSynthesis（同じ） |
| 翻訳 | OpenAI API | OpenAI API（同じ） |
| インストール | ホーム画面に追加 | AltStoreでサイドロード |
| オフラインシェル | Service Worker | アプリバンドル（常にローカル） |
| マイク権限 | サイト単位で毎回確認されることがある | アプリ権限として一度許可すればOK |

## トラブルシューティング

- **起動直後に「Webアセットが含まれていません」と表示される**
  → `ios/scripts/prepare-www.sh` を実行してからビルドし直してください（CIでは自動実行されます）
- **音声認識が動かない**
  → 設定 → BridgeTTS でマイクと音声認識の権限を確認してください
- **翻訳結果のコピーが効かない**
  → `file://` コンテキストではクリップボードAPIが制限される場合があります
- **ビルドが失敗する**
  → Xcodeのバージョン（15以降）と、`ios/App/www/index.html` が存在することを確認してください
