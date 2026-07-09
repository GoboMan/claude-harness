---
name: setup-commitlint
description: 現在のリポジトリに、commitlint（Conventional Commits）と .gitmessage テンプレートを備えた Husky の commit-msg フックをセットアップし、コミットメッセージ規約を定義・強制する。ユーザーがコミットメッセージの規約を定義したい、Conventional Commits を強制したい、commitlint を設定したい、commit-msg フックを追加したい、あるいはコミットメッセージの雛形（テンプレート）を用意したい場合に使用する。
---

# Setup Commitlint

コミットメッセージの規約を **定義** し、それを **機械的に強制** する commit-msg フックをセットアップする。あわせて書き手向けの雛形（`.gitmessage`）を用意する。

コードの中身（lint / 型 / テスト）を検査する pre-commit フックとは関心事が別なので、このスキルは独立している。コード側のゲートが必要なら `setup-pre-commit` を使う。

## このスキルがセットアップするもの

- **commit-msg フック**（Husky）— コミットメッセージを毎回検証する（機械ゲート）
- **commitlint** + **@commitlint/config-conventional** — Conventional Commits を規約として定義
- **`.gitmessage`** テンプレート + `git config commit.template` — 書き手向けの雛形（ガイド）

## 規約：Conventional Commits

強制される書式は次のとおり。

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**（必須）: `feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`
- **scope**（任意）: 影響範囲。例 `feat(auth): ...`
- **subject**（必須）: 変更内容の要約

例:

```
feat(auth): add login endpoint
fix: handle null token
docs: update README
```

## 手順

### 1. パッケージマネージャーを検出する

`package-lock.json`（npm）、`pnpm-lock.yaml`（pnpm）、`yarn.lock`（yarn）、`bun.lockb`（bun）の有無を確認する。存在するものを使用する。判別できない場合は npm をデフォルトとする。

### 2. 依存関係をインストールする

devDependencies としてインストールする。

```
husky @commitlint/cli @commitlint/config-conventional
```

### 3. Husky を初期化する（未導入の場合）

`.husky/` が既に存在する場合はこの手順を飛ばす（`setup-pre-commit` などで既に導入済みのことがある）。

```bash
npx husky init
```

これにより `.husky/` ディレクトリが作成され、package.json に `prepare: "husky"` が追加される。

### 4. `.husky/commit-msg` を作成する

このファイルを書き込む（Husky v9 以降では shebang は不要）。

```
npx --no-install commitlint --edit "$1"
```

`$1` は git が渡すコミットメッセージファイルのパス。

> 注意: `.husky/pre-commit` を上書きしないこと。commit-msg は別ファイルとして共存する。

### 5. `commitlint.config.js` を作成する

これが **規約の定義本体**（機械可読な規則）。

```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
```

type を増減するなどのカスタムが必要なら、ユーザーに確認のうえ `rules` を追記する。例（type を絞り込む場合）:

```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "refactor", "test", "chore"],
    ],
  },
};
```

### 6. `.gitmessage` を作成する（書き手向けの雛形）

コミット時にエディタへ表示される雛形。`#` 始まりの行はコメントとして無視される。

```
# <type>(<scope>): <subject>   ← 50字以内を目安。末尾にピリオドは付けない
#
# --- body（任意。何を・なぜ。72字で折り返す） ---
#
#
# --- footer（任意。BREAKING CHANGE: / Closes #123 など） ---
#
# type: feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert
```

### 7. commit.template を設定する

`.gitmessage` を雛形として登録する。

```bash
git config commit.template .gitmessage
```

> このコマンドはローカルの `.git/config` に書き込まれ、リポジトリを clone した他者には自動適用されない。README や CONTRIBUTING に「`git config commit.template .gitmessage` を実行してください」と一文添えるとよい旨をユーザーに伝える。

### 8. 検証する

- [ ] `.husky/commit-msg` が存在する
- [ ] `commitlint.config.js` が存在する
- [ ] `.gitmessage` が存在し、`git config commit.template` が設定されている
- [ ] package.json の `prepare` スクリプトが `"husky"` になっている
- [ ] 違反メッセージが弾かれることを確認する:

  ```bash
  echo "bad message" | npx commitlint
  ```

  終了コードが 0 以外になり、規約違反が報告されるはずである。

- [ ] 正しいメッセージが通ることを確認する:

  ```bash
  echo "feat: add commitlint setup" | npx commitlint
  ```

### 9. コミットする

変更・作成した全ファイルをステージし、次のメッセージでコミットする: `chore: add commit-msg hook (commitlint + conventional commits)`

このコミット自体が Conventional Commits 準拠なので、新しい commit-msg フックの良いスモークテストになる。

## 補足

- Husky v9 以降ではフックファイルに shebang は不要
- commit-msg フックは **機械ゲート**。`git commit` すれば人間でも Claude でも自動的に発火し、規約違反を確実に弾く
- `.gitmessage` はあくまで **ガイド**であり強制力はない。強制するのは commit-msg フック側
- `git commit -m` のようにエディタを開かないコミットでは `.gitmessage` は表示されないが、commit-msg フックによる検証は依然として効く
