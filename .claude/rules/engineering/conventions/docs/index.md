# 📖 docs — カタログ（ドキュメント関連の規約）

> 開発するシステムの **docs（仕様・契約・ADR 等）に関する規約**をまとめる。
> あなた（AI）は、タスクに関係する葉だけを開くこと。

- **[docs レイアウト](layout.md)** → `layout.md`
  `docs/` の標準構成（spec / contracts / adr）。SSOT の物理的な住所を定める。
  仕様・契約・ADR を**どこに置くか**を決めるときに開く。

- **[機能詳細（SSOT）の厳格フォーマット](feature-spec.md)** → `feature-spec.md`
  `docs/spec/<feature>.md` の必須フォーマット。GWT・契約・テスト・実装すべての親。
  機能詳細を**どう書くか**（＝ SSOT を作る／fixed にする）ときに開く。

<!--
  ▼ docs 成果物のフォーマットを追加したらここに 2 行で追記する（例）
- **[契約フォーマット](contract-format.md)** → `contract-format.md`
  処理インターフェース契約(request/response)の書式。契約を定義するときに開く。
-->

> **原則:** 1 葉 = 1 関心事。詳細は各ファイルに閉じ込める。
