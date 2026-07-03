# BridgeTTS 配信手順書（AltStoreへのアップロードと更新）

最終更新: 2026-07-03

## 全体像（何が自動で、何が手動か）

```
[手動] コード変更 → PR → mainへマージ
[手動] git tag vX.Y.Z && git push origin vX.Y.Z   ← 実質これだけ
[自動] GitHub ActionsがIPAをビルド
[自動] GitHub Release作成・IPA添付
[自動] AltStoreソース(apps.json)をGitHub Pagesへ再公開
[自動] 各iPhoneのAltStoreが新バージョンを検知 →「アップデート」に表示
[自動] アプリ内バナーが新バージョンを通知（v2.7.1以降）
```

**「AltStoreにアップロードする」という独立した作業は存在しません。** `v`で始まるタグをpushした時点で配信まで全自動です。

## 更新を配信する手順（開発者）

1. **版数整合**（4ファイルを同じ版数に）:
   - `index.html`（タイトルとフッターの `BridgeTTS vX.Y.Z`）
   - `ios/project.yml`（`MARKETING_VERSION`）
   - `package.json`（`version`）
   - `tests/smoke.test.js`（タイトルの期待値）
2. **CHANGELOG.md**: `[Unreleased]` の内容を `## [X.Y.Z] - 日付` に確定
3. **PR→マージ**（mainは直接push不可）
4. **タグをpush**:
   ```bash
   cd ~/Bridge-TTS\(Codex\)
   git checkout main && git pull --ff-only
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
5. **配信確認**（2〜3分後）:
   ```bash
   gh release view vX.Y.Z --json tagName,assets --jq '{tag:.tagName,assets:[.assets[].name]}'
   curl -s https://aichirofunakoshi.github.io/Bridge-TTS-Codex-/apps.json | python3 -c "import json,sys; print([v['version'] for v in json.load(sys.stdin)['apps'][0]['versions']][:2])"
   ```
   1行目でIPA添付、2行目で新版数が先頭に出ていれば配信完了。

> Claude（AIアシスタント）に依頼する場合は「vX.Y.Zとしてリリースして」だけで1〜5を実行します。

## 更新を受け取る流れ（iPhone側・自動化の設定）

更新の通知は二重になっています:

1. **アプリ内バナー（v2.7.1以降・設定不要）**: BridgeTTS起動時に配信ソースを照会し、
   新バージョンがあると画面上部に「新しいバージョン vX.Y.Z が利用可能です」と表示。
   「AltStoreで更新」をタップ→AltStoreが開く→My Appsの「アップデート」をタップで完了。
2. **AltStore自身の通知（初回のみ設定）**:
   - iPhoneの 設定 → アプリ → AltStore → **Appのバックグラウンド更新をON**
   - AltStoreを定期的にバックグラウンド起動させると、更新の検知・通知と7日署名の自動更新が行われます
   - 通知を確実にするには、AltStore側の通知許可もONにしておく

更新してもAPIキー・設定・ユーザー辞書・会話履歴は引き継がれます。

## 初回インストール（新しいiPhone・同僚への配布）

1. Mac/PCにAltServerを導入し、iPhoneにAltStoreを入れる（詳細: [IOS_APP.md](IOS_APP.md)）
2. iPhoneのSafariで https://aichirofunakoshi.github.io/Bridge-TTS-Codex-/altstore.html →「AltStoreにソースを追加」
3. AltStoreの Browse から BridgeTTS をインストール

## トラブルシューティング

- **タグをpushしたのにAltStoreに出ない**: Actionsの完了(2〜3分)とPages CDNの反映(+1分)を待つ。上の確認コマンドで版数が出ていれば、AltStoreのSourcesを引っ張って更新
- **「アプリを更新できません」**: 7日署名の期限切れ。AltServer稼働中のMacと同じWi-FiでAltStoreのRefreshを実行
- **v*以外のタグは配信されない**（安定版アンカー `stable-*` はロールバック用で配信に影響しない）
- ロールバック手順: [HANDOFF.md](HANDOFF.md) の「🔙 ロールバック / 安定版アンカー」
