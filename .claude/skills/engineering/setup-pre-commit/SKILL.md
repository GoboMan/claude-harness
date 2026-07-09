---
name: setup-pre-commit
description: 現在のリポジトリに、lint-staged（Prettier）、型チェック、テストを備えた Husky の pre-commit フックをセットアップする。ユーザーが pre-commit フックを追加したい、Husky をセットアップしたい、lint-staged を設定したい、あるいはコミット時のフォーマット／型チェック／テストを追加したい場合に使用する。
---

# Setup Pre-Commit Hooks

## このスキルがセットアップするもの

- **Husky** の pre-commit フック
- ステージ済みの全ファイルに対して Prettier を実行する **lint-staged**
- **Prettier** の設定（存在しない場合）
- pre-commit フック内での **typecheck** および **test** スクリプト

## 手順

### 1. パッケージマネージャーを検出する

`package-lock.json`（npm）、`pnpm-lock.yaml`（pnpm）、`yarn.lock`（yarn）、`bun.lockb`（bun）の有無を確認する。存在するものを使用する。判別できない場合は npm をデフォルトとする。

### 2. 依存関係をインストールする

devDependencies としてインストールする。

```
husky lint-staged prettier
```

### 3. Husky を初期化する

```bash
npx husky init
```

これにより `.husky/` ディレクトリが作成され、package.json に `prepare: "husky"` が追加される。

### 4. `.husky/pre-commit` を作成する

このファイルを書き込む（Husky v9 以降では shebang は不要）。

```
npx lint-staged
npm run typecheck
npm run test
```

**適宜調整する**: `npm` を検出したパッケージマネージャーに置き換える。リポジトリの package.json に `typecheck` や `test` スクリプトが存在しない場合は、該当する行を省略し、その旨をユーザーに伝える。

### 5. `.lintstagedrc` を作成する

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

### 6. `.prettierrc` を作成する（存在しない場合）

Prettier の設定が存在しない場合にのみ作成する。次のデフォルト値を使用する。

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

### 7. 検証する

- [ ] `.husky/pre-commit` が存在し、実行可能になっている
- [ ] `.lintstagedrc` が存在する
- [ ] package.json の `prepare` スクリプトが `"husky"` になっている
- [ ] Prettier の設定が存在する
- [ ] `npx lint-staged` を実行して動作を確認する

### 8. コミットする

変更・作成した全ファイルをステージし、次のメッセージでコミットする: `Add pre-commit hooks (husky + lint-staged + prettier)`

このコミットによって新しい pre-commit フックが実行されるため、すべてが正しく動作するかの良いスモークテストになる。

## 補足

- Husky v9 以降ではフックファイルに shebang は不要
- `prettier --ignore-unknown` は Prettier がパースできないファイル（画像など）をスキップする
- pre-commit ではまず lint-staged（高速で、ステージ済みファイルのみ）を実行し、続いて型チェックとテスト全体を実行する
