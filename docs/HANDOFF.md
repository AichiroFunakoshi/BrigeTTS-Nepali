# 🧭 作業継続ガイド（HANDOFF）

別のPC・別のセッションで作業を引き継ぐときは、**まずこのファイルを開く**こと。
ここが申し送り（handover）の入口。常に最新状態へのポインタを置く。

---

## ▶️ 現在の最新状態（このセクションを毎回更新する）

- **最終更新**: 2026-07-08
- **作業ブランチ**: `main`（作業ブランチはすべてマージ済み・削除。PR #59=Coworkセットアップスクリプトもマージ済み）
- **最新リリース**: **v2.9.0**（配信済み）= レイテンシ計測のIssue送信（`latency-report`）＋API使用量可視化F15（プロキシ化は見送り確定）。実装候補の残りは増分翻訳・投機的先行翻訳のみで、**着手判断は実測データ次第**（判定基準と詳細設計: [POST_MEASUREMENT_PLAN.md](POST_MEASUREMENT_PLAN.md)）。それ以前: v2.6.1=プロンプト品質修正（評価50ケース**100%**・致命的誤訳0件=KPI-3達成）、v2.6.0=設定エクスポート・インポート/評価ハーネス、v2.5.0=翻訳モード/ユーザー辞書/デバウンス自動適用
- **未リリースの改良**: なし
- **品質ベースライン**: eval/cases.json 50件で100%（比較メモは docs/evaluation-cases.md）。プロンプト/モデル変更時は `OPENAI_API_KEY=... node eval/run-eval.js` で前後比較すること
- **最新の申し送り**: [docs/handover-2026-07-02-local-migration.md](handover-2026-07-02-local-migration.md)
- **Cowork環境**: サンドボックスでのテスト実行は `scripts/cowork-setup.sh` で構築可（→「⚠️ 既知の注意点」参照）
- **進捗ダッシュボード**: https://aichirofunakoshi.github.io/Bridge-TTS-Codex-/dashboard.html （リリース/CI/Issue/コミットを一望）
- **次にやること**: **ユーザー側**=①実機で「計測データを送信」（latency-report Issueに集まる）②同僚テスト（聞き取り項目: POST_MEASUREMENT_PLAN §5）。**エージェント側**=latency-report Issueが届いたら POST_MEASUREMENT_PLAN §1の判定基準で増分翻訳の要否を決めて実行（2026-07-08時点でIssue 0件・待機中）

---

## 🔙 ロールバック / 安定版アンカー

不具合時に「安定していた状態」へ確実に戻すための基点。

- **安定版アンカー**: タグ `stable-fable5-v2.3.0`（= `v2.3.0` / コミット `723eb06`）。fable5期の最終安定版。**不変**で、mainがどれだけ進んでも常にここを指す。
- **GitHub Release**: `v2.3.0`（IPA添付）も公開済み。配信を戻す場合はこのReleaseを再配布、または再びLatestにする。

戻し方（いずれも改良を失わず両方向に可能）:

```bash
# 安定版の中身を確認・取り出す
git checkout stable-fable5-v2.3.0      # detached。作業するなら: git checkout -b hotfix stable-fable5-v2.3.0

# mainの特定のマージだけを安全に打ち消す（履歴を残す）
git revert -m 1 <マージコミットSHA>     # 例: 2ff46c3（PR #33）

# 配信を旧版へ: v2.3.0 のIPA(GitHub Release)を再配布、またはv2.3.0を再Latest化
```

> 運用: 改良は必ずブランチ→PR→マージ、リリースは必ず `v*` タグ。各バージョンが独立した復帰点になる。
> 注意: `v*` タグのpushはIPA自動ビルド＆AltStore配信を発火する。安定版アンカーが `stable-` 始まりなのは誤発火を避けるため。

---

## 🔁 別PCで継続する手順

