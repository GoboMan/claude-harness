# claude-harness

AI（特に Claude）の**ベースライン・コンテキストをゼロに保ちながら**、AI 自身が必要なルールだけを必要な瞬間にロードするための、**オンデマンド型ルーティング（Prompt as Code）** 共通プロンプトリポジトリです。

---

## 🎯 思想：なぜ「全部盛り」をやめるのか

多くのプロジェクトでは `CLAUDE.md` に規約・スタック・業務ルールを全部書き込みます。しかしこれは以下の問題を生みます。

- **コンテキスト汚染**: フロントの作業中に翻訳ルールまで読まされ、判断がぶれる。
- **保守不能**: 1 ファイルが肥大化し、どこに何があるか誰も分からなくなる。
- **トークンの浪費**: 使わないルールを毎回ロードする。

そこで本リポジトリは、ルールを **「シーン → プラットフォーム → framework → 関心」** という階層に分解し、AI に **「今必要な葉ノードだけ」** をロードさせます。**常駐する目次（カタログ）すら持ちません。**

## 🧭 統治ルール（この構造の唯一の原則）

> **ある階層の `.md` ＝ その抽象度のルール／サブフォルダ ＝ さらに具体化した特殊化。深いほど具体的。**
> **ツリーの軸は「種類(kind)」であって「プロジェクト」ではない。**

- 上の階層ほど抽象（全開発に効く思想）、下るほど具体（framework 固有の規約）。
- プロジェクト固有の逸脱は**この共有リポジトリに置かない**。各プロジェクトの `CLAUDE.md` に書く（共有リポジトリは常に汎用）。
- **常駐ゼロ**: 目次ファイル（旧 `index.md`）は置かない。`CLAUDE.md` ルーターも `settings.json` の自動注入も使わない。ベースラインに載るルールは **0**。
- **各葉は `paths:` フロントマターで自己申告する**。対象ファイルを触った瞬間だけ、Claude Code ネイティブの `.claude/rules/` 機構が該当葉を注入する（遅延ロード）。
- **手続き（進め方）は skill が入口**。orchestrator の判断核・実行台本は develop skill 自体が内包する（rules に置かない）。producer / committer / adr-writer の craft は各 agent body が持つ。

## 🗺️ オンデマンド・ルーティング（常駐ゼロ）

発見経路は次の 3 つだけ。**いずれも「必要になった瞬間」にしか発火しない。**

```text
① paths ゲート … 各葉の frontmatter `paths:` にマッチするファイルを触ると、その葉だけ注入
   例) crow3_* 配下を触る          → web/crow/{overview,coding,testing,db}.md が載る

② skill エントリ … 手続きは skill として description 自動起動 or /name 明示起動
   例) 「開発したい」/develop → develop skill に orchestrator の核・実行台本が丸ごと載る

③ producer の craft … 成果物の書式は、それを生成するサブエージェント本文が SSOT
   例) 機能一覧/機能詳細の書式 → agents/develop/ssot-definer.md（spawn 時のみロード）
       契約の書式             → agents/develop/contract-author.md（同上）
```

> ルーティングは **Claude Code ネイティブの `.claude/rules/` 機構**が担う（CLAUDE.md ルーター不要・`settings.json` は空）。
> 目次は常駐しない。葉は `paths` にマッチした時だけ、orchestrator の核・台本は /develop 起動時に skill 本文で、それぞれロードされる。

| 要素 | 例 | 役割 | ロード契機 |
| --- | --- | --- | --- |
| 📦 ケース（葉） | `.../<framework>/*.md` | 実ルール（規約・思想） | `paths` にマッチしたファイルを触った時 |
| 🧬 producer craft | `agents/develop/ssot-definer.md` の書式節 | 成果物の書式 SSOT | 当該サブエージェント spawn 時のみ |
| 🛠️ スキル | `.claude/skills/<name>/SKILL.md` | 手続きの入口（develop は orchestrator の判断核・実行台本を内包） | `description` で自動／`/name` で明示 |
| 🤖 エージェント | `.claude/agents/develop/<name>.md` | 専門サブエージェントの人格 | orchestrator が Task 起動する時 |

> **原則:** どのノードも「存在」を常駐で宣言しない。AI は skill を起動するか、対象ファイルを触って初めて葉を開く。

## 📂 ディレクトリ構成

