# 🧭 作業継続ガイド（HANDOFF）

別のPC・別のセッションで作業を引き継ぐときは、**まずこのファイルを開く**こと。
ここが申し送り（handover）の入口。常に最新状態へのポインタを置く。

---

## ▶️ 現在の最新状態（このセクションを毎回更新する）

- **最終更新**: 2026-07-03
- **作業ブランチ**: `main`（作業ブランチはすべてマージ済み・削除）
- **最新コミット**: v2.5.0リリース済み（翻訳モード・ユーザー辞書・デバウンス自動適用）＋本PR（ビジョン確定・設定エクスポート/インポート）
- **未リリースの改良**: 設定エクスポート/インポート（F10・v2.6予定）
- **最新の申し送り**: [docs/handover-2026-07-02-local-migration.md](handover-2026-07-02-local-migration.md)
- **進捗ダッシュボード**: https://aichirofunakoshi.github.io/Bridge-TTS-Codex-/dashboard.html （リリース/CI/Issue/コミットを一望）
- **次にやること**: F11 翻訳品質評価ハーネス（ロードマップは docs/PROJECT_GOALS_AND_IMPROVEMENT_PLAN.md §6）

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

1. 区切りのよいところで `docs/handover-YYYY-MM-DD[-トピック].md` を新規作成する。
2. 内容は「現在の作業状況／完了／進行中／次のステップ／重要情報／注意点」を含める
   （テンプレートは既存の申し送りファイルを流用してよい）。
3. **このファイル（HANDOFF.md）の「現在の最新状態」と「申し送り一覧」を必ず更新**する。
4. コミットして push する（別PCから `git pull` で参照できる状態にする）。

---

## ⚠️ 既知の注意点

- `main` への取り込みは push → PR → マージで行う（直接編集しない）。
- この共同作業環境は `.git` の `unlink` が制限され、コミット時に空ロックが残ることがある。
  Mac Terminal で掃除: `rm -f .git/HEAD.lock .git/index.lock .git/objects/*/tmp_obj_* 2>/dev/null`
- 翻訳には OpenAI APIキーが必要（端末の localStorage に保存。共有端末では使用後リセット）。
