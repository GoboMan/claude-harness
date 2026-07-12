---
paths:
  - ".gitleaks.toml"
  - ".husky/**"
  - ".githooks/**"
  - ".github/workflows/**"
---

# 📦 enforcement — 秘密情報スキャン（gitleaks）

> APIキー・トークン・秘密鍵などの混入を**機械的に検知して弾く**。gitleaks（言語非依存の単一バイナリ・正規表現＋エントロピー）を L1（pre-commit）と L2（CI）の両層に仕込む。
> フック追記は [setup-idempotency.md](../setup-idempotency.md) に従い **dedup**（重複行を作らない）。

## L1 — pre-commit

gitleaks はローカルにバイナリが要る（`brew install gitleaks` / Docker / バイナリ直取得）。チーム全員に入れてもらう必要がある旨を伝える。

[hooks.md](./hooks.md) のフック（`.husky/pre-commit` or `.githooks/pre-commit`）に **dedup 追記**:

```bash
line='gitleaks protect --staged --redact --verbose'
grep -qF "$line" .githooks/pre-commit || printf '%s\n' "$line" >> .githooks/pre-commit
```

- `protect --staged`: ステージ済み差分だけ走査（高速）
- `--redact`: 検出値をログに出さない（二次漏洩防止）

## L2 — CI

[ci.md](./ci.md) の workflow にジョブを足すか、専用 `.github/workflows/secret-scan.yml`:

```yaml
name: Secret scan
on:
  pull_request:
  push:
    branches: [main]
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # 履歴全体を走査
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 誤検知の allowlist（必要時のみ）

`.gitleaks.toml`（デフォルトルール継承＋allowlist）。**allowlist は本物の秘密まで見逃す穴**になりうるので、追加は一つずつユーザー確認（黙って広げない）。

```toml
[extend]
useDefault = true
[allowlist]
paths = ['''(^|/)test/fixtures/''']
regexes = ['''EXAMPLE_[A-Z_]+''']
```

## 既存漏洩の確認

導入時に一度 `gitleaks detect --redact --verbose` で履歴を走査する。

- **検出されたら重大**: コミットを止めるだけでなく、**該当シークレットのローテーション（無効化・再発行）が必須**。履歴除去（filter-repo 等）は破壊的なのでユーザーの明確な承認を得てから。
- 一度 push されたものは漏洩とみなす。「消せば安全」ではない。

## ✅ チェックリスト

- [ ] pre-commit に gitleaks 行が dedup 追記されている（既存フック行を壊していない）
- [ ] CI に gitleaks ジョブがある
- [ ] ダミー秘密（`AKIA…`）をステージすると弾かれる
- [ ] `gitleaks detect` で既存履歴を確認済み（検出分は対応方針を合意）
