# 📦 ドキュメント構成（docs レイアウトの標準）

> 全開発共通・**platform / framework 非依存**の「型」。開発するシステムの `docs/` の標準構成を固定する。
> これは [process.md](../../practices/process.md) が要求する **SSOT（信頼できる唯一の情報源）の物理的な住所**を定めるもの。
> 各 docs 成果物の**厳格なフォーマット**は同じ `docs/` フォルダの各ファイル（例: [feature-spec.md](./feature-spec.md)）が定める。
> process.md は「SSOT が実装に先行する」と*概念*を定めるが、それを*どこに置くか*は本書が定める。

## 原則

- **固定するのは全プロジェクト共通の最小骨格だけ。** 案件固有の docs（その案件だけの運用手順など）は、各プロジェクトの `docs/` に自由に足してよい（共有ルールとしては固定しない）。
- **SSOT は実装に先行する。** コードを真実の源にしない。実装が仕様の欠陥を暴いたら、コードでなく `docs/spec/` を更新する（process.md の差し戻しルール）。
- **1 ファイル 1 関心事**、参照は相対パス。

## 標準構成

```text
docs/
├── spec/            # SSOT: 仕様（実装に先行する真実の源）
│   ├── features.md   #   機能一覧（全機能の列挙）
│   └── <feature>.md  #   機能ごとの詳細 + 受け入れ条件(GWT)
├── contracts/       # 処理インターフェース契約(request / response)
│   └── <feature>.md  #   UI と処理の境界。1 機能 1 契約
└── adr/             # アーキテクチャ決定記録(ADR)
    └── NNNN-YYYY-MM-DD-title.md
```

### process.md の成果物との対応

| process.md の成果物 | 置き場所 |
| --- | --- |
| 機能一覧 | `docs/spec/features.md` |
| 機能詳細 ＋ GWT 受け入れ条件（＝基準SSOT） | `docs/spec/<feature>.md` |
| 処理インターフェース契約（Phase 3） | `docs/contracts/<feature>.md` |
| アーキテクチャ上の決定（なぜその設計か） | `docs/adr/NNNN-YYYY-MM-DD-title.md` |

## spec/（SSOT）

- `features.md` に全機能を漏れなく列挙する（process.md Phase 1）。
- 機能ごとに `<feature>.md` を作り、機能詳細と **反証可能な GWT 受け入れ条件**を書く。ハッピーパスだけでなく失敗・空・権限・境界も含める。
- 実装方法には踏み込まない（仕様は実装非依存）。

## contracts/（処理インターフェース契約）

- UI と処理の境界＝各機能の request / response の形を、実装前に固定する（process.md Phase 3・コア制約 6）。
- 1 機能 1 契約。UI 実装・処理実装・テスト設計はこの契約だけを拠り所にする。
- ※ OpenAPI 等のコード資産で契約を表現する場合は、その所在を `contracts/<feature>.md` から参照する形でもよい。

## adr/（アーキテクチャ決定記録）

「なぜその設計を選んだか」を1決定1ファイルで残す。後から経緯を追え、覆すときは新 ADR で **supersede** する。

### ファイル名

```
NNNN-YYYY-MM-DD-title.md
例) 0007-2026-07-09-adopt-phpunit-for-crow.md
```

- **`NNNN`（通し番号・4桁ゼロ埋め）** = 安定した参照 ID。「ADR-0007」「ADR-0012 で置換」のように相互参照する。番号は新規採番のみで、欠番・再利用しない。
- **`YYYY-MM-DD`** = 決定日。一覧を開かず時系列が分かる。
- **`title`** = 内容を表す snake / kebab の短い語。

### テンプレート

```markdown
# ADR-0007: crow のテストに PHPUnit を採用する

- **Date**: 2026-07-09
- **Status**: Accepted   <!-- Proposed / Accepted / Superseded by ADR-XXXX -->

## Context
（何が問題で、どんな制約・選択肢があったか）

## Decision
（何を決めたか。1つに絞る）

## Consequences
（この決定で得られるもの・トレードオフ・今後の制約）
```

- **Status** は `Proposed → Accepted` と遷移し、覆されたら `Superseded by ADR-XXXX` にして本文は残す（履歴を消さない）。

## ✅ ドキュメント着手前チェックリスト

- [ ] 実装より先に `docs/spec/` の機能一覧・GWT を用意したか
- [ ] UI/処理に着手する前に `docs/contracts/` の契約を固定したか
- [ ] 設計上の重要な決定を `docs/adr/` に残したか（番号＋日付のファイル名で）
- [ ] 仕様変更はコードでなく `docs/spec/` を正として更新したか
