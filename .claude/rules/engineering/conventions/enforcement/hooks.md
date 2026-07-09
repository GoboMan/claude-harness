# 📦 enforcement — L1 ローカルフック（commit-msg / pre-commit）

> コミット前・コミット時に手元で走らせる**一次防衛**。`--no-verify` で回避できるので、回避不能の裏取りは [ci.md](./ci.md)（L2）で行う。
> フック追記は必ず [setup-idempotency.md](../setup-idempotency.md) に従う（**既存を検査してから足す＝dedup**、clobber しない）。

## フック方式の選択

- **Husky**（`package.json` があり Node を使う）→ `.husky/` にフックを置く。`.husky` 未導入なら `npx husky init`。
- **`core.hooksPath`**（純 PHP / Node を入れたくない）→ リポジトリに `.githooks/` を置き、`git config core.hooksPath .githooks`。clone した他者にも配れる（各自 `git config core.hooksPath .githooks` が要る旨を README に添える）。

> `core.hooksPath` を設定すると `.git/hooks` は無効になる。既に別値が設定されていないか確認してから設定する。

## commit-msg（commit 規約の強制）— SSOT [git.md](../git.md)

### Node あり: commitlint

依存（devDependency）: `@commitlint/cli` `@commitlint/config-conventional`。
`.husky/commit-msg` に `npx --no-install commitlint --edit "$1"`。
`commitlint.config.js` は **git.md の type 一覧に固定**（config-conventional 既定は `revert` を含むため上書き）:

```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always",
      ["feat", "fix", "docs", "refactor", "test", "perf", "style", "build", "ci", "chore"]],
    "subject-full-stop": [2, "never", "."],
  },
};
```

### Node なし: shell フォールバック

`.githooks/commit-msg`（`chmod +x`）。type 形式の一次チェック（regex は git.md の type 一覧に一致）:

```bash
#!/usr/bin/env bash
set -euo pipefail
pattern='^(feat|fix|docs|refactor|test|perf|style|build|ci|chore)(\([^)]+\))?: .+'
if ! grep -qE "$pattern" "$1"; then
    echo "commit-msg: git.md の Conventional Commits 形式に従ってください" >&2
    echo "  例) feat(crow): 予約フォームの入力検証を追加" >&2
    exit 1
fi
```

### `.gitmessage`（書き手向け雛形・任意）

`git config commit.template .gitmessage`（.git/config ローカル。clone 先には自動適用されない旨を README に添える）。type 行・footer（`Refs:` / `ADR-XXXX` / `BREAKING CHANGE:` / `Co-Authored-By:`）は git.md に合わせる。

## pre-commit（規約チェック＋テスト）

フックから **`lint:code`（[coding-standards.md](./coding-standards.md)）** と **テスト**、任意で **`arch:check`（[layer-boundaries.md](./layer-boundaries.md)）**・**gitleaks（[secrets.md](./secrets.md)）** を走らせる。**追記は dedup する。**

`.githooks/pre-commit`（PHP 例。Husky なら `.husky/pre-commit` に同内容）:

```bash
#!/usr/bin/env bash
set -euo pipefail
composer run lint:code     # phpcs（coding.md）
vendor/bin/phpunit         # testing.md
```

JS なら `npm run lint:code`（eslint）＋ `npm test`（＋ `npm run typecheck`）。存在しないコマンドの行は入れない。

### dedup 追記の定石（複数チェックを同じフックに足すとき）

```bash
line='gitleaks protect --staged --redact --verbose'
grep -qF "$line" .githooks/pre-commit || printf '%s\n' "$line" >> .githooks/pre-commit
```

## ✅ チェックリスト

- [ ] フック方式（Husky / core.hooksPath）を1つ選び、既存設定を壊していない
- [ ] commit-msg が git.md の type 一覧を強制している（commitlint or shell）
- [ ] pre-commit が `lint:code` とテストを呼んでいる
- [ ] 追記はすべて dedup ガード付き（2回流しても重複しない）
- [ ] `--no-verify` で回避可能なため、[ci.md](./ci.md) で裏取りしている
