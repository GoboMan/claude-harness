# spec-lint

docs SSOT（台帳・機能詳細・契約）のフォーマット / ライフサイクルを機械検証する、
harness 同梱の依存ゼロ Node ツール。

- **検証対象のレイアウト**: `docs/specs/specs.md`（台帳）＋ `docs/specs/F-xxx-<slug>/`（`spec.md`・`api-contract.yaml`）＋ `docs/specs/_shared/components.yaml`。`docs/PRD.md`・`docs/design.md` があれば境界違反（PRD への GWT 混入等）も warn する
- **検証対象の書式**: SSOT は `../../templates/develop/` のテンプレート。spec.md の必須セクション・必須フロントマター・契約の必須 `x-` キーは**テンプレートから導出**する（書式改定はテンプレートを直せば lint も追従。書き方の判断規則は各 producer craft が持つ）
- **契約（OpenAPI 3.1）の検証範囲**: ライフサイクル（`x-status`）・ID 整合（ディレクトリ名 ↔ `x-feature-id`）・`x-spec`／`$ref` の参照解決・spec との突き合わせまで。**OpenAPI としての完全な構文検証は producer が `npx @redocly/cli lint` 等で行う**（依存ゼロを保つための分担）
- **使い方**: producer（contract-author 等）が成果物を機械検証するために直接叩く。commit-msg フックに `gate` を挿す運用も可（各プロジェクト側で任意配線）

```bash
node spec-lint.mjs validate [--docs docs]     # フォーマット＋状態機械の不変条件＋docs 衛生
node spec-lint.mjs gate --message <file>       # commit の Feature: トレーラを検証
node spec-lint.mjs gate --feature F-001         # 指定機能の spec / 契約が fixed か
```

終了コード: `0`=OK / `1`=違反 / `2`=使い方エラー。Node のみ（外部依存なし）。
旧レイアウト（`docs/spec` ＋ `docs/contracts`）を検出した場合は移行を促して `1` を返す。

## err にするもの（状態機械・参照の不変条件）

- 必須フロントマター／必須セクション／必須 `x-` キーの欠落、`draft|fixed` 以外の状態
- ディレクトリ名 `F-xxx-<slug>` 違反・機能ID の不一致・重複、`spec.md` の欠落
- 台帳との不整合（列挙漏れ・リンク切れ・状態の食い違い）
- 親 spec が `draft` なのに契約が `fixed`、`fixed` なのにプレースホルダ残存
- `x-spec`／`$ref` の参照が解決しない

## docs 衛生検出（すべて warn）

spec / 契約が「現在形の不変条件」から逸脱して情報堆積場になる兆候を warn で検出する
（負のリストの SSOT は各 producer craft。ssot-definer / contract-author の「書かないもの」）:

| 検出 | 対象 | 意味 |
| --- | --- | --- |
| 冒頭 blockquote の堆積 | spec | 改訂経緯・差分ナラティブは commit message / ADR へ |
| 本文中の日付括弧（`（2026-01-01` 等） | spec / 契約 | 経緯は git が持つ。本文は現在形に統合 |
| 実装アンカー（コードのファイルパス。契約は行番号付きのみ） | spec / 契約 | コードが SSOT。docs に書くと腐る |
| 内部 API 参照（`クラス::メソッド`） | spec | spec は観測可能な振る舞いの語彙で書く |
| 「既知の課題／残存リスク／バックログ」セクション | spec | 未解決は issue 管理へ排出（fixed spec に未決を溜めない） |
| 肥大（spec 12,000 文字超 / 契約 400 行超） | spec / 契約 | 1 関心事を超えた堆積の疑い。**spec は行数でなく文字数で測る**（1 行 1,000 文字の spec が「300 行」で閾値をすり抜けた実例があるため） |
| 業務ルールが 30 本超 | spec | spec の本体（1 規則 1 文の不変条件）。過大なら機能が大きすぎる疑い |
| 業務ルール 1 本が 150 文字超 | spec | 1 規則 1 文になっていない（複数の規則が 1 本に圧縮されている）。本数の上限だけでは段落化で迂回できるため長さも見る |
| 受け入れ条件が 15 本超 | spec | 受け入れ条件は規則を補う代表例であって**テストケースの一覧ではない**（ケースの網羅は test-designer の職務。規則 1 本 → テスト N 本が正常な比率）。本数の膨張は規則の言い換え・値違いの列挙・欠陥ごとの 1 本追加の堆積 |
| 他機能への参照が 20 件超 | spec | 参照先の振る舞いを複製している疑い。共有される振る舞いは所有機能の spec だけが持ち、他は参照 1 行に留める |
| 入力表の型・必須・制約列 | spec | 型情報の正は契約。spec は「名前｜業務上の意味」のみ |
| 業務ルール再掲の `x-*`（state-transition 等） | 契約 | 規則・判定順序は spec。契約は境界の形だけ |
| 長い `description`（8 行超 / 200 字超） | 契約 | 目的・規則・UI 説明は spec。summary 1 行と短い注記のみ |
| PRD に GWT／受け入れ条件 | PRD | 機能別の受け入れ条件は spec の関心事（境界違反） |

err にしない理由: 既存プロジェクトの validate を即死させないため（浄化は差分更新の機会に順次）。
