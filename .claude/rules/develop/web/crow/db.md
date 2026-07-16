---
paths:
  - "**/crow3_*/**"
---

# 🗄️ crow — DB 設計の書式と住所（`db_design.txt`）

> crow における **DB 設計の唯一の SSOT** は、独自形式のテキストファイル `db_design.txt`。
> crow はこのファイルから**直接マイグレーションを自動生成する**（TypeScript の Prisma における `schema.prisma` に相当）。
> したがって develop の DB 設計成果物（`db-designer` の出力）は、**この `db_design.txt` そのもの**に書く。
> 手続きは develop skill の §4（docs 成果物の住所）・§6（framework 規約の受け渡し）が土台。

## 住所（どこに書くか）

- **`db_design.txt`**（crow プロジェクトが規定する所定パス。マイグレーション元）。
- develop の汎用ドラフト先（`docs/db/schema.md` 等）は**使わない**。crow ではネイティブ形式が SSOT だからだ。

## 書式（どう書くか）

- crow 独自形式で記述する。**具体的なフィールド記法・型・関連の書き方は、対象プロジェクトの crow バージョンに従う**（この葉は「どこに・何の SSOT として書くか」を定めるもので、構文そのものは各プロジェクトの crow ドキュメント／既存 `db_design.txt` を参照する）。
- 既存 `db_design.txt` があれば、その記法・命名に倣って**差分で**更新する（既存の慣習を壊さない）。

## SSOT を割らないこと（最重要）

- **`db_design.txt` を唯一の SSOT とし、`schema.md` 等へ写し替えて二重管理しない。** 二重化はマイグレーションと設計ドキュメントの不整合を静かに生む温床になる。
- DB 設計の妥当性（正規化・境界・関連）は機械では反証できない → develop の **🙋 人間ゲート**（`db-designer` はドラフトで停止、orchestrator が人間確認で確定）に従う。**確定対象のファイルは `db_design.txt`**。native 形式に draft/fixed のステータス欄が無ければ、確定は orchestrator の人間承認をもって成立とする（ファイル内に無理にステータス欄を作らない）。
