# 📦 enforcement — 仕様フォーマット / ライフサイクルの機械化（spec-lint）

> docs の SSOT（機能一覧・機能詳細・契約）が**厳格フォーマットに従い、ライフサイクル（draft→fixed）が破られていない**かを機械検証する。
> 検証仕様の SSOT は [feature-list.md](../docs/feature-list.md) / [feature-spec.md](../docs/feature-spec.md) / [contract.md](../docs/contract.md)。
> ツール本体は harness 同梱の Node バリデータ **[`.claude/tools/spec-lint/spec-lint.mjs`](../../../../tools/spec-lint/spec-lint.mjs)**（skill でなくアセット）。

## なぜツール＋rules なのか

`process.md` コア制約1「SSOT が実装に先行する」を機械で裏取りする。バリデータは**実行アセット**なので harness 同梱ツール（submodule でバージョン管理・更新伝播）とし、**何を強制するか**は本葉が定める。前提: 対象プロジェクトに Node が要る。

## 何を検証するか

### `validate`（フォーマット＋不変条件）

- **フロントマター**: `機能ID` / `ステータス(draft|fixed)` / `更新日`（契約は `機能詳細` リンクも）。
- **必須セクション**: feature-spec / contract の必須節がすべて在り、`fixed` なら空でない。
- **テンプレ残り**: `fixed` なのに `F-000` / `YYYY-MM-DD` / `<feature>` が残っていれば違反。
- **状態機械の不変条件**:
  - `features.md` の状態列 == 各 `<feature>.md` の `ステータス`
  - 機能一覧に列挙された機能に対応する spec が実在（詳細リンクも解決）
  - spec が features.md に列挙漏れしていない
  - 機能ID の重複が無い
  - **親 spec が `draft` なのに契約が `fixed`** は違反（先に spec を固める）
- **契約↔機能詳細の相互整合（構造整合オラクル相当・warn）**:
  - 機能詳細の**入力** ↔ 契約の **Request** のフィールド突き合わせ（crow の `i_` 接頭辞は吸収）。
    片方にしか無いフィールドを warn。
  - 機能詳細に error/権限/境界 の異常状態があるのに、契約の **Response（異常）** が空なら warn。
  - ※ 名付けの揺れで誤検知しうるため error でなく warn（人間の確認を促す）。

### `gate`（draft なのに実装、を防ぐ）

commit メッセージの **`Feature: F-xxx` トレーラ**（[git.md](../git.md) の footer 規約）を読み、その機能の
**spec と契約が両方 `fixed`** であることを要求する。トレーラが無ければ素通り（**オプトイン**。使わない
プロジェクトでは未強制になる旨を明示する）。

## 呼び出し

インストール方式（submodule / symlink / copy）に関わらず、対象プロジェクトの `.claude` は常に harness の
`.claude` を指すので、パスは一定:

```bash
node .claude/tools/spec-lint/spec-lint.mjs validate                 # 既定 docs/
node .claude/tools/spec-lint/spec-lint.mjs validate --docs docs
node .claude/tools/spec-lint/spec-lint.mjs gate --message "$1"      # commit-msg フックから
node .claude/tools/spec-lint/spec-lint.mjs gate --feature F-001     # 手動確認
```

script 化（任意・[setup-idempotency.md](../setup-idempotency.md) の dedup に従い既存キーを壊さない）:

- npm: `"lint:spec": "node .claude/tools/spec-lint/spec-lint.mjs validate"`
- composer: `"lint:spec": "node .claude/tools/spec-lint/spec-lint.mjs validate"`

## ゲート接続

- **L1 pre-commit**（[hooks.md](./hooks.md)）: `validate` を走らせる。
- **L1 commit-msg**（[hooks.md](./hooks.md)）: `gate --message "$1"` を走らせる。
- **L2 CI**（[ci.md](./ci.md)）: `validate` を専用ジョブ（setup-node）で走らせる。PHP 案件でも Node が要る点に注意。

## 終了コード

`0`=OK / `1`=違反あり / `2`=使い方エラー。

## ✅ チェックリスト

- [ ] `validate` が docs 全体で通る（`docs/spec` が無ければスキップ）
- [ ] `Feature:` トレーラ運用を入れるなら commit-msg に `gate` を接続したか
- [ ] トレーラ未使用なら「draft 実装ゲートは未強制」と記録したか
- [ ] CI（Node ジョブ）で `validate` を裏取りしているか