```text
claude-harness/
 ├── README.md               # このファイル
 ├── init.sh                 # 導入スクリプト（このリポジトリを .claude/ として配置）
 │
 └── .claude/
      ├── settings.json                    # 空（{}）。自動注入もルーターも持たない＝常駐ゼロ
      │
      ├── rules/                           # 📦 葉のみ。目次(index.md)は持たない
      │    ├── develop/                    #   🎬 シーン: システム開発（旧 engineering）※判断核・台本は develop skill 内
      │    │    └── web/                    #     🖥️ プラットフォーム: Web（builder 規約）
      │    │         └── crow/              #       📦 framework: crow（PHP独自FW）
      │    │              ├── overview.md   #         入口・全体像
      │    │              ├── coding.md     #         コーディング規約
      │    │              ├── testing.md    #         テスト設計（PHPUnit）
      │    │              └── db.md         #         DB 設計の書式・住所（db_design.txt）
      │    │
      │    └── translate-manga-ko-ja/       #   🈯 翻訳の型（overview/register/consistency/master-format/script-format）
      │
      ├── agents/                           # 🤖 サブエージェント（key 別に集約）
      │    ├── develop/                      #   開発（/develop の orchestrator が Task 起動）
      │    │    ├── ssot-definer.md                # Phase1 機能一覧・詳細（人間ゲート）
      │    │    ├── db-designer.md, contract-author.md  # Phase3 構造（DB＝人間ゲート／契約＝機械）
      │    │    ├── structure-oracle.md            # 構造整合の独立判定
      │    │    ├── test-designer.md               # GWT＋契約から Red テスト（実装前）
      │    │    ├── frontend-ui-implementer.md     # Phase4a-1 見た目（html/css/js）
      │    │    ├── frontend-logic-implementer.md  # Phase4a-2 frontend 処理・純粋関数
      │    │    ├── backend-logic-implementer.md   # Phase4b backend 処理・純粋関数
      │    │    ├── slice-attacker.md, system-attacker.md # 攻撃（スライス／横断）
      │    │    ├── skeleton-runner.md             # 高リスク時のみ E2E 貫通（使い捨て）
      │    │    ├── committer.md                    # commit / PR の実行専任（git 規約を body に内包）
      │    │    └── adr-writer.md                   # アーキテクチャ決定記録(ADR)を書く producer（書式を body に内包）
      │    └── translate-manga-ko-ja/        #   翻訳（/translate-manga-ko-ja の orchestrator が Task 起動）
      │         ├── maker.md                       # 翻訳の1脳（Stage1–4：対訳シート＋master差分提案）
      │         └── judge.md                       # 独立レビュー（Stage5：ブレ・口調矛盾・⚠漏れを反証）
      │
      ├── skills/                           # 🛠️ 共通スキル（description で自動起動 / /name で明示起動）
      │    │  ※ skill は必ず skills/<name>/SKILL.md の1階層に置く（Claude Code はこの階層しか探索しない）
      │    ├── develop/SKILL.md                    # 🎼 開発の指揮者（orchestrator）。核・台本を内包。入口 /develop
      │    ├── translate-manga-ko-ja/SKILL.md      # 🈯 翻訳の指揮者（orchestrator）。maker/judge を起動。入口 /translate-manga-ko-ja
      │    └── grilling/SKILL.md                   # 計画・設計を詰めるインタビュー
      │
      └── tools/                            # 🔧 実行アセット（バリデータ・生成器）
           ├── spec-lint/                         # docs SSOT 検証（producer が直接叩く）
           └── cursor-sync/                        # .claude の3木(rules/skills/agents) → Cursor の .cursor/ へ射影
```

> 💡 **harness が同梱する機械チェックは「検証ツール」だけ**（`tools/spec-lint`＝docs SSOT 検証）。producer がタスク中に直接叩く。
> **フック / CI への配線・ブランチ保護といった「設置」は各プロジェクトの責務**（かつて `enforcer` エージェント＋`conventions/enforcement/` が担ったが、入口 skill の廃止に伴い撤去）。durable な知識は agent body / rules に畳み、実行アセットは `.claude/tools/` に置く。

## 🧱 手続きの3木（skills / agents / rules を同じキーで揃える）

orchestrator を伴う手続き（`develop`・`translate-manga-ko-ja` など）は、**同じキー名で3つの木に分かれて存在する**。人間も AI も、キーを1つ知れば「入口・実行者・型」が一目で辿れる。これが本リポジトリの手続きの標準形である。

