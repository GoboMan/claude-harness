# claude-harness

AI（特に Claude）の**コンテキストを極限までクリーンに保ちながら**、AI 自身が必要なルールだけを自律的にロードするための、**階層型ルーティング（Prompt as Code）** 共通プロンプトリポジトリです。

---

## 🎯 思想：なぜ「全部盛り」をやめるのか

多くのプロジェクトでは `CLAUDE.md` に規約・スタック・執筆ルールを全部書き込みます。しかしこれは以下の問題を生みます。

- **コンテキスト汚染**: フロントの作業中にブログ執筆ルールまで読まされ、判断がぶれる。
- **保守不能**: 1 ファイルが肥大化し、どこに何があるか誰も分からなくなる。
- **トークンの浪費**: 使わないルールを毎回ロードする。

そこで本リポジトリは、ルールを **「シーン → プラットフォーム → framework → 関心」** という階層に分解し、AI に **「今必要な葉ノードだけ」** を辿らせます。

## 🧭 統治ルール（この構造の唯一の原則）

> **ある階層の `.md` ＝ その抽象度のルール／サブフォルダ ＝ さらに具体化した特殊化。深いほど具体的。**
> **ツリーの軸は「種類(kind)」であって「プロジェクト」ではない。**

- 上の階層ほど抽象（全開発に効く思想）、下るほど具体（framework 固有の規約）。
- プロジェクト固有の逸脱は**この共有リポジトリに置かない**。各プロジェクトの `CLAUDE.md` に書く（共有リポジトリは常に汎用）。
- **ルーティングの分岐点となるフォルダは、直下に `index.md`（カタログ）を持つ。親は子 `index.md` に委譲する**（全フォルダ一律）。
- **必ず読ませたい核は、カタログ階層を無視して直リンクで名指しする**（例: `practices/process.md`）。これで奥にあっても核は必ずロードされる。

## 🗺️ 階層ルーティング（深さ＝具体度）

```text
CLAUDE.md                道案内（ルーター）    … どのシーンを見るか
  └─ <dir>/index.md      カタログ（各階層）    … 子カタログ／ケースへの2行概要＋パス。親は子 index に委譲
       └─ …（必要な深さだけ潜る。各フォルダに index.md がある）
            └─ *.md       ケース（個別ルール）  … 実際に読ませる中身
  ⋯ 核など必ず読ませるものは、階層を無視して直リンクで名指し（例: practices/process.md）
```

| 階層 | 例 | 役割 | 中身 |
| --- | --- | --- | --- |
| 🧭 ルーター | `CLAUDE.md` | 道案内 | シーン判定と `index.md` への誘導のみ |
| 📖 カタログ | `<scene>/index.md` | 目次 | 各ケース／下位カタログの2行概要とパス |
| 🗂️ サブカタログ | `<scene>/<platform>/index.md` | 目次（下位） | framework などへの分岐 |
| 📦 ケース | `.../<framework>/*.md` | 実ルール | 具体的な規約・手順・思想 |

> **原則:** 上位ノードは下位ノードの「存在と概要」しか知らない。詳細は葉に閉じ込める。AI は必要になって初めて葉を開く。

## 📂 ディレクトリ構成

