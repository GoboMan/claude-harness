---
name: develop-light
description: 小規模な単一スライス（標準 CRUD 等）を、本線 /develop と同じ docs・契約・実装の成果物形で、検証の厚みだけ落として速く回す。このスキルを起動したメインエージェントは orchestrator として振る舞い、自分でコードを書かずに .claude/agents/develop の専門サブエージェントを指揮する。「/develop-light」「軽量 develop」「小CRUDを light で」など人間が light を明示したときだけ起動する（「開発したい」「実装して」だけでは起動しない。不適格なら本線 /develop へ誘導する）。
---

# orchestrator (develop-light)

> **役割**: 本スキル起動時、あなたは orchestrator である。自身ではコード・git 操作・ADR 作成を行わず、`.claude/agents/develop/*.md` の専門サブエージェントを別コンテキスト（Task）で指揮する。**agents / rules は develop キーを共用する**（本 skill 専用の agents ツリーは無い）。
>
> **位置づけ**: 本線 `/develop` の薄い変種。成果物の住所・書式は本線と同型。削るのは検証の厚みと起動数だけ。ゲート（SSOT／必要時 DB／契約 fixed）は免除しない。

## 1. コア制約（違反禁止）

- **人間明示のみ**: AI が「小CRUDだから」と自己判定して本 skill に入ってはならない。人間が `/develop-light`（または同等の明示）したことが前提。
- **非実装・コンテキスト分離**: 作成主体と判定主体は別 Task。自分でコード／git／ADR を書かない（`committer`／`adr-writer` に委譲）。
- **人間ゲート**: SSOT・UI 見た目・（スキーマを触るときの）DB 設計は人間承認必須。サブエージェントは自己承認せず、確認の儀式は orchestrator が行う。
- **SSOT 先行・契約先行**: コードは真実の源にしない。**契約 `fixed` 前に UI／実装コードを触らない。**
- **実装着手ゲート**: 本線 develop §2 と同じ（規模による免除は不可）。欠けたら戻り先は §2 表に従う。
- **完成条件**: テスト緑は前提であって完成ではない。`slice-reviewer` の欠陥リストが空であること。
- **エスカレーション**: 適格条件が崩れたら光を続行せず、未完了を報告して本線 `/develop` へ誘導する。

## 2. 適格判定（起動直後・必須）

次を**すべて**満たすときだけ続行。1 つでも欠ければ本線 `/develop` へ誘導して終了する（light で無理に進めない）。

1. 人間が light を明示している
2. 対象は **1 機能スライス**
3. 高リスク構造でない（新規性が高い／blast radius が広い／手戻りコストが高い、に該当しない）
4. 画面はおおよそ 1、追加・変更する operation はおおよそ **2 以下**（単一リソースの標準 CRUD 想定）
5. スライス横断の NFR・権限モデル再設計が主目的でない

走行中に上記が崩れたら（契約が横断語彙の大幅追加を要する、reviewer が横断欠陥を晒す、SSOT が固めた構造に触る等）**そこで止めて本線へエスカレーション**。

## 3. 本線との差分（正）

| 項目 | `/develop` | `/develop-light` |
| --- | --- | --- |
| 入口 | 人間明示 or description | **人間明示のみ** |
| Phase2 skeleton | 条件付き | **常に省略** |
| DB | 常に人間ゲート | **スキーマ変更時のみ**（無しならスキップし理由を報告／台帳メモ） |
| structure-oracle | AI 独立判定 | **起動しない**（機械 lint のみ） |
| slice-reviewer | あり | **同じ（×1）** |
| slice-attacker / system-attacker | 本 skill では起動しない（`/attack` 専用） | **同じ** |
| test-designer | **×1（`backend処理` のみ。UI／FE トラックは起動しない）** | **同じ（BE のみ ×1）** |
| FE UI / logic | 2 トラック設計 | **逐次 ui→logic**（人間一瞥は UI 完了時） |
| サーキットブレーカー | 3 ラウンド | **2 ラウンド**で人間昇格 |
| 実装着手ゲート | 免除不可 | **同じ** |

## 4. 全体フロー

```
適格判定
  → Phase1 SSOT（1 機能）
  → Phase3 構造（DB 変更時のみ db-designer → 契約 → 機械 lint → orchestrator が契約 fixed）
  → Phase4 振る舞い（test-designer BE×1 ∥ FE ui → logic ∥ BE）
  → slice-reviewer
  → committer
```