| 木 | 役割（何の SSOT か） | develop | translate-manga-ko-ja |
| --- | --- | --- | --- |
| `skills/<key>/SKILL.md` | 入口＝orchestrator の判断核・実行台本（**どう回すか**） | `skills/develop/` | `skills/translate-manga-ko-ja/` |
| `agents/<key>/*.md` | orchestrator が Task 起動する専門サブエージェントの人格（**craft** の SSOT） | `agents/develop/`（ssot-definer・committer …） | `agents/translate-manga-ko-ja/`（maker・judge） |
| `rules/<key>/**` | paths ゲートで遅延ロードされる型・規約の葉（**書式** の SSOT） | `rules/develop/web/crow/` | `rules/translate-manga-ko-ja/` |

- **skill は複製しない。** 型は rules、craft は agent body が SSOT。skill は「どう回すか」だけを持ち、両者の中身をコピペしない。
- **作る主体 ≠ 判定する主体。** どちらの手続きも producer（develop=implementer 群 / 翻訳=maker）と独立オラクル（develop=oracle/attacker 群 / 翻訳=judge）を**別 agent・別コンテキスト**に分ける。
- **キー名は3木で一致させる。** 新しい手続きを足すときも、この3木を同名で生やす（skills/agents/rules すべて同じ `<key>`）。

## 🚀 使い方

### 1. 導入

取り込みたいプロジェクト**だけ**で実行します（実行しないプロジェクトは一切関与しない＝opt-in）。

```bash
# 既定は submodule 配置（チーム・共有リポジトリ向け）
./init.sh /path/to/your-project

# 方式を選ぶ場合
./init.sh /path/to/your-project --mode symlink   # 個人・同一マシン向け
./init.sh /path/to/your-project --mode copy      # スナップショット（更新は伝播しない）
```

`init.sh` は以下を行います（詳細はスクリプト参照）。

- `.claude/`（rules・agents・skills・tools・空の settings.json）を対象プロジェクトへ配置（既定 submodule。他に symlink / copy）
- submodule の場合、harness の**リリースタグ（`v*`）の最新に固定**する（`--tag` で特定版も可）
- ルーター用の CLAUDE.md は設置しない（routing はネイティブ `.claude/rules` ＋ skill が担う。プロジェクト固有の事実が要るなら各プロジェクトが自分で CLAUDE.md を用意する）

> **前提（submodule 運用）**: harness を共有リモートへ push し、リリースを**タグで切る**こと（例: `git tag v0.1.0 && git push --tags`）。update はこのタグ単位で版を進める。

### 1-2. 導入後に harness の更新（SSOT）を取り込む

harness 側でルールを更新し**新しいリリースタグを切ったら**、取り込み済みプロジェクトで反映します。

```bash
# submodule（既定）: 最新リリースへ固定してコミットでピン留め（プロジェクト内で実行）
cd /path/to/your-project
/path/to/claude-harness/init.sh update          # 最新の v* タグへ
/path/to/claude-harness/init.sh update --tag v0.1.0   # 特定版へ（巻き戻しも可）

# submodule 配置に付属する init.sh を使ってもよい（clone 済みなら）
./.claude-harness/init.sh update

# symlink: このリポジトリを pull するだけで全プロジェクトに即反映（プロジェクト側の操作は不要）
# copy   : 再度 ./init.sh ... --force で上書き
```

- `update` は **submodule 配置専用**。gitlink を最新リリースへ進め、`chore: set claude-harness to <tag>` として自動コミット（`--no-commit` でコミット省略）。
- チーム運用では、A を clone した人は `git submodule update --init` で `.claude` の実体を取得する。版を進める bump は**一本化**する（各自が勝手に進めない）。

### 2. 動作イメージ

ユーザーが「crow で作った画面のバグを直して」と依頼した場合：

1. AI は `/develop` を起動（明示、または skill の `description` で自動）。メインエージェントが **orchestrator** になる。
2. orchestrator の判断核・実行台本は develop skill 本文に載っており（別ファイル Read 不要）、対象は **web/crow** と判断。`crow3_*` 配下を触ると `web/crow/` の葉（`coding.md` 等）が `paths` ゲートで載る。
3. orchestrator が `.claude/agents/develop/` の専門サブエージェントを順に Task 起動し、修正を進める（人間ゲートは orchestrator が担当、commit は `committer` に委譲）。
4. **native や routines のルールは一切載らない**（常駐ゼロ。触っていない葉は 0 バイトもロードされない）。

> 実プロジェクトでは、そのプロジェクトの `CLAUDE.md`（任意）に「これは web/crow」と書いておけば、AI は判定を省いて最短で葉に到達します。

