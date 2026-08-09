# templates/develop — docs 成果物のテンプレート（書式の SSOT）

各テンプレートは **producer（書く側）と spec-lint（検証する側）が共有する唯一の書式定義**。
spec-lint は `spec.md` の必須セクション・必須フロントマターを本ディレクトリのテンプレートから導出するため、書式改定はテンプレートを直せば lint も追従する（二重化しない）。

| テンプレート | 生成先（取り込み先プロジェクト） | 書く主体 |
| --- | --- | --- |
| `PRD.md` | `docs/PRD.md` | 人間（orchestrator 代筆可） |
| `design.md` | `docs/design.md` | 人間（orchestrator 代筆可） |
| `specs.md` | `docs/specs/specs.md`（台帳） | ssot-definer／工程列は orchestrator |
| `spec.md` | `docs/specs/F-xxx-<slug>/spec.md`（振る舞い） | ssot-definer |
| `api-contract.yaml` | `docs/specs/F-xxx-<slug>/api-contract.yaml`（境界の形） | contract-author |

`spec.md` と `api-contract.yaml` は機能ディレクトリの MIS（2 ファイルで 1 機能の SSOT）。列・キーの形は本テンプレート、何を書かないかの判断は各 producer craft。
| `components.yaml` | `docs/specs/_shared/components.yaml` | orchestrator のみ（producer は追加要望を報告） |

- プレースホルダ（`F-000`・`YYYY-MM-DD`・`<...>`）は `fixed` 化前に必ず実値へ置換する（spec-lint が検証）。
- 書き方の判断規則（負のリスト・craft）はテンプレートに書かない。各 producer の agent body が持つ。
