# 🧭 作業継続ガイド（HANDOFF）

別のPC・別のセッションで作業を引き継ぐときは、**まずこのファイルを開く**こと。
ここが申し送り（handover）の入口。常に最新状態へのポインタを置く。

---

## ▶️ 現在の最新状態（このセクションを毎回更新する）

- **最終更新**: 2026-06-23
- **作業ブランチ**: `feature/present-mode`（`main` は無変更）
- **最新コミット**: `1f9b6ed`（大型表示モード + 版数整合 / 未push）
- **最新の申し送り**: [docs/handover-2026-06-23-present-mode.md](handover-2026-06-23-present-mode.md)
- **次にやること**: ローカルで `npm run test:smoke` → `git push origin feature/present-mode` → PR → マージ

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
git checkout feature/present-mode        # 進行中ブランチが無ければ main から

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
| 2026-06-23 | [handover-2026-06-23-present-mode.md](handover-2026-06-23-present-mode.md) | 大型表示モード実装 / package.json 版数整合（branch: feature/present-mode） |
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