```text
claude-harness/
 ├── README.md               # このファイル
 ├── CLAUDE.template.md      # 各プロジェクトに配置する CLAUDE.md の雛形（最上位ルーター）
 ├── init.sh                 # 導入スクリプト（このリポジトリを .claude/ として配置）
 │
 └── .claude/
      ├── rules/
      │    ├── engineering/                 # 🎬 シーン: システム開発
      │    │    ├── index.md                # 📖 カタログ（委譲＋核への直リンク）
      │    │    ├── practices/              # 🧠 方法論（判断を伴う進め方・platform非依存）
      │    │    │    ├── index.md
      │    │    │    ├── process.md         # 核（常時ロード）
      │    │    │    └── process-agents.md  # 実行台本（局面ごとにロード）
      │    │    ├── conventions/            # 📐 規約（固定フォーマット・platform非依存）
      │    │    │    ├── index.md
      │    │    │    ├── docs/              # 📁 docs 関連の規約
      │    │    │    │    ├── index.md
      │    │    │    │    ├── layout.md         # docs レイアウト（spec/contracts/adr）
      │    │    │    │    └── feature-spec.md   # 機能詳細(SSOT)の厳格フォーマット
      │    │    │    └── git.md             # commit / PR 規約
      │    │    ├── web/                    # 🖥️ プラットフォーム: Web
      │    │    │    ├── index.md           # web共通 + framework 分岐
      │    │    │    └── crow/              # 📦 framework: crow（PHP独自FW）
      │    │    │         ├── index.md
      │    │    │         ├── coding.md     # コーディング規約
      │    │    │         └── testing.md    # テスト設計（PHPUnit）
      │    │    └── native/                 # 🖥️ プラットフォーム: Native
      │    │         └── index.md           # framework 分岐（未登録・箱のみ）
      │    │
      │    └── routines/                    # 🎬 シーン: 日常業務
      │         ├── index.md                # 📖 カタログ
      │         └── writings/               # ✍️ 執筆
      │              ├── index.md
      │              └── blog.md            # 📦 ブログ執筆のルール
      │
      └── skills/                           # 🛠️ 共通スキル（description で自動起動）
           ├── productivity/
           │    ├── grilling/SKILL.md
           │    └── grill-me/SKILL.md
           └── engineering/
                ├── retrofit-to-rules/SKILL.md          # 既存プロジェクトを rules 準拠に引き上げる
                └── git-guardrails-claude-code/SKILL.md # 危険な git 操作をブロック（スクリプト同梱）
```

> 💡 **機械チェック（commit / coding / test / secret / 層 のフック・CI・ブランチ保護）は skill ではなく
> [rules/engineering/conventions/enforcement/](.claude/rules/engineering/conventions/enforcement/index.md) に SSOT を置く。**
> セットアップは副作用が目的で純関数化できず、rules は遅延ロードされるため、durable な知識は rules に畳む。
> skill は「実行アセット同梱」か「多段・エージェント的手続き」のときだけ。

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

- `.claude/`（rules・skills）を対象プロジェクトへ配置（既定 submodule。他に symlink / copy）
- submodule の場合、harness の**リリースタグ（`v*`）の最新に固定**する（`--tag` で特定版も可）
- `CLAUDE.template.md` を `CLAUDE.md` としてルートに設置（既存があれば温存）

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
- ルーター `CLAUDE.template.md` が新リリースで変わっていれば**警告のみ**表示する（`CLAUDE.md` は温存し自動更新しない → 手動で反映）。
- チーム運用では、A を clone した人は `git submodule update --init` で `.claude` の実体を取得する。版を進める bump は**一本化**する（各自が勝手に進めない）。

### 2. 動作イメージ

ユーザーが「crow で作った画面のバグを直して」と依頼した場合：

1. AI は `CLAUDE.md`（ルーター）を読み、**engineering シーン**だと判定。
2. `engineering/index.md` を開き、まず核 `practices/process.md` を読む。対象は **web** と判断 → `web/index.md` へ。
3. `web/index.md` で **crow** を選び、`web/crow/index.md`（および該当する葉）だけをロードして作業開始。
4. **native や routines のルールは一切読み込まない。**

> 実プロジェクトでは、そのプロジェクトの `CLAUDE.md` に「これは web/crow」と書いておけば、AI は分岐を省いて最短で葉に到達します。

## ➕ 拡張のしかた

新しいルールを足すときは「葉から生やす」だけです。

1. 適切な階層にケース Markdown を追加（例: `web/crow/coding.md`、新 framework なら `web/laravel/index.md`）。
2. その階層の `index.md` に **2行概要とパス** を追記。
3. 完了。`CLAUDE.md` は原則いじらない（新しい**シーン**を足すときだけ触る）。

> **プロジェクト固有のルールはここに足さない。** 共有リポジトリは汎用ルールのみ。案件ごとの逸脱は各プロジェクトの `CLAUDE.md` に書く。

## 🧩 設計ルール（コントリビュート時の約束）

- **階層＝抽象度**: 上ほど抽象、下ほど具体。深さで具体度を表す。
- **軸は種類(kind)、プロジェクトではない**: プロジェクト別ディレクトリを作らない。
- **1 ケース = 1 関心事**: ファイルは小さく、単一責務に保つ（coding / testing …）。
- **カタログの概要は 2 行**: それ以上書きたくなったら、それはケース本文の仕事。
- **上位は下位の詳細を知らない**: `index.md` に規約の中身をコピペしない。リンクで誘導する。
- **参照は相対パスで**: 移設・submodule 化に強くする。
