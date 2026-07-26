# gate-hook — §1.5 実装着手ゲートの機械強制（任意有効化）

develop skill の **§1.5 実装着手ゲート**（spec と契約が `fixed` になる前に実装コードを書かない）を、
Claude Code の **PreToolUse フック**として構造的に強制するツール。

- **無くても develop プロセスは成立する**（§1.5 は自己確認、spec-lint gate は commit 時の事後チェック）。
  本フックはその二重の網に「**書き込みの瞬間に物理的に止まる停止線**」を追加する第三の網である。
- **有効化は取り込み先プロジェクトの任意**。harness はスクリプトと本手順だけを同梱する
  （設置＝settings への配線は各プロジェクトの責務。README「同梱する機械チェック」の項参照）。

## 仕組み

1. Write / Edit / NotebookEdit の直前にフックが発火し、対象パスを受け取る。
2. 対象が「実装コード」（`--code` glob にマッチ）なら、`docs/spec/features.md` の台帳を読む。
3. **工程=実装（または 攻撃）の全機能**について、spec と契約が `fixed` かを検証する。
4. 欠けていれば **exit 2 でツール実行をブロック**し、理由（どの機能の何が未充足か・戻り先 Phase）を
   stderr で AI に差し戻す。AI の意思と無関係に止まる。

台帳（features.md の工程列）を機械可読なゲート状態として使うため、**追加の状態ファイルは無い**。
orchestrator が SKILL の手順どおり台帳を更新していれば、そのままフックの判定材料になる。

### 判定規則

| 書き込み対象 | 判定 |
| --- | --- |
| `docs/` 配下（spec・契約・台帳） | 常に許可（SSOT を書く行為はゲートの前提） |
| `.claude/` 配下・`--exclude` マッチ・`--code` 非マッチ | 許可（ゲート対象外） |
| 実装コード ＋ features.md が無い | **ブロック**（SSOT が無い → Phase 1） |
| 実装コード ＋ 工程=実装\|攻撃 の行が台帳に無い | **ブロック**（台帳を更新してから着手） |
| 実装コード ＋ 実装中機能の spec / 契約が `fixed` でない・無い | **ブロック**（Phase 1 / Phase 3 へ） |
| 上記すべて充足 | 許可 |

フック自身の内部エラー（stdin 不正など）は **fail-open**（許可）— フックの不具合でセッションを壊さない。
逆にゲート判定そのものは **fail-closed** — 台帳・SSOT が無ければ止まる。

## 設置（取り込み先プロジェクトで）

`.claude/settings.local.json`（個人・非コミット。submodule 配置でも取り込み先に閉じる）に追記する:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/tools/gate-hook/gate-hook.mjs\" --code 'src/**' --code 'app/**'"
          }
        ]
      }
    ]
  }
}
```

チームで共有したい場合は、`.claude` を copy / symlink 配置しているなら `.claude/settings.json` に
同じ内容を書いてよい（submodule 配置では settings.json が harness 側のファイルになるため不可。
その場合は各自の settings.local.json に置く）。

### 引数（設定はすべてここ。設定ファイルは増やさない）

| 引数 | 意味 |
| --- | --- |
| `--code <glob>` | ゲート対象＝実装コードとみなすパス（複数可・**必須**）。例: `'src/**'` `'app/**'` `'db/schema.*'` |
| `--exclude <glob>` | `--code` の中から除外するパス（複数可）。例: skeleton の作業場 `'skeleton/**'` |
| `--docs <dir>` | docs ルート（既定 `docs`） |

- `--code` を渡さずに有効化すると、ブロックせず警告だけ出す（exit 1・設置ミスの検出用）。
- glob は `**` / `*` / `?` のみの最小実装（プロジェクトルートからの相対パスにマッチ）。

## 制約（知ったうえで使う）

- **Bash 経由の書き込み（`sed -i`・リダイレクト等）は素通りする。** matcher が Write/Edit 系のみのため。
  Bash まで塞ぐ設計は誤爆（ビルド・テスト実行の妨害）が大きく、意図的に対象外。
- **メインエージェントとサブエージェントを区別しない。** 実装 producer の正当な Write も同じ判定を
  通るが、正当な実装は台帳・spec・契約が揃っている状態でしか起きないため、追加の網として無害
  （むしろ producer の逸脱も止める）。
- **ウォーキングスケルトン**（§3。契約 fixed 前に振る舞いを書く明示的例外）は、本線のコードツリー外
  （例: `skeleton/`）で作業させ `--exclude` で除外するか、ゲート対象 glob の外に置くこと。
- 台帳の工程列・spec/契約のステータスが実態と drift していれば判定も drift する。整合は spec-lint
  （`../spec-lint/`）が commit 時に裏取りする。

## 動作確認

```bash
echo '{"tool_input":{"file_path":"src/x.js"},"cwd":"/path/to/project"}' \
  | node .claude/tools/gate-hook/gate-hook.mjs --code 'src/**'
echo $?   # 台帳・spec・契約が揃っていなければ 2（ブロック理由が stderr に出る）
```
