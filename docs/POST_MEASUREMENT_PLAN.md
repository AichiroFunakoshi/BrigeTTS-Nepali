# POST_MEASUREMENT_PLAN — 実測データ取得後の実装計画（後続エージェント向け詳細設計）

最終更新: 2026-07-03（v2.9.0時点）

**この文書の目的**: レイテンシ実測（①）と同僚テスト（②）の結果が出た後に行うコード改変の詳細設計。
作成者（Claude Fable 5）が引き継げない場合でも、Claude Code / Codex 等の後続エージェントが
同じ品質で v3.0 を完成させられるように、判断基準・コードアンカー・実装手順・検証手順を残す。

> **読み順**: `CLAUDE.md` → `docs/AGENT_PLAYBOOK.md` → `docs/HANDOFF.md` → 本文書。
> リポジトリ規律（ブランチ→PR→マージ、`v*`タグで自動配信、評価ハーネス必須）は上記に従うこと。

---

## 0. 現在地（v2.9.0）

- KPI-3（品質）: **達成済み**（eval 50ケース100%・致命的誤訳0。`node eval/run-eval.js`で再検証可能）
- KPI-1（速さ）: **実測待ち**。計測機構は搭載済み（設定画面「レイテンシ計測」＋`latency-report` Issue送信）
- KPI-2（操作）: 設計上達成（開始1タップ・全操作1タップ）。②で実地確認
- KPI-4（信頼性）: error-report Issue 0件を維持中。②の30分連続使用で確認
- KPI-5（満足）: ②で測定
- F13は見送り確定、F14/F15実装済み。残る実装候補は「増分翻訳」「投機的先行翻訳」のみ（どちらも実測次第）

## 1. データの読み方と判定基準

### ① レイテンシ（`latency-report`ラベルのIssueに集まる）
- **達成判定**: 訳出開始の中央値 ≤700ms かつ 確定の中央値 ≤1200ms（複数端末なら報告の中央値で判断）
- 700 <訳出開始≤ 900ms: §3（増分翻訳）のみ実施
- 訳出開始 > 900ms: §3実施後に再計測し、なお未達なら §4（投機的先行翻訳）を追加
- 確定のみ未達（訳出開始は達成）: §3のみで解決する見込みが高い（確定時間は出力トークン数に比例するため）

### ② 同僚テスト（聞き取り項目は §5）
- 「補助なしでセットアップ完了」できなければ F14 の改修を最優先
- 機能要望は PROJECT_GOALS §5（スコープ外）と照合してから採否判断

## 2. 判定後の分岐まとめ

| 実測結果 | やること | 目安 |
|---|---|---|
| KPI-1達成 | §3・§4は**実装しない**（YAGNI）。§6のv3.0チェックリストへ | 文書更新のみ |
| 訳出開始 or 確定が未達 | §3 増分翻訳 → 再計測 | PR 1本 |
| §3後もなお未達 | §4 投機的先行翻訳 → 再計測 | PR 1本 |

## 3. 増分翻訳（設計の中核。品質ゲート必須）

### 3.1 現状の仕組み（コードアンカー）
- `app.js` `recognition.onresult`: 確定+暫定の**全文** `displayText` を構築 → デバウンス後 `translateText(displayText)`
- `translateText` は毎回**会話全体を再翻訳**（Google方式のre-translation）。会話が長くなるほど
  出力トークン＝確定時間が線形に伸びる。これが「確定」レイテンシの支配項
- セグメント確定: ネイティブは `SpeechRecognitionBridge.swift` の `pauseFinalizeInterval = 1.3秒`、
  Web版は認識器の `isFinal`

### 3.2 設計
状態を3つに分ける（`app.js` のIIFE内に追加）:
```
let frozenSourceSegments = [];   // 確定済みかつ翻訳済みの原文セグメント
let frozenTranslation = '';      // ↑に対応する確定訳（以後再翻訳しない）
// activeText = 現在発話中（未確定 or 確定直後で未凍結）の部分のみ
```
- `onresult` で `isFinal` のセグメントが増え、かつその時点の翻訳が完了していたら、
  該当セグメントを frozen へ移動し、そのセグメント分の訳を `frozenTranslation` に連結して凍結する
  （どこまでが「そのセグメント分の訳」かは、**凍結時点の翻訳全文**をそのまま凍結すればよい。
  訳の分割は不要——次回から翻訳対象を active のみにすることが本質）
- `translateText` は active 部分のみを翻訳。**文脈維持のため**、userメッセージを次の形式にする:
  ```
  直前の会話（文脈。翻訳しないこと）:
  原文: {frozenSourceSegmentsの末尾1〜2件}
  訳文: {対応する凍結訳の末尾}

  以下の{日本語}テキストを{ネパール語}に翻訳してください:
  {activeText}
  ```
