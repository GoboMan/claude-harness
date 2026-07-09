# 📖 engineering — カタログ（システム開発シーンの目次）

> あなた（AI）はこの目次を読み、**今のタスクに関係するカタログ／ケースだけ**を開いてください。
> 各項目は「2行の概要」と「ファイルパス」で構成されています。関係ないものは開かないこと。

## 🧠 まず必ず読む（核）

> ⚠️ **engineering の作業では、カタログ階層に関わらず、必ず最初に [practices/process.md](practices/process.md)（核）を読むこと。**
> これは全開発の不変の核（コア制約・全体フロー・完成条件）。この直リンクで、階層のどこにいても核は必ずロードされる。

## 📂 カタログ（対象に応じて開く）

- **[practices](practices/index.md)** → `practices/index.md`
  進め方＝判断を伴う方法論（反証駆動・縦切りスライス）。process.md（核）と実行台本。
  開発の進め方・設計・技術選定を決めるときに開く。

- **[conventions](conventions/index.md)** → `conventions/index.md`
  規約＝従うべき固定フォーマット（docs レイアウト、commit / PR）。
  ドキュメント構成やコミット／PR を書くときに開く。

- **[web](web/index.md)** → `web/index.md`
  Web プラットフォーム。framework 非依存の共通ルールと、framework 別（crow 等）への分岐を持つ。
  Web の実装・規約に関わるタスクで開く。

- **[native](native/index.md)** → `native/index.md`
  Native（モバイル等）プラットフォーム。framework 別への分岐を持つ。
  ネイティブアプリの実装・規約に関わるタスクで開く。

<!--
  ▼ シーン直下にサブカタログ（方法論・規約・プラットフォーム）を足したらここに2行で追記する。
    各カタログの中の分岐は、その `index.md` が持つ。
-->

## 🗺️ ロードの目安（タスク → 辿るカタログ／ケース）

| タスク例 | 辿り先 |
| --- | --- |
| 新機能の設計・実装の進め方を決める | `practices/process.md`（核）（＋実行時に `practices/process-agents.md`） |
| Web（crow 等）の実装・修正 | 核 ＋ `web/index.md` → 該当 framework |
| ネイティブアプリの実装・修正 | 核 ＋ `native/index.md` → 該当 framework |
| コミット / PR を書く | `conventions/git.md` |
| docs / ADR の配置を決める | `conventions/docs/index.md` → `layout.md` |
| 機能詳細(SSOT)を書く | `conventions/docs/index.md` → `feature-spec.md` |
| 機械チェック（フック / CI / ブランチ保護）を設定する | `conventions/enforcement/index.md` → 該当葉（＋ `conventions/setup-idempotency.md`） |
| バグ修正 | 核（＋ 該当プラットフォーム / framework） |

> **原則:** このカタログには規約の中身をコピペしない。詳細は各カタログ／ケース Markdown に閉じ込める。
