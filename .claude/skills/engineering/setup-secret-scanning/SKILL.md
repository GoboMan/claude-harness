---
name: setup-secret-scanning
description: APIキー・認証情報・トークンなどのシークレットがコミット / PR に混入するのを検知して弾く gitleaks を pre-commit フックと CI にセットアップする。ユーザーがシークレットの漏洩を防ぎたい、認証情報のコミットを止めたい、gitleaks / trufflehog を設定したい、あるいは「秘密情報の混入を機械的にブロックしたい」場合に使用する。
---

# Setup Secret Scanning

シークレット（APIキー、トークン、パスワード、秘密鍵など）がリポジトリに混入するのを **機械的に検知して弾く**。`gitleaks` を使い、ローカル pre-commit と CI の両層に仕込む。

コード品質ゲート（`setup-pre-commit` / `setup-ci-checks`）と並ぶ、セキュリティ面の最低限ゲート。

## このスキルがセットアップするもの

- **gitleaks** による pre-commit スキャン（ステージ済み変更を対象・混入を commit 前に弾く）
- **gitleaks** による CI スキャン（PR / push で回避不可の裏取り）
- 任意で **`.gitleaks.toml`**（誤検知の allowlist）

gitleaks は言語非依存の単一バイナリで、正規表現＋エントロピーで既知の多数のシークレット形式を検出する。

## 手順

### 1. gitleaks の導入方法を確認する

インストール手段を検出・確認する（いずれか）。

- macOS: `brew install gitleaks`
- Docker: `docker run --rm -v "$(pwd):/repo" zricethezav/gitleaks:latest`
- バイナリ直接: GitHub Releases から取得

pre-commit フックはローカルに gitleaks が入っている前提になる。チーム全員に入れてもらう必要がある旨をユーザーに伝える（CI 側は後述の Action が自前で用意するため不要）。

### 2. pre-commit フックに接続する

`setup-pre-commit` 導入済みか、そのフック方式（Husky か `core.hooksPath` か）を確認する。次の行を
**既存フックに追記**する（既存行は消さない）:

```
gitleaks protect --staged --redact --verbose
```

- `protect --staged` はステージ済みの差分だけを走査するので高速
- `--redact` は検出値をログに出さない（二次漏洩防止）

追記先はフック方式で分かれる。

- **Husky（Node）** → `.husky/pre-commit` に追記
- **core.hooksPath（純 PHP / Node 非依存）** → `.githooks/pre-commit` に追記
- **pre-commit 未導入** → 先に `setup-pre-commit` を使うか、gitleaks 単独の最小フック（上記1行だけの
  `.githooks/pre-commit` ＋ `git config core.hooksPath .githooks`）を作るかをユーザーに確認する。

### 3. CI に接続する

`setup-ci-checks` の GitHub Actions ワークフローがあれば、そこにジョブ／ステップを追加する。無ければ専用ワークフロー `.github/workflows/secret-scan.yml` を作る。

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
          fetch-depth: 0 # 履歴全体を走査するために必要
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> `fetch-depth: 0` は履歴全体を対象にするため。PR 差分だけを見たい場合は gitleaks-action の設定で調整できる。

### 4. `.gitleaks.toml` を用意する（必要な場合のみ）

誤検知（テスト用ダミー鍵、サンプル値など）が出る場合にのみ作る。デフォルトルールを継承しつつ allowlist を足す:

```toml
[extend]
useDefault = true

[allowlist]
description = "誤検知の除外"
paths = [
  '''(^|/)test/fixtures/''',
]
regexes = [
  '''EXAMPLE_[A-Z_]+''',
]
```

> allowlist は**本物のシークレットまで見逃す穴**になりうる。追加するものはユーザーに一つずつ確認し、黙って広げないこと。

### 5. 既存の漏洩を確認する

導入時に、履歴に既にシークレットが埋まっていないかを一度スキャンする。

```bash
gitleaks detect --redact --verbose
```

- **検出された場合** → 重大。単にコミットを止めるだけでなく、**該当シークレットのローテーション（無効化・再発行）**が必要である旨を強く伝える。git 履歴からの除去（filter-repo 等）は破壊的操作なので、実施はユーザーの明確な承認を得てから。
- **検出ゼロ** → そのまま導入を進める。

### 6. 検証する

- [ ] pre-commit に gitleaks 行が入っている（`setup-pre-commit` の既存行を壊していない）
- [ ] CI ワークフローに gitleaks ジョブがある
- [ ] ダミーのシークレット（例 `AKIA` で始まる文字列）をステージして commit しようとすると弾かれる
- [ ] `gitleaks detect` が既存履歴に対して通る（または検出分の対応方針をユーザーと合意済み）

### 7. コミットする

変更・作成した全ファイルをステージしてコミットする: `ci: add secret scanning with gitleaks`

## 補足

- gitleaks はパターン／エントロピーベースなので **誤検知も検出漏れもゼロではない**。第一防衛線であって完全ではない旨を伝える。
- **検出されたシークレットは「消せば安全」ではない**。一度コミット／push されたものは漏洩したものとして扱い、必ずローテーションする。
- trufflehog を好む場合も構図は同じ（pre-commit + CI で走らせる）。gitleaks は導入が軽いため既定とする。
- GitHub 標準の **Secret Scanning / Push Protection**（リポジトリ設定）も併用すると強い。コードで完結しない設定なので、必要性のみ案内する。
