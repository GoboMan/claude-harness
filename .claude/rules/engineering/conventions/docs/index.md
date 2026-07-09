# 📖 docs — カタログ（ドキュメント関連の規約）

> 開発するシステムの **docs（仕様・契約・ADR 等）に関する規約**をまとめる。
> あなた（AI）は、タスクに関係する葉だけを開くこと。

- **[docs レイアウト](layout.md)** → `layout.md`
  `docs/` の標準構成（spec / contracts / adr）。SSOT の物理的な住所を定める。
  仕様・契約・ADR を**どこに置くか**を決めるときに開く。

- **[機能一覧の厳格フォーマット](feature-list.md)** → `feature-list.md`
  `docs/spec/features.md` の必須フォーマット。全機能を漏れなく列挙する目次（Phase 1 の土台）。
  機能一覧を**どう書くか**（＝スコープを出し切る）ときに開く。

- **[機能詳細（SSOT）の厳格フォーマット](feature-spec.md)** → `feature-spec.md`
  `docs/spec/<feature>.md` の必須フォーマット。GWT・契約・テスト・実装すべての親。
  機能詳細を**どう書くか**（＝ SSOT を作る／fixed にする）ときに開く。

- **[処理インターフェース契約の厳格フォーマット](contract.md)** → `contract.md`
  `docs/contracts/<feature>.md` の必須フォーマット。UI と処理の境界（request / response）を固定する第一級成果物。
  契約を**どう書くか**（＝ Phase 3 で境界を固める）ときに開く。

> **原則:** 1 葉 = 1 関心事。詳細は各ファイルに閉じ込める。
