---
name: retrofit-to-rules
description: 既存プロジェクトを claude-harness の rules に準拠させる（レトロフィット）。このリポジトリの .claude/ を導入した直後に、rules 準拠の docs（spec / contracts / adr）をコードから逆生成し、テストをバックフィルして、レガシーを一気に規約準拠へ引き上げたいときに使用する。「既存プロジェクトを rules 準拠にしたい」「docs を起こしたい」「テストを後付けしたい」といった依頼で起動する。
---

# 🧰 retrofit-to-rules — 既存プロジェクトを rules 準拠にする

> このスキルは、コードが先にあり SSOT が無い「既存プロジェクト」を、本リポジトリの rules に準拠させる**レトロフィット手順**。
> rules 本体は「SSOT が実装に先行する」前向きプロセスを前提にする（[process.md](../../../rules/engineering/practices/process.md) コア制約1）。既存プロジェクトはその逆なので、**コードから SSOT を逆生成しつつ、逆生成した SSOT を「真実」に昇格させない**のがこのスキルの肝。

## ⛔ 最重要の前提（コア制約と衝突させない）

- **コードは真実の源ではない。** コードから起こした spec / contract / GWT は、すべて **「暫定・要人間確認」** として扱う。確定させる権限は人間にある。「今こう動いているから正しい」と決めつけない。
- **作る主体と判定する主体を分ける。** 逆生成（ビルダー役）とオラクル（不整合を暴く役）は別コンテキスト（サブエージェント）で実行する。自分が起こした docs を自分で「整合している」と判定しない。
- **テスト緑は完成条件ではない。** 最後は攻撃（レッドチーム）で壊しにいく。

## 0. 準備 — ルーティングして規約を掴む

1. まず核を読む: [process.md](../../../rules/engineering/practices/process.md)（常に最初）。
2. 対象を分類し、該当する葉だけを開く（関係ない葉は開かない）:
   - docs レイアウトの住所 → [docs/layout.md](../../../rules/engineering/conventions/docs/layout.md)
   - 機能詳細(SSOT)の書式 → [feature-spec.md](../../../rules/engineering/conventions/docs/feature-spec.md)
   - commit / PR → [git.md](../../../rules/engineering/conventions/git.md)
   - platform / framework 規約 → [engineering/index.md](../../../rules/engineering/index.md) を辿る（例: Web/crow なら [coding.md](../../../rules/engineering/web/crow/coding.md) と [testing.md](../../../rules/engineering/web/crow/testing.md)）
3. スコープを宣言する。**全体を一気にやらない。** リスクの高い / 変更頻度の高いサブシステムから、縦切りスライス単位で進める（[process-agents.md](../../../rules/engineering/practices/process-agents.md) §3 の粒度判定に従う。デフォルトは粗粒度）。

## 実行フロー（逆生成 → 独立判定 → バックフィル → 攻撃）

前向きプロセス（定義→構造→振る舞い→壊す）を、既存コード起点に**折り返す**。

### Phase R1 — 現状の棚卸し（features を逆生成）

- ルート / エンドポイント / 画面 / コマンド等を走査し、**実在する機能を漏れなく列挙**して `docs/spec/features.md` に書く。
- 機能ごとに `docs/spec/<feature>.md` を作り、観測される振る舞いから**反証可能な GWT**（Given-When-Then）を起こす。ハッピーパスだけでなく、失敗・空・権限・境界の実挙動も条件化する。書式は [feature-spec.md](../../../rules/engineering/conventions/docs/feature-spec.md) の必須フォーマットに従う（ただしステータスは `draft`＝要人間確認のまま）。
- **各機能・各 GWT の先頭に `<!-- 暫定: コードから逆生成。要人間確認 -->` を必ず付す。**
- 起動: `general-purpose` サブエージェント（探索・逆生成のビルダー役）。

### Phase R2 — 契約の抽出（contracts）

- 各機能の実際の request / response の形を `docs/contracts/<feature>.md` に固定する（[docs/layout.md](../../../rules/engineering/conventions/docs/layout.md) の 1機能1契約）。
- 実装から読み取れても、**契約も「暫定・要確認」**として扱う。ここが後続テストの唯一の拠り所になる。

### Phase R3 — ADR の遡及記録（adr）

- 既存の重要な設計判断（採用フレームワーク、DB 構成、認証方式など「なぜこうなっているか」）を、`docs/adr/NNNN-YYYY-MM-DD-title.md` に**遡及的に**残す（テンプレは docs/layout.md）。
- Status は `Accepted` とし、本文冒頭に「遡及記録（retroactive）」である旨を明記する。日付は判明する範囲で。**今日の日付が必要なら、必ず環境の currentDate を使う（推測しない）。**

### Phase R4 — 独立オラクルで不整合を暴く（別コンテキスト必須）

- **別のサブエージェント**を起動し、[process-agents.md](../../../rules/engineering/practices/process-agents.md) §5-E 構造整合オラクルのミッションを与える。
- 探すのは「一致」ではなく「**不整合**」: spec が要求するのにコードに無い / コードにあるのに spec に無い機能、契約が表現できていない入出力、どの機能も使わない契約フィールド、GWT が観測と食い違う箇所。
- 見つかった不整合は「docs を直す」か「これは仕様バグでは？」の判断に振り分け、**後者は人間に上げる**（コードを真実にして黙って docs を歪めない）。

### Phase R5 — テストのバックフィル

- 該当 framework のテスト規約に従う（例: crow なら [testing.md](../../../rules/engineering/web/crow/testing.md) の AAA・strict アサーション・データプロバイダ・モックは境界だけ）。
- **テストは Phase R1 の GWT と Phase R2 の契約から起こす。実装の写経にしない。**
- レトロフィット特有の分岐: GWT はコードから逆生成したので、テストが**落ちたら**それは「逆生成 SSOT と実挙動のズレ」のシグナル。テストを緩めて通すのではなく、どちらが正しいかを人間判断に上げて解消する。
- テスト設計は実装エージェントと別コンテキストにする（[process-agents.md](../../../rules/engineering/practices/process-agents.md) §5-F）。

### Phase R6 — 壊しにいく（レッドチーム）

- スライスごとに攻撃エージェント（§5-H）、全スライス完了後に横断反証エージェント（§5-I）を別コンテキストで起動。不正入力・境界・権限回避・スライス間の相互作用・NFR を突く。
- 壊れたら欠陥として差し戻す。**壊れなかったスライスだけを準拠済みとする。**

## ✅ 完了チェックリスト

- [ ] `docs/spec/features.md` に実在機能を漏れなく列挙し、各機能に反証可能な GWT を付けた
- [ ] 逆生成した spec / contract / GWT を「暫定・要人間確認」として明示した
- [ ] `docs/contracts/` に各機能の request / response を固定した
- [ ] 重要な既存設計判断を `docs/adr/` に遡及記録した
- [ ] ビルダーとオラクルを**別コンテキスト**で回し、不整合リストが空になった
- [ ] テストを GWT / 契約から起こし、落ちたテストは「緩める」でなく人間判断で解消した
- [ ] 攻撃・横断反証で壊れなかった（テスト緑は前提であって完成条件ではない）
- [ ] コミット / PR は [git.md](../../../rules/engineering/conventions/git.md) に沿った（1スライス=1PR）

> **原則:** このスキルは rules の中身をコピペしない。手順の骨格だけを持ち、判断基準は各 rules 葉に委譲する。矛盾を感じたら、コードでなく rules（＝SSOT）側を正として扱う。
