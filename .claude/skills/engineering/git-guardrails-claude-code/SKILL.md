---
name: git-guardrails-claude-code
description: 危険な git コマンド（push、reset --hard、clean、branch -D など）が実行される前にブロックする Claude Code フックをセットアップする。ユーザーが破壊的な git 操作を防ぎたい、git の安全フックを追加したい、あるいは Claude Code で git push/reset をブロックしたい場合に使用する。
---

# Setup Git Guardrails

Claude が実行する前に危険な git コマンドをインターセプトしてブロックする PreToolUse フックをセットアップする。

## ブロックされる対象

- `git push`（`--force` を含むすべてのバリアント）
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .` / `git restore .`

ブロックされると、Claude にはこれらのコマンドへアクセスする権限がない旨のメッセージが表示される。

## 手順

### 1. スコープを尋ねる

ユーザーに尋ねる: **このプロジェクトのみ**（`.claude/settings.json`）にインストールするか、**すべてのプロジェクト**（`~/.claude/settings.json`）にインストールするか。

### 2. フックスクリプトをコピーする

同梱されているスクリプトは次の場所にある: [scripts/block-dangerous-git.sh](scripts/block-dangerous-git.sh)

スコープに応じて、対象の場所へコピーする。

- **プロジェクト**: `.claude/hooks/block-dangerous-git.sh`
- **グローバル**: `~/.claude/hooks/block-dangerous-git.sh`

`chmod +x` で実行可能にする。

### 3. settings にフックを追加する

該当する settings ファイルに追加する。

**プロジェクト**（`.claude/settings.json`）:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

**グローバル**（`~/.claude/settings.json`）:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

settings ファイルが既に存在する場合は、既存の `hooks.PreToolUse` 配列にフックをマージする。他の設定を上書きしないこと。

### 4. カスタマイズについて尋ねる

ブロック対象リストにパターンを追加・削除したいかをユーザーに尋ねる。それに応じてコピーしたスクリプトを編集する。

### 5. 検証する

簡単なテストを実行する。

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | <path-to-script>
```

終了コード 2 で終了し、stderr に BLOCKED メッセージが出力されるはずである。

## 補足：git.md フローとの関係

このフックは `git push` を**全面ブロック**する（Claude が勝手に push しない安全網）。
[git.md](../../../rules/engineering/conventions/git.md) は「PR は 1 スライス単位」で push / PR を回す運用なので、
push 自体は**人間が明示的に行う**前提と噛み合う。逆に「Claude に push まで任せたい」運用では邪魔になるため、
スコープ（プロジェクト / グローバル）とブロック対象は導入時にユーザーへ確認する。CI の必須チェックや
ブランチ保護（[enforcement/ci.md](../../../rules/engineering/conventions/enforcement/ci.md)）とは目的が別
（あちらはサーバ側ゲート、これは手元の事故防止）。

> このフックの設定は `~/.claude` に書けるため、[setup-idempotency.md](../../../rules/engineering/conventions/setup-idempotency.md)
> に従う: 既定はプロジェクトスコープ、`hooks.PreToolUse` 配列は**同一エントリを重複追加しない**（既存を確認してからマージ）。
