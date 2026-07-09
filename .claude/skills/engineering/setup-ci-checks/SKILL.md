---
name: setup-ci-checks
description: PR / push 時にサーバ側で lint・型チェック・テスト（および任意でアーキテクチャチェック）を強制する GitHub Actions ワークフローをセットアップする。ユーザーが PR の lint チェックを追加したい、CI で型チェックやテストを回したい、GitHub Actions を設定したい、あるいはローカル pre-commit フックのサーバ側の裏取り（回避不可のゲート）を用意したい場合に使用する。
---

# Setup CI Checks

PR / push 時に **サーバ側で** 検査を走らせる CI ワークフローをセットアップする。ローカル pre-commit フックは `--no-verify` で回避でき環境にも依存するため、CI は **回避不可・全員に必ず効く最終ゲート**として補完的に重要。

`setup-pre-commit`（ローカル）と同じ検査を CI で裏取りする位置づけ。既存のフックがあるなら、その内容と揃えるとよい。**スタック（PHP/crow か JS/TS か）を検出してジョブを分ける。**

## このスキルがセットアップするもの

- **GitHub Actions ワークフロー**（`.github/workflows/ci.yml`）
- PR（`pull_request`）と主要ブランチへの push で発火
- **規約チェック（`lint:code`）／テスト**の各ステップ（`enforce-coding-standards` と揃える）
- 任意で **アーキテクチャチェック**（`enforce-layer-boundaries` 導入済みなら `arch:check`）

## 手順

### 1. スタックを検出する

- `composer.json` / `*.php` → **PHP（crow）** ジョブ（setup-php / composer / phpcs / **PHPUnit**）
- `package.json` → **JS/TS** ジョブ（setup-node / eslint / test）
- 両方あるなら 2 ジョブ用意する。

### 2. 実行するコマンドを確認する

`enforce-coding-standards` / `setup-pre-commit` が用意したものと揃える。存在するものだけ含める。

- PHP: `composer run lint:code`（phpcs）／`vendor/bin/phpunit`（testing.md の PHPUnit）
- JS/TS: `npm run lint:code`（eslint）／`npm run test`／`npm run typecheck`
- `arch:check`（`enforce-layer-boundaries` 導入時・PHP は deptrac / JS は depcruise）

存在しないコマンドは含めず、その旨をユーザーに伝える。

### 3A. `.github/workflows/ci.yml` — PHP（crow）

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  php:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: shivammathur/setup-php@v2
        with:
          php-version: "8.3"
          coverage: none

      - name: Install deps
        run: composer install --prefer-dist --no-progress

      - name: Coding standards
        run: composer run lint:code   # phpcs（coding.md）

      - name: Test
        run: vendor/bin/phpunit       # testing.md

      # enforce-layer-boundaries 導入時のみ
      - name: Architecture check
        run: composer run arch:check   # deptrac
```

### 3B. `.github/workflows/ci.yml` — JS/TS

パッケージマネージャーを検出（`package-lock.json`=npm / `pnpm-lock.yaml`=pnpm / `yarn.lock`=yarn / `bun.lockb`=bun。不明なら npm）。以下は npm の例。

```yaml
  js:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Coding standards
        run: npm run lint:code   # eslint（coding.md）

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm test

      # enforce-layer-boundaries 導入時のみ
      - name: Architecture check
        run: npm run arch:check   # dependency-cruiser
```

**パッケージマネージャー別の差し替え**:

- pnpm → `pnpm/action-setup` を追加し、`cache: pnpm` / `pnpm install --frozen-lockfile` / `pnpm run ...`
- yarn → `cache: yarn` / `yarn install --frozen-lockfile` / `yarn ...`
- bun → `oven-sh/setup-bun` / `bun install --frozen-lockfile` / `bun run ...`

存在しないコマンドに対応するステップは削除する。

### 4. ブランチ保護を案内する

CI をゲートとして機能させるには、GitHub 側で **必須ステータスチェック**に指定する必要がある。これはリポジトリ設定（Settings → Branches → Branch protection rules、または Rulesets）で行うもので、コードでは完結しない。次を実行すると自動化できる旨を案内する（`gh` CLI が使える場合）。

```bash
gh api -X PUT repos/{owner}/{repo}/branches/main/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=php' \
  -F 'required_status_checks.contexts[]=js' \
  ...
```

> `contexts[]` には**実際に必須化したいジョブ名**を列挙する（上記ワークフローなら `php` / `js`。片方だけの
> プロジェクトはそのジョブ名のみ）。

設定を変更する操作なので、実行はユーザーの承認を得てから行う。強制せず、まず必要性だけ伝える。**なお、
プライベートリポジトリのブランチ保護は有料プラン、Ruleset/保護の設定には admin 権限が要る。使えない
アカウントでは L1（ローカルフック）＋L2（CI 実行）までで留め、「保護は未設定」と明示する。**

### 5. 検証する

- [ ] `.github/workflows/ci.yml` が存在し、含めたステップが実在の npm スクリプトに対応している
- [ ] ローカルで各コマンド（`npm run lint` など）が通ることを確認する
- [ ] コミット & push 後、Actions タブでワークフローが緑になることを確認する

### 6. コミットする

変更・作成した全ファイルをステージしてコミットする: `ci: add PR checks (lint, typecheck, test)`

## 補足

- CI は **回避不可のゲート**。ローカルフック（`setup-pre-commit`）とは補完関係で、両方あるのが理想（ローカル＝速い一次防衛、CI＝確実な最終防衛）。
- 依存インストールは `npm ci` 等の **lockfile 厳守**を使う（再現性のため）。
- モノレポや複数 Node バージョンを回したい場合は `strategy.matrix` を提案する。
- GitHub 以外（GitLab CI / CircleCI 等）を使っている場合は、同じステップ構成を各サービスの記法に読み替える旨を伝える。
