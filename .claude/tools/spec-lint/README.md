# spec-lint

docs SSOT（機能一覧・機能詳細・契約）のフォーマット / ライフサイクルを機械検証する、
harness 同梱の依存ゼロ Node ツール。

- **検証仕様の SSOT**: `../../rules/engineering/conventions/docs/`（feature-list / feature-spec / contract）
- **強制の位置づけ**: `../../rules/engineering/conventions/enforcement/spec-lint.md`

```bash
node spec-lint.mjs validate [--docs docs]     # フォーマット＋状態機械の不変条件
node spec-lint.mjs gate --message <file>       # commit の Feature: トレーラを検証
node spec-lint.mjs gate --feature F-001         # 指定機能が fixed か
```

終了コード: `0`=OK / `1`=違反 / `2`=使い方エラー。Node のみ（外部依存なし）。