```bash
# 1. リポジトリを取得（初回のみ）。※iCloud Drive内ではなくローカル実体に置くこと
git clone https://github.com/AichiroFunakoshi/Bridge-TTS-Codex-.git
cd Bridge-TTS-Codex-

# 2. 最新を取得
git fetch origin

# 3. 作業ブランチを確認・チェックアウト（上の「現在の最新状態」を参照）
git branch -a
git checkout main                        # 進行中の作業ブランチがあればそれをcheckout

# 4. このガイドと最新の申し送りを読む
#    docs/HANDOFF.md → 最新の docs/handover-YYYY-MM-DD-*.md
#    → 「次にやること」から再開

# 5. 依存導入・テスト（Node 22 を使用）
nvm use
npm install
npx playwright install chromium
npm run test:smoke -- --reporter=line
```

> 補足: 作業フォルダは **iCloud Drive の外**（例 `~/Developer/`）に置くこと。
> iCloud内だとファイルがクラウド専用化して読み書き・gitが不安定になる。

---

## 🗂 申し送り一覧（新しい順）

| 日付 | ファイル | 概要 |
|---|---|---|
| 2026-07-02 | [handover-2026-07-02-local-migration.md](handover-2026-07-02-local-migration.md) | ローカル移行確定 / CLAUDE.mdにFable5規範 / 進捗ダッシュボード追加 |
| 2026-06-23 | [handover-2026-06-23-present-mode.md](handover-2026-06-23-present-mode.md) | 大型表示モード実装 / package.json 版数整合（PR #33 マージ済み・main 2ff46c3） |
| 2025-10-10 | [handover-2025-10-10-ios-safari-fix.md](handover-2025-10-10-ios-safari-fix.md) | iOS Safari 関連の修正 |
| 2025-10-10 | [handover-2025-10-10.md](handover-2025-10-10.md) | 申し送り |
| 2025-01-08 | [handover-2025-01-08.md](handover-2025-01-08.md) | 申し送り |

---

## 📝 運用ルール（申し送りの残し方）

0. **毎セッション終了時**（指示がなくても）「現在の最新状態」を更新してpushする。フォルダの手動コピーでMacを移っても、ここが最新なら継続できる。
1. 大きな節目では `docs/handover-YYYY-MM-DD[-トピック].md` を新規作成する。
2. 内容は「現在の作業状況／完了／進行中／次のステップ／重要情報／注意点」を含める
   （テンプレートは既存の申し送りファイルを流用してよい）。
3. **このファイル（HANDOFF.md）の「現在の最新状態」と「申し送り一覧」を必ず更新**する。
4. コミットして push する（別PCから `git pull` で参照できる状態にする）。

---

## ⚠️ 既知の注意点

- `main` への取り込みは push → PR → マージで行う（直接編集しない）。
- この共同作業環境は `.git` の `unlink` が制限され、コミット時に空ロックが残ることがある。
  Mac Terminal で掃除: `rm -f .git/HEAD.lock .git/index.lock .git/objects/*/tmp_obj_* 2>/dev/null`
  Cowork内で「Operation not permitted」になる場合は、ファイル削除の許可（allow file delete）を得れば掃除できる。
- **Cowork（Claudeサンドボックス）での開発**（2026-07-03確認）:
  - テスト環境構築は `bash scripts/cowork-setup.sh` を「✅ セットアップ完了」が出るまで繰り返し実行（シェル45秒制限のため分割再開式）。完了後は `LD_LIBRARY_PATH=$HOME/.local/lib-extra/lib npm run test:smoke` でsmoke全11件が実行できる。
  - サンドボックスからは `git push` 不可（認証なし）。ブランチ・コミット・PRは GitHub MCP（server-github）経由で作成し、ローカル作業ツリーは汚さない。
  - apt/deb/condaはプロキシ遮断。npmレジストリとPlaywright CDNは通る。
- GitHub Pagesのデプロイが「Deployment failed, try again later」で連続失敗することがある（GitHub側の一過性障害）。
  10分ほど置いて `gh workflow run altstore-source.yml` で再実行すれば復旧する。ipa/Release本体は影響を受けない。
- 翻訳には OpenAI APIキーが必要（端末の localStorage に保存。共有端末では使用後リセット）。
