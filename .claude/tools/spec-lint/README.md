# spec-lint

docs SSOT（機能一覧・機能詳細・契約）のフォーマット / ライフサイクルを機械検証する、
harness 同梱の依存ゼロ Node ツール。

- **検証対象の書式**: 生成する producer の craft（`../../agents/develop/ssot-definer.md` §A/§B ＝機能一覧・機能詳細、`../../agents/develop/contract-author.md` 書式リファレンス＝契約）。その書式をコードに落とした実行仕様が本ツール
- **使い方**: producer（contract-author 等）が成果物を機械検証するために直接叩く。commit-msg フックに `gate` を挿す運用も可（各プロジェクト側で任意配線）

```bash
node spec-lint.mjs validate [--docs docs]     # フォーマット＋状態機械の不変条件
node spec-lint.mjs gate --message <file>       # commit の Feature: トレーラを検証
node spec-lint.mjs gate --feature F-001         # 指定機能が fixed か
```

終了コード: `0`=OK / `1`=違反 / `2`=使い方エラー。Node のみ（外部依存なし）。