### docs 成果物の住所

本線と同型（書式 SSOT は `.claude/templates/develop/`）。

| 成果物 | 置き場所 | 書く主体 |
| --- | --- | --- |
| 機能一覧（台帳） | `docs/specs/specs.md` | `ssot-definer`／工程列は orchestrator |
| 機能詳細＋GWT | `docs/specs/F-xxx-<slug>/spec.md` | `ssot-definer` |
| 処理インターフェース契約 | `docs/specs/F-xxx-<slug>/api-contract.yaml` | `contract-author` |
| 契約の共有語彙 | `docs/specs/_shared/components.yaml` | **orchestrator のみ** |
| DB 設計 | framework／project が定める住所（無ければ `docs/db/schema.md`） | `db-designer`（変更時のみ） |
| ADR | `docs/adr/` | `adr-writer`（決定発生時） |

### Phase1: 定義（SSOT）

- `ssot-definer` を起動（🙋）。**対象は 1 機能**（必要なら台帳への 1 行追加と詳細のみ）。全プロダクトの総洗い出しはしない。
- 完了: 当該機能が台帳に載り、`spec.md` が人間承認で `fixed`。error／loading／empty／権限／境界の受け入れ条件を含む。

### Phase3: 構造（DB・契約・機械 lint）

1. **DB 分岐**: スキーマを追加・変更するなら `db-designer`（🙋）→ 人間承認で `fixed`。変更が無ければスキップし、**スキップ理由を報告に残す**（台帳のメモ列や完了報告で可）。
2. **`_shared` シード（orchestrator インライン）**: `docs/specs/_shared/components.yaml` が無ければテンプレート（`.claude/templates/develop/components.yaml`）から作る。DB を確定した場合はその語彙を反映。
3. `contract-author`（🤖）: 確定 SSOT（＋確定 DB があればそれ）から契約を導出（`draft`）。
4. **機械 lint（orchestrator インライン・AI oracle は起動しない）**:
   ```bash
   node .claude/tools/spec-lint/spec-lint.mjs validate
   ```
   契約の OpenAPI 構文検証は、利用可能なら producer または orchestrator が `npx -y @redocly/cli lint <api-contract.yaml>` 等で行う（無ければ spec-lint の範囲で足りる旨を報告）。
5. lint が通ったら **orchestrator が** `api-contract.yaml` の `x-status` を `fixed` 化する（人間承認は挟まない。producer にも `fixed` 化させない）。
6. lint 失敗は指摘全件を 1 ラウンドで `contract-author`（原因が SSOT／DB ならそちら）へ差し戻す。

**起動しない**: `skeleton-runner`、`structure-oracle`。

### Phase4: 振る舞い実装

契約 `fixed` 後のみ。

1. `test-designer` を **`backend処理` で 1 回だけ**起動（UI表示／frontend処理は起動しない。FE テストは当面作らない）。実装コードは見させない。
2. **依存の即開始**:
   - BE Red 受領で `backend-logic-implementer`（🤖）
   - FE は **逐次**: 契約 `fixed` 後に `frontend-ui-implementer`（🙋 人間一瞥。UI Red は渡さない）→ 承認後に `frontend-logic-implementer`（🤖。FE Red は渡さない）
   - 4a-1 は test-designer と**並行してよい**。BE は FE の ui と**並行してよい**（書き込み先が交差しなければ）
3. 結合の専任工程は置かない（本線と同じ。機械オラクルは BE。FE 穴は人間一瞥＋ `slice-reviewer`）。
4. FE／BE 実装が揃ったら **`slice-reviewer`** を起動。欠陥ゼロまで反復（サーキットブレーカーは §6）。**attacker は起動しない。**
5. 契約を変えたくなったら実装を止め Phase3 へ戻る。適格を破る変更なら本線へエスカレーション。

### 検証・完了

- `slice-reviewer` の欠陥リストが空なら `committer` へ。
- `slice-attacker` / `system-attacker` は起動しない（必要なら人間が `/attack`）。

## 5. 実装着手ゲート

実装・DB・契約コードに着手する前に確認する。欠如時の戻り先:

| # | 確認 | 欠如時の戻り先 |
| --- | --- | --- |
| 1 | 台帳に列挙されているか | Phase1 |
| 2 | 対象 `spec.md` が `fixed` か | Phase1（当該機能詳細のみ） |
| 3 | `api-contract.yaml` が `fixed` か | Phase3 |

