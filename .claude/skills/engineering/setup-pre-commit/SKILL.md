---
name: setup-pre-commit
description: 現在のリポジトリに、スタック（PHP/crow は PHPCS＋PHPUnit、JS/TS は ESLint）に応じた pre-commit フックをセットアップする。コミット時にコーディング規約チェック・テストを走らせたい、Husky もしくは Node 非依存の core.hooksPath でフックを入れたい場合に使用する。
---

# Setup Pre-Commit Hooks

コミット前に **コーディング規約チェックとテスト**を走らせるローカルゲートをセットアップする。
このリポジトリの規約（[coding.md](../../../rules/engineering/web/crow/coding.md) /
[testing.md](../../../rules/engineering/web/crow/testing.md)）に沿わせるため、**スタックを検出して道具を分ける**。

> ⚠️ **Prettier は使わない。** coding.md は Allman＋TAB を要求するが Prettier は Allman を出せず TAB も既定で
> 潰す。規約の機械チェックは `enforce-coding-standards`（PHP=PHPCS / JS=ESLint）に委譲する。本スキルは
> その `lint:code` とテストを **フックに接続する**役。

## このスキルがセットアップするもの

- pre-commit フック（Husky もしくは Node 非依存の `core.hooksPath`）
- フックから **`lint:code`（規約チェック）** と **テスト** を実行
- 規約チェック本体（phpcs / eslint 設定）は `enforce-coding-standards` が用意する（未導入なら先に案内）

## 手順

### 1. スタックとフック方式を検出する

- `composer.json` / `*.php` → **PHP（crow）**：テストは PHPUnit（`vendor/bin/phpunit`）
- `package.json` → **JS/TS**：テストは package.json の `test` スクリプト
- **フック方式**:
  - `package.json` があり Node が使える → **Husky**
  - 純 PHP など Node を入れたくない → **`core.hooksPath`**（Node 非依存・後述）

### 2. 規約チェック（lint:code）を用意する

`enforce-coding-standards` が生成する `lint:code`（PHP=`phpcs` / JS=`eslint`）を前提にする。
未導入なら **先に `enforce-coding-standards` を実行**するようユーザーに案内する。

### 3A. Husky でフックを作る（Node プロジェクト）

```bash
npx husky init
```

`.husky/pre-commit` に書き込む（Husky v9+ は shebang 不要）:

```
npm run lint:code
npm run test
```

`typecheck` スクリプトがあれば行を足す。存在しないスクリプトの行は省き、その旨を伝える。

### 3B. core.hooksPath でフックを作る（純 PHP / Node 非依存）

Husky（Node）を入れずに、**リポジトリに commit するフック**で同じことをする。

```bash
mkdir -p .githooks
git config core.hooksPath .githooks
```

`.githooks/pre-commit`（`chmod +x`）:

```bash
#!/usr/bin/env bash
set -euo pipefail

composer run lint:code
vendor/bin/phpunit
```

> `core.hooksPath` はリポジトリに `.githooks/` を含められるので、clone した他者にも配れる（`.git/hooks`
> と違い共有可能）。ただし各自 `git config core.hooksPath .githooks` の実行が要る旨を README に添える。

### 4. 検証する

- [ ] フック（`.husky/pre-commit` または `.githooks/pre-commit`）が存在し実行可能
- [ ] `lint:code`（phpcs/eslint）が呼ばれている ＝ `enforce-coding-standards` と接続済み
- [ ] テスト（PHPUnit / npm test）が呼ばれている
- [ ] 規約違反（space インデント等）やテスト失敗で commit が止まる

### 5. コミットする

`chore: add pre-commit hook (lint:code + tests)`

## 補足

- pre-commit は `--no-verify` で回避できる **一次防衛**。回避不可の裏取りは `setup-ci-checks`（CI）で行う。
- コミットメッセージ規約は関心事が別。`setup-commitlint`（commit-msg フック）を使う。
- 秘密情報スキャンを足すなら `setup-secret-scanning` をこのフックに接続する。
- process.md の通り **フック緑は前提であって完成条件ではない**。最後は攻撃（レッドチーム）で壊しにいく。
