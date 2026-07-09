# 📖 conventions — カタログ（規約 / 固定フォーマット）

> platform / framework 非依存の「取り決め」。従うべき固定フォーマットを置く（機械的に検証できるもの）。
> あなた（AI）は、タスクに関係するカタログ／葉だけを開くこと。

- **[docs](docs/index.md)** → `docs/index.md`
  ドキュメント関連の規約（docs レイアウト、機能詳細＝SSOT の厳格フォーマット 等）。
  仕様・契約・ADR の配置や書式を決めるときに開く。

- **[Git 規約](git.md)** → `git.md`
  commit メッセージ（Conventional Commits）と PR テンプレート。PR は 1 スライス単位。
  コミットする／PR を作るときに開く。

- **[enforcement](enforcement/index.md)** → `enforcement/index.md`
  規約を機械的に強制する SSOT（3層モデル・チェック→ツール対応・config）。commit/coding/test/secret/層 の
  フック・CI・ブランチ保護を設定するときに開く。

- **[セットアップ冪等性規約](setup-idempotency.md)** → `setup-idempotency.md`
  config 生成・フック導入を「冪等・自己完結・非破壊・スコープ閉じ」に保つ4原則と共有資源の dedup。
  設定を伴う作業（enforcement / 設定系 skill）で開く。

<!--
  ▼ 規約カタログ／葉を追加したらここに 2 行で追記する。
    まとまり（docs のような）はサブフォルダ＋index.md にし、単発は直下の *.md に置く。
-->

> **原則:** 1 葉 = 1 関心事。詳細は各カタログ／ファイルに閉じ込める。
