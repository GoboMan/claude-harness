---
paths:
  - ".husky/**"
  - ".githooks/**"
  - ".github/workflows/**"
  - "commitlint.config.*"
  - "phpcs.xml*"
  - "eslint.config.*"
  - ".eslintrc*"
  - "deptrac.yaml"
  - ".dependency-cruiser.*"
  - ".gitleaks.toml"
  - "package.json"
  - "composer.json"
---

# 📦 セットアップ冪等性規約（何度流しても・併用しても壊れない）

> config 生成・フック導入・ツール設定などの**セットアップ作業は副作用が目的**なので純関数にはなり得ない。
> だが実務上は **「冪等・自己完結・非破壊・スコープ閉じ」** を満たせば純関数的に扱える。本書はその固定基準を定める。
> [enforcement/](./enforcement/index.md) の各葉に沿って設定を材料化するとき、および設定を伴う skill（[git-guardrails](../../../skills/git-guardrails-claude-code/SKILL.md) 等）を書くときに従う。

## なぜ必要か

セットアップは単独でも複数併用でも走る。同じ資源に**無ガードで追記・上書き**すると、2回実行や併用で
**行の重複・設定の clobber・グローバル汚染**が起きる。これが「純関数的でない」状態。ガードを規約化して断つ。

## 4原則

### 1. check-before-write（clobber しない）

- 既存のファイル・設定があれば、**黙って上書きしない**。マージするか、ユーザーに確認する。
- 新規生成は必ず「**無ければ作る**」を明示する（既にあれば差分提示のうえ確認）。

### 2. dedup 追記（共有資源は入れる前に有無を確認）

- フック行・スクリプトなど**共有資源への追記は、既存を検査してから**行う。
- 追記の定石（フック行）:

  ```bash
  line='gitleaks protect --staged --redact --verbose'
  grep -qF "$line" .githooks/pre-commit || printf '%s\n' "$line" >> .githooks/pre-commit
  ```

- `package.json` / `composer.json` の `scripts` は**キー存在を確認**し、既存キーを上書きしない
  （衝突時はユーザーに確認）。read-modify-write でマージする。

### 3. インターフェースを宣言する（自己完結）

セットアップ手順（葉 / skill）の冒頭に、以下を**明示**する。暗黙の結合を作らない。

- **前提**: 依存する設定（例: `lint:code` は [coding-standards.md](./enforcement/coding-standards.md) が定義）・環境（gitleaks バイナリ、Node/PHP 等）
- **生成物**: 作る／変更するファイル
- **触る共有資源**: 下表のうちどれに追記するか
- **スコープ**: プロジェクト内か、グローバルか

### 4. スコープを閉じる（既定はプロジェクト）

- 既定は**プロジェクト内**（`.claude/` / リポジトリ配下）に閉じる。
- `~/.claude` などプロジェクト外・グローバルへの書き込みは、**明示的 opt-in のときだけ**。既定にしない。

## 既知の共有可変資源（複数の手順が触る＝要 dedup）

| 資源 | 触りうる enforcement 葉 / skill |
| --- | --- |
| `.husky/pre-commit` / `.githooks/pre-commit` | [hooks.md](./enforcement/hooks.md)（coding-standards / layer-boundaries / secrets を配線） |
| `.githooks/commit-msg` / `.husky/commit-msg` | [hooks.md](./enforcement/hooks.md)（commit 規約） |
| `package.json` の `scripts` | [coding-standards.md](./enforcement/coding-standards.md), [layer-boundaries.md](./enforcement/layer-boundaries.md) |
| `composer.json` の `scripts` | 同上 |
| `.github/workflows/*.yml` | [ci.md](./enforcement/ci.md), [secrets.md](./enforcement/secrets.md) |
| `.claude/settings.json` / `~/.claude/settings.json` の `hooks` | [git-guardrails](../../../skills/git-guardrails-claude-code/SKILL.md) |

> これらに触るときは、必ず **grep/キー存在チェック → 無ければ追記** の形にする。上書き・無条件追記は禁止。

## ✅ セットアップ着手前チェックリスト

- [ ] 冒頭で 前提 / 生成物 / 触る共有資源 / スコープ を宣言したか
- [ ] 既存ファイル・設定を clobber せず、マージ or 確認にしているか
- [ ] 共有資源への追記に dedup ガード（grep / キー存在確認）を入れたか
- [ ] グローバル（`~/.claude` 等）への書き込みは opt-in に限っているか
- [ ] 2回連続で流しても結果が同じ（重複行・重複エントリが出ない）か