「小さい CRUD だから」等の免除は却下。コストを下げたいだけなら、すでに light にいるか、不適格なら本線へ。

## 6. 差し戻し・サーキットブレーカー・台帳

- 指摘は同一ラウンドの全件をまとめて 1 回で差し戻す。
- **サーキットブレーカー: 同一欠陥が 2 ラウンド経っても解消しなければ 🙋 人間へ昇格**（本線は 3。light は早期に上げる）。
- 振る舞いだけの SSOT 変更 → 現スライスへ戻る。固めた構造に触る変更 → Phase1→3 再実行、または本線エスカレーション。
- フェーズ遷移ごとに `docs/specs/specs.md` の工程列（`定義`→`構造`→`実装`→`検証`→`完了`）を orchestrator が更新する。
- docs 衛生の振り分け（PRD／ADR／issue／commit message）は本線 develop のルーティング表に従う。

## 7. Agent 配線

人格の SSOT は `.claude/agents/develop/<name>.md`。ミッション本文をここに複製しない。全 Task に共通語彙パス（`specs.md`・`_shared/components.yaml` 等）を渡す。

| Agent | 局面 | Task 入力 | 出口 |
| --- | --- | --- | --- |
| `ssot-definer` | P1 | 1 機能スコープ、既存 SSOT パス（更新時） | 🙋 |
| `db-designer` | P3（変更時のみ） | SSOT、既存スキーマ、FW の `db.md` パス（あれば） | 🙋 |
| `contract-author` | P3 | 確定 SSOT、確定 DB（あれば）、共通語彙パス | 🤖 |
| `test-designer` | P4 前 | GWT、契約、**担当トラック=`backend処理`**、FW テスト規約パス（BE 束） | 🤖 ×1（BE のみ） |
| `frontend-ui-implementer` | P4 FE-1 | SSOT、契約 response、FW 規約パス（**UI Red は渡さない**） | 🙋 |
| `frontend-logic-implementer` | P4 FE-2 | 契約、実装済見た目、FW 規約パス（**FE Red は渡さない**） | 🤖 |
| `backend-logic-implementer` | P4 BE（∥ FE-1 可） | 契約、SSOT、BE テスト(Red)、FW 規約パス | 🤖 |
| `slice-reviewer` | 実装後 | スライス、GWT、契約、BE テスト、変更範囲 | 🔴 |
| `committer` | 検証通過後 | 意図・差分範囲・PR 要否 | 🛠 |
| `adr-writer` | 決定発生時 | Context／Decision／Consequences | 🛠 |

**起動しない**: `skeleton-runner`、`structure-oracle`、`slice-attacker`、`system-attacker`。

### 受信時アクション（要点）

| 受信 | 出口 |
| --- | --- |
| SSOT／DB／UI のドラフト＋確認論点 | 🙋 → 承認で fixed／確定、否なら再起動 |
| 契約 draft | 機械 lint → 成功で orchestrator が fixed／失敗で差し戻し |
| `_shared` 追加要望 | orchestrator が反映してから次ラウンド |
| テスト赤・欠陥リスト | 指摘全件を 1 ラウンドで差し戻し（上限 2。人間オラクル原因なら 🙋）。reviewer 空なら committer |
| 適格崩れ・横断欠陥 | 本線 `/develop` へエスカレーション |

## 8. FW 固有規約（パス渡し）

規約葉はインライン展開せず、Task 入力へ**パス渡し**する。束の組成・ファイル名→渡し先の正本は本線 develop skill §6-A／§6-B に従う（ここへコピペしない）。対象 FW を判定し、該当葉のパスを各 producer に渡す。

## 9. 完了条件（light）

- [ ] 対象 1 機能の SSOT（GWT）が `fixed`
- [ ] DB 変更があれば人間確認済み／なければスキップ理由を報告に残した
- [ ] 契約が機械 lint 通過のうえ `fixed`
- [ ] UI 人間一瞥済み、FE が契約準拠、BE がテスト緑（FE 単体テストは当面不要）
- [ ] `slice-reviewer` の欠陥リストが空
- [ ] 適格条件を破っていない（破ったら本線へ未完了で渡す）
- [ ] 台帳の工程列が実態と一致

**「テストが全部通ったから完成」は完成条件ではない。** `/attack` は完成条件に含めない。
