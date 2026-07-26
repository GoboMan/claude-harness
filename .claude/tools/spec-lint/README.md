# spec-lint

docs SSOT（機能一覧・機能詳細・契約）のフォーマット / ライフサイクルを機械検証する、
harness 同梱の依存ゼロ Node ツール。

- **検証対象の書式**: 生成する producer の craft（`../../agents/develop/ssot-definer.md` §A/§B ＝機能一覧・機能詳細、`../../agents/develop/contract-author.md` 書式リファレンス＝契約）。その書式をコードに落とした実行仕様が本ツール
- **使い方**: producer（contract-author 等）が成果物を機械検証するために直接叩く。commit-msg フックに `gate` を挿す運用も可（各プロジェクト側で任意配線）

```bash
node spec-lint.mjs validate [--docs docs]     # フォーマット＋状態機械の不変条件＋docs 衛生
node spec-lint.mjs gate --message <file>       # commit の Feature: トレーラを検証
node spec-lint.mjs gate --feature F-001         # 指定機能が fixed か
```

終了コード: `0`=OK / `1`=違反 / `2`=使い方エラー。Node のみ（外部依存なし）。

## docs 衛生検出（すべて warn）

spec / 契約が「現在形の不変条件」から逸脱して情報堆積場になる兆候を warn で検出する
（負のリストの SSOT は各 producer craft。ssot-definer §B / contract-author「契約に書かないもの」）:

| 検出 | 対象 | 意味 |
| --- | --- | --- |
| 冒頭 blockquote の堆積 | spec / 契約 | 改訂経緯・差分ナラティブは commit message / ADR へ |
| 本文中の日付括弧（`（2026-01-01` 等） | spec / 契約 | 経緯は git が持つ。本文は現在形に統合 |
| 実装アンカー（コードのファイルパス。契約は行番号付きのみ） | spec / 契約 | コードが SSOT。docs に書くと腐る |
| 内部 API 参照（`クラス::メソッド`） | spec | spec は観測可能な振る舞いの語彙で書く |
| 「既知の課題／残存リスク／バックログ」セクション | spec | 未解決は issue 管理へ排出（fixed spec に未決を溜めない） |
| 肥大（spec 300 行超 / 契約 400 行超） | spec / 契約 | 1 関心事を超えた堆積の疑い |

err にしない理由: 既存プロジェクトの validate を即死させないため（浄化は差分更新の機会に順次）。
