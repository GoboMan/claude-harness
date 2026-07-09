# 📖 enforcement — カタログ（機械チェックの SSOT）

> rules が定めた規約を、**機械的に強制する**ための取り決めをまとめる。
> ここは「何を・どの層で・どのツールで強制するか」の SSOT。**実行（config 生成・フック導入）は本カタログの葉に沿った通常タスク**として行い、skill には切り出さない。
> あなた（AI）は、タスクに関係する葉だけを開くこと。

## なぜ rules に置くか（skill にしない）

セットアップは副作用が目的で純関数化できない。一方このリポジトリの rules は**カタログ routing で葉単位に遅延ロード**されるため、「必要なときだけ読む」性質は rules でも満たせる。よって durable な知識（何を・どう強制するか）は rules に置き、実行はそれに沿うタスクとする。skill は「実行アセット同梱」か「多段・エージェント的手続き」のときだけ（例外: [git-guardrails](../../../../skills/engineering/git-guardrails-claude-code/SKILL.md) はスクリプト同梱のため skill）。

## 3層モデル（防御の深さ）

```
L1 ローカル hook        : 常に可能・ただし --no-verify で回避可   … 速いフィードバック
L2 CI (GitHub Actions)  : サーバ側・Actions が要る              … 回避不能なチェック実行
L3 ブランチ保護/Ruleset : admin＋(private は)有料プランが要る    … L2 を必須化＋直 push 封じ
```

**能力に応じて最大の層まで張り、届かない差分は明示する。** L3 が使えないアカウントでも L1+L2 まで効かせ、「保護は未設定」と残す（[ci.md](./ci.md) の能力劣化）。

## チェック → 層 → ツール（対応表）

| チェック | SSOT | ツール（PHP / JS） | 主な層 | 葉 |
| --- | --- | --- | --- | --- |
| commit メッセージ規約 | [git.md](../git.md) | commitlint / shell fallback | L1・L2 | [hooks.md](./hooks.md) |
| コーディング規約 | [coding.md](../../web/crow/coding.md) | PHPCS / ESLint | L1・L2 | [coding-standards.md](./coding-standards.md) |
| テスト | [testing.md](../../web/crow/testing.md) | PHPUnit / test runner | L1・L2 | [ci.md](./ci.md) |
| 秘密情報 | — | gitleaks（言語非依存） | L1・L2 | [secrets.md](./secrets.md) |
| 層依存 | — | deptrac / dependency-cruiser | L1・L2 | [layer-boundaries.md](./layer-boundaries.md) |
| 仕様フォーマット/ライフサイクル | [docs/](../docs/index.md) | spec-lint（予定・harness tool） | L1・L2 | （準備中） |

## 葉

- **[hooks.md](./hooks.md)** — L1 ローカルフック（commit-msg / pre-commit）の配線。Husky と Node 非依存 `core.hooksPath`。
- **[ci.md](./ci.md)** — L2 CI（PHP/JS ジョブ）と L3 ブランチ保護・能力劣化。
- **[coding-standards.md](./coding-standards.md)** — coding.md を PHPCS/ESLint で機械化（config）。
- **[layer-boundaries.md](./layer-boundaries.md)** — 層依存を deptrac/dependency-cruiser で機械化（config）。
- **[secrets.md](./secrets.md)** — gitleaks による秘密情報スキャン。

## 全葉共通の前提

- **冪等性**: config 生成・フック追記は必ず [setup-idempotency.md](../setup-idempotency.md) に従う（clobber せず、dedup 追記、プロジェクト内スコープ）。
- **機械チェック緑は前提であって完成条件ではない**（[process.md](../../practices/process.md) コア制約4）。最後は攻撃で壊しにいく。
