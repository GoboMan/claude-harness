---
name: bootstrap-project
description: プロジェクトを claude-harness の rules に準拠した「実装に移れる状態」までセットアップする。新規（コード・docs 無し）でも既存（コードとプロジェクト固有 docs あり）でも使う。docs/ レイアウトを整え、機能一覧/機能詳細/契約を rules の厳格フォーマットへ整形（既存はコードから逆生成を retrofit-to-rules に委譲）、enforcement（フック・CI・config・spec-lint/phpcs/eslint）を冪等に配線し、enforcement-report で準拠状況を計測する。「rules 準拠でセットアップしたい」「実装を始められる状態にしたい」「初期化したい」ときに起動する。
---

# 🧰 bootstrap-project — rules 準拠の初期セットアップ

> `.claude/` を導入した直後の**起動導線**。プロジェクトを rules に準拠させ、**実装に移れる状態**まで持っていく。
> 新規（greenfield）でも既存コード＋固有 docs（brownfield）でも同じ入口で扱う。
> rules の核は [process.md](../../../rules/engineering/practices/process.md)、docs 配置は [layout.md](../../../rules/engineering/conventions/docs/layout.md)、
> 機械強制は [enforcement/index.md](../../../rules/engineering/conventions/enforcement/index.md)。

## ⛔ 最重要の前提（誇張しない・コア制約と衝突させない）

- **コードもドキュメントも「真実の源」ではない。** 既存コード／既存 docs から起こした spec / contract / GWT は、
  すべて **「暫定・要人間確認（draft）」** として扱う。`fixed` に昇格する権限は人間にある。
- **「セットアップ完了」＝「構造準拠＋機械計測可能＋移行路が用意された」状態**であって、既存資産が即
  `all-green・fixed・正しい` になるわけではない。**ここを正直に線引きする**（下表）。
- **作る主体と判定する主体を分ける。** 逆生成（ビルダー）と不整合検出（オラクル）は別コンテキストで回す
  （コード由来の逆生成は [retrofit-to-rules](../retrofit-to-rules/SKILL.md) に委譲）。
- **冪等に。** すべての生成・追記は [setup-idempotency.md](../../../rules/engineering/conventions/setup-idempotency.md) に従い、
  既存を clobber せず dedup 追記し、プロジェクト内スコープに閉じる。

### bootstrap が「自動で行う」／「人間の判断が要る」

| 項目 | bootstrap が自動で行う | 人間の判断が要る |
| --- | --- | --- |
| docs レイアウト | layout.md の構造を作成、既存固有 docs を各形式へ整形 | — |
| SSOT の内容 | 逆生成／整形（**draft・暫定**で出力） | **draft→fixed 昇格**（正しさの確定） |
| enforcement 配線 | フック・CI・config を冪等に設置し tools を配線 | 有効化スコープの選択 |
| 既存コードの規約違反 | 検出・レポート・段階移行の提示 | 実際の修正（warn→fix の移行） |
| テスト | バックフィル（retrofit 経由） | 最後の攻撃（レッドチーム）で確認 |

> つまり **「既存コード＋固有 docs → 構造は完全に rules 準拠・機械チェックは全部配線済み・準拠状況は数値で可視化」**
> までは bootstrap で完了する。残るのは「暫定 SSOT を人が確認して fixed にする」「既存違反を潰す」——
> これは rules が人間に委ねている部分で、自動化してはいけない領域。

## 判定：greenfield か brownfield か

まず現状を把握する。

```bash
bash .claude/tools/enforcement-report/enforcement-report.sh
```

- **greenfield**: 実装コードがほぼ無い／`docs/` が無い → テンプレから雛形を作る。
- **brownfield**: 実装コードがある、または固有 docs がある → 整形＋逆生成＋配線する。

## 手順

### 0. 現状把握

`enforcement-report` で「張れる層（L1/L2/L3）・各チェックの設定有無・ギャップ」を確認。スタック（`composer.json`/`*.php`=PHP、`package.json`=JS）も見て以降の分岐に使う。

### 1. docs レイアウトを整える

[layout.md](../../../rules/engineering/conventions/docs/layout.md) の骨格を用意する（無ければ作る・既存は温存）。

```
docs/spec/features.md   docs/spec/<feature>.md   docs/contracts/<feature>.md   docs/adr/
```

**既存のプロジェクト固有 docs は消さない。** SSOT 対象（仕様・契約・ADR）は rules の場所・形式へ整形し、
それ以外の運用 docs はそのまま残す（layout.md は最小骨格のみ固定、固有 docs の追加は自由）。