- 表示: `translatedText.textContent = frozenTranslation + ' ' + streamingActiveTranslation`
- 会話履歴への保存・リセット時は frozen + active を合成した全文を使う（既存の`addConversationLogEntry`呼び出し箇所を確認）
- **フィーチャーフラグ必須**: `const INCREMENTAL_TRANSLATION = true;` を定数化し、falseで完全に旧経路へ
  戻れる形で実装する（v2.2以降の「追加中心・最小差分」原則）

### 3.3 品質ゲート（省略禁止）
1. `eval/cases.json` に**文脈依存の連続ケースを5件追加**してから実装する。例:
   - 2文連続で2文目が代名詞のみ（「田中さんが来ました。」→「彼は薬を持っています。」で He が維持されるか）
   - 1文目の主題が2文目の省略主語になる日本語特有ケース
   - ※増分翻訳の evalは新スクリプトオプション `--incremental`（frozen文脈をuserメッセージに含めて呼ぶ）を
     `eval/run-eval.js` に追加して検証する
2. 実装後: 既存50ケース100%維持 + 新規5ケース合格を確認してからPR
3. 実機で: 長い連続会話（10ターン）で凍結境界の訳が二重表示・欠落しないこと

### 3.4 触ってよい範囲
- `app.js`（onresult / translateText / 表示・履歴合成）、`eval/run-eval.js`、`eval/cases.json`、`tests/smoke.test.js`
- `prompt-service.js` は変更不要（文脈はuserメッセージ側に入れる。systemを変えるとキャッシュが無効になる）
- `translator-service.js` は変更不要（userメッセージは呼び出し側で組み立てられないため、
  正確には `createPayload` のuser content組み立てに`contextBlock`引数を追加する最小改修が必要。
  systemPromptは触らないこと）

## 4. 投機的先行翻訳（§3で未達の場合のみ）

- `recognition.onresult` のデバウンス設定箇所で、`dynamicDebounce/2` 経過時に
  同じ `translateText` を先行発射し、その後テキストが変わったら既存の `AbortController`
  機構（`currentTranslationController`）で中断する
- 実装は10行程度だが**APIコストが最大2倍**になる。導入時は設定でON/OFF（既定OFF）とし、
  「API使用量（概算）」欄で増分をユーザーが確認できることを案内する
- 品質への影響はない（同じプロンプト）。evalの再実行は不要、レイテンシ再計測のみ

## 5. 同僚テスト（②）の聞き取り項目と反映

質問（5分で終わる分量。回答はIssue化して `feedback` ラベル）:
1. 配布URLだけで、補助なしにインストール〜APIキー設定まで完了できたか（つまずいた画面はどこか）
2. 患者/利用者に画面を見せる場面で、大型表示は役に立ったか
3. 読み上げの声・速度は聞き取りやすいか（速度設定を変えたか）
4. 誤訳・不自然な訳に気づいたら、その原文（→ eval ケースに追加して再発防止）
5. 「また使いたいか」（はい/いいえ + 一言）← KPI-5の判定材料
6. 設定画面の「計測データを送信」を1回押してもらう（①のデータ収集）

反映手順: 回答→Issue化→PROJECT_GOALS §5と照合→採用分は `[Unreleased]` に積んで次版でまとめて出す。

## 6. v3.0 チェックリスト（すべて満たしたら宣言）

1. KPI-1: `latency-report` Issueの中央値で 700ms/1200ms 達成
2. KPI-2: ②の観察で全操作1タップを確認
3. KPI-3: `node eval/run-eval.js` 100%・critical 0 を最終確認
4. KPI-4: 30分連続使用テスト（②で実施）でクラッシュ・無応答0、error-report Issue 0
5. KPI-5: 「また使いたい」全員肯定
6. **計測UIの整理（ユーザー決定済み）**: レイテンシ計測欄・送信ボタンをv3.0で削除または非表示化する。
   推奨は「UI非表示化＋計測コードは残す」（回帰調査に使えるため）。完全削除する場合は
   `app.js` のレイテンシブロック・`index.html` の該当form-group・`sendLatencyBtn`関連・
   smoke testの該当expectを一括で除去し、`latencyData` キーの後始末（clearLatencyData）を初回起動時に1度実行
7. ドキュメント最終化: README のバージョン表記・CHANGELOG確定・RELEASE_GUIDE確認
8. `git tag v3.0.0 && git push origin v3.0.0` → 配信確認（RELEASE_GUIDE §配信確認）
9. 安定版アンカー `stable-v3.0.0` を打つ（`v*`以外なので配信は発火しない）

## 7. 品質規律の再掲（後続エージェントへ）

- **プロンプト・モデル・翻訳経路に触れる変更は、必ず前後で `eval/run-eval.js` を実行**し、
  合格率とcritical件数をPR説明に記載する（ベースライン: 50/50・critical 0）
- テストは exit code で判定する（パイプで潰さない。PLAYBOOK §4）
- 版数整合4ファイル＋CHANGELOG＋sw.jsキャッシュ版数（RELEASE_GUIDE参照）
- 迷ったら PROJECT_GOALS §3 のKPIに照らす。KPIを改善しない変更はしない
