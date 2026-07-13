---
paths:
  - ".github/workflows/**"
---

# 📦 enforcement — L2 CI ＋ L3 ブランチ保護

> ローカルフック（[hooks.md](./hooks.md)）は `--no-verify` で回避でき環境にも依存する。CI は**回避不能・全員に必ず効く最終ゲート**。
> スタック（PHP/crow か JS/TS か）を検出してジョブを分ける。config 生成は [setup-idempotency.md](../setup-idempotency.md) に従い、既存 `.github/workflows/*.yml` を clobber しない。

## L2 — GitHub Actions

`.github/workflows/ci.yml`。PR（`pull_request`）と主要ブランチへの push で発火。**存在するコマンドだけ**含める。

### PHP（crow）ジョブ

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
      - run: composer install --prefer-dist --no-progress
      - name: Coding standards
        run: composer run lint:code    # PHPCS（coding.md）
      - name: Test
        run: vendor/bin/phpunit        # testing.md
      - name: Architecture check       # layer-boundaries 導入時のみ
        run: composer run arch:check   # deptrac
```

### JS/TS ジョブ

パッケージマネージャーを検出（`package-lock.json`=npm / `pnpm-lock.yaml`=pnpm / `yarn.lock`=yarn / `bun.lockb`=bun。不明なら npm）。npm 例:

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
        run: npm run lint:code    # ESLint（coding.md）
      - name: Type check
        run: npm run typecheck
      - name: Test
        run: npm test
      - name: Architecture check
        run: npm run arch:check   # dependency-cruiser
```

- pnpm → `pnpm/action-setup` ＋ `cache: pnpm` / `pnpm install --frozen-lockfile`
- yarn → `cache: yarn` / `yarn install --frozen-lockfile`
- bun → `oven-sh/setup-bun` / `bun install --frozen-lockfile`

秘密情報スキャン（gitleaks）はここにジョブを足すか専用 workflow にする（[secrets.md](./secrets.md)）。

### spec-lint ジョブ（docs SSOT 検証・任意）

[spec-lint](./spec-lint.md) は Node ツールなので、PHP 案件でも **Node をセットアップした専用ジョブ**で回す。

```yaml
  spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true          # submodule 配置なら .claude-harness を取得
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Validate docs SSOT
        run: node .claude/tools/spec-lint/spec-lint.mjs validate
```

### 再利用可能ワークフロー（gate の L2 裏取り・ロジックを harness に集約）

commit-msg の `gate`（[hooks.md](./hooks.md)）は `--no-verify` で回避できるため、回避不能な L2 でも
裏取りする。ワークフローの**ロジックは harness 側に集約**し（本 harness は PUBLIC なので別オーナーの
private リポジトリからも呼べる）、各プロジェクトは薄いスタブから `uses:` で参照する。更新はタグ更新で伝播する。

- harness 同梱: [`.github/workflows/spec-gate.yml`](../../../../../.github/workflows/spec-gate.yml)
  （`workflow_call`。`validate` ＋ PR 各コミットの `gate` を走らせる）
- プロジェクト側スタブ（`.github/workflows/spec-gate.yml`）:

```yaml
name: spec-gate
on:
  pull_request:
  push:
    branches: [main]
jobs:
  spec-gate:
    uses: GoboMan/claude-harness/.github/workflows/spec-gate.yml@vX.Y.Z   # 使う tag に合わせる
```

> 検査ツールは呼び出し側の `.claude`（＝ harness の submodule）同梱の spec-lint を使う（バージョンは
> submodule の pin で決まる）。組織ポリシーで「select actions のみ許可」の場合、外部再利用ワークフローの
> 許可設定が要ることがある（塞がれるなら job を自リポジトリにインライン展開する）。

## L3 — ブランチ保護 / Ruleset

CI をゲート化するには、GitHub 側で **必須ステータスチェック**に指定する必要がある（コードでは完結しない）。`gh` CLI があれば自動化できる。

```bash
gh api -X PUT repos/{owner}/{repo}/branches/main/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=php' \
  -F 'required_status_checks.contexts[]=js' \
  ...
```

- `contexts[]` には**必須化したいジョブ名**を列挙（上記なら `php` / `js`。片方だけなら片方）。
- 設定変更なので、実行は**ユーザーの承認を得てから**。

### 能力劣化（アカウントで L3 が張れないとき）

- プライベートリポジトリのブランチ保護は**有料プラン**、Ruleset/保護の設定には **admin 権限**が要る。
- 使えないときは **L1（フック）＋L2（CI 実行）まで**に留め、「**保護は未設定**（直 push を機械的に封じられない）」と明示的に残す。黙って「守られている」風にしない。

## ✅ チェックリスト

- [ ] スタックに合うジョブ（PHP は PHPUnit、JS は test）になっている
- [ ] `.github/workflows/*.yml` を既存分と衝突させず生成した
- [ ] 依存インストールは lockfile 厳守（`composer install` / `npm ci`）
- [ ] L3 を張れたか。張れないなら「保護未設定」を記録したか