### 2. SSOT を整える（すべて draft・暫定で）

- **greenfield**: [feature-list.md](../../../rules/engineering/conventions/docs/feature-list.md) /
  [feature-spec.md](../../../rules/engineering/conventions/docs/feature-spec.md) /
  [contract.md](../../../rules/engineering/conventions/docs/contract.md) のテンプレから雛形を置く（`draft`）。
- **brownfield**:
  1. **既存固有 docs の整形**: 内容を保持したまま feature-list / feature-spec / contract の**厳格フォーマットへ写す**。
     情報が欠けるセクションは `draft` のまま空欄を残し、埋めるのは人間に委ねる（勝手に確定させない）。
  2. **コードからの逆生成**: SSOT が不足する分は [retrofit-to-rules](../retrofit-to-rules/SKILL.md) を起動し、
     コードから spec / contract / GWT を**別コンテキストのビルダー＋オラクル**で逆生成（暫定・要確認）。
- **共通**: どの機能詳細・契約も **`draft` のまま**にする。`spec-lint validate` が通る形（フォーマット・状態機械）
  を満たすが、`fixed` 昇格は人間の確認後。

```bash
node .claude/tools/spec-lint/spec-lint.mjs validate
```

### 3. enforcement を配線する（冪等）

[enforcement/index.md](../../../rules/engineering/conventions/enforcement/index.md) の葉に沿って、検出したスタックに合わせて設置する。

- **フック**（[hooks.md](../../../rules/engineering/conventions/enforcement/hooks.md)）: commit-msg（commit 規約＋任意で spec-lint `gate`）、pre-commit（`lint:code`＋テスト＋任意で spec-lint `validate`）。Husky か `core.hooksPath`。
- **コーディング規約**（[coding-standards.md](../../../rules/engineering/conventions/enforcement/coding-standards.md)）: PHP=PHPCS＋[php-conventions](../../../tools/php-conventions/php-conventions.mjs)、JS=ESLint。
- **層依存 / 秘密情報 / CI**（[layer-boundaries.md](../../../rules/engineering/conventions/enforcement/layer-boundaries.md) / [secrets.md](../../../rules/engineering/conventions/enforcement/secrets.md) / [ci.md](../../../rules/engineering/conventions/enforcement/ci.md)）: 必要に応じ deptrac/dep-cruiser・gitleaks・GitHub Actions。
- **L3 ブランチ保護**は能力次第（admin＋プラン）。張れなければ「未設定」と残す。

すべて **dedup／clobber 回避**（[setup-idempotency.md](../../../rules/engineering/conventions/setup-idempotency.md)）。

### 4. 準拠状況を計測する

配線した機械チェックを一度流し、違反を可視化する。**既存違反が大量なら「今直す／一旦 warn に下げて段階移行」を必ずユーザーに確認**（黙って除外・黙って全書き換えのどちらもしない）。

```bash
node .claude/tools/spec-lint/spec-lint.mjs validate
composer run lint:code   # or: npm run lint:code
node .claude/tools/php-conventions/php-conventions.mjs check --src src   # PHP
bash .claude/tools/enforcement-report/enforcement-report.sh --out docs/enforcement.md
```

### 5. 引き渡し（何が済み・何が残るか）

`docs/enforcement.md` と spec-lint の結果をもとに、**残作業を明示**して終える。

- ✅ 済: docs レイアウト・厳格フォーマット化・enforcement 配線・準拠レポート
- ⏳ 人間: 暫定 SSOT の確認と **`draft→fixed` 昇格**、既存コード違反の解消
- ▶ 実装（Phase 4）へ進めるのは、**対象機能の spec と契約が `fixed`** になってから（[process.md](../../../rules/engineering/practices/process.md) コア制約1・6）。

## ✅ 着手前チェックリスト

- [ ] enforcement-report で greenfield/brownfield と能力（L1/L2/L3）を把握したか
- [ ] docs レイアウトを用意し、既存固有 docs を消さず整形したか
- [ ] SSOT を厳格フォーマットで用意したか（逆生成は retrofit-to-rules に委譲・すべて draft）
- [ ] enforcement を冪等に配線し、既存を clobber していないか
- [ ] 機械チェックを流し、既存違反の扱い（今直す/段階移行）をユーザーに確認したか
- [ ] 「暫定 SSOT の fixed 昇格」と「実装は fixed 後」を引き渡しで明示したか