## 🖱️ Cursor で併用する

同じ SSOT（`.claude/`）を **Cursor でもそのまま効かせられる**。Cursor 2.4 で subagents / skills が入り、`.claude` の3木すべてに対応する読み口ができた。そこで **`.claude` を SSOT のまま、その純粋な射影として `.cursor` を機械生成する**（`.claude/tools/cursor-sync/`）。二重管理はしない。**develop の芯である「別コンテキストの独立オラクル分離」も、Cursor の独立コンテキスト subagent でそのまま保たれる。**

```bash
# 導入時にまとめて生成
./init.sh install /path/to/your-project --cursor

# 既に導入済み／harness を update した後に再生成
./init.sh cursor /path/to/your-project      # 対象省略でカレント repo
```

**対応表（3木すべて写る）**

| Claude 機構 | Cursor 2.4 での対応 | 射影 |
| --- | --- | --- |
| `rules/**/*.md` の `paths:` ゲート | `.cursor/rules/**/*.mdc` の `globs:`（Auto Attached） | `paths:`→`globs:`+`alwaysApply:false`。常駐ゼロ維持（触るまで載らない） |
| `skills/<name>/SKILL.md`（`/name`・description 自動） | `.cursor/skills/<name>/SKILL.md`（同じく `/name`・自動発見） | 複製（形式互換） |
| `agents/<name>.md`（独立コンテキスト subagent） | `.cursor/agents/<name>.md`（独立コンテキスト・自動/`/name`/並列） | 複製＋`model:`を`inherit`へ正規化 |

> **なぜ agents も射影するのか（Cursor は `.claude/agents` も直接読むのに）:** 各 agent は `model: opus`（判断ゾーン）または `model: inherit`（決定論ゾーン）を持つが、Cursor は前者を解決できない恐れがある。そこで `.cursor/agents/`（名前衝突時に `.claude/agents/` より優先）へ `model: inherit` に正規化した版を置いて上書きする。`tools:` は Cursor が解釈しないが害が無いので残す（read-only オラクル/攻撃の規律は各 agent body の指示で担保される）。

- ディレクトリ構造は保持する（Cursor はネストした `.cursor/rules` / `.cursor/agents` を再帰探索する）。skills は `.cursor/skills` のみ読む（`.claude/skills` は読まない）ため射影が必須。
- 生成物には `GENERATED by ... — do not edit` を刻む。**編集は `.claude/` 側（SSOT）で行い、`init.sh cursor` で再生成する**。生成器はこのマーカ付きファイルだけを入れ替えるので、手書きの `.cursor/**` は保護される。
- `.cursor/**` は生成スナップショットなので、`.claude` を submodule/symlink で更新しても自動追従しない。**harness を update したら `init.sh cursor` を再実行する**こと。
- **要 Cursor 実機確認**: 配線は済んでいるが、subagent の委譲挙動・`model: inherit` の妥当性・SKILL 本文の delegation 指示が Cursor でどう解釈されるかは、実際の Cursor 2.4+ で一度通して確認すること。

## ➕ 拡張のしかた

新しいルールを足すときは「葉を生やして `paths` を付ける」だけです。目次への追記は要りません。

1. 適切な階層にケース Markdown を追加（例: `web/crow/coding.md`、新 framework なら `web/laravel/coding.md`）。
2. その葉の frontmatter に `paths:`（発火するファイルの glob）を書く。手続きが要るなら skill を足す。
3. 完了。**常駐する目次が無いので、他ファイルの書き換えは不要。**

> **プロジェクト固有のルールはここに足さない。** 共有リポジトリは汎用ルールのみ。案件ごとの逸脱は各プロジェクトの `CLAUDE.md` に書く。

## 🧩 設計ルール（コントリビュート時の約束）

- **階層＝抽象度**: 上ほど抽象、下ほど具体。深さで具体度を表す。
- **軸は種類(kind)、プロジェクトではない**: プロジェクト別ディレクトリを作らない。
- **1 ケース = 1 関心事**: ファイルは小さく、単一責務に保つ（coding / testing …）。
- **常駐ゼロを崩さない**: 目次ファイルを復活させない。発見は `paths` ゲートと skill 直リンクだけで賄う。
- **葉には必ず `paths:`**: 発火条件を自己申告させる。手続きの入口が要るなら skill にする。
- **参照は相対パスで**: 移設・submodule 化に強くする。
```
