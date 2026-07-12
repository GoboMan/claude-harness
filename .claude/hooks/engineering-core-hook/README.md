# engineering-core-hook

`UserPromptSubmit` フック。**プロンプトに engineering の実装意図を検出したら、開発プロセスの
「核」([process.md](../../rules/engineering/practices/process.md)) を SSOT からそのまま注入する。**

遅延ロード設計（CLAUDE.md ルーター → カタログ → 葉）は「AI が規律で core を読む」ことに依存しており、
機械的な担保が無かった。本フックはその穴を埋める最小の belt-and-suspenders。

## 何をするか

1. `UserPromptSubmit` で発火し、stdin の JSON から `prompt` を読む。
2. 実装意図のキーワード（`hook.mjs` の `INTENT`）にマッチするか判定する。
3. マッチし、**そのセッションで未注入**なら、process.md の中身を stdout に出す
   （Claude Code がそれを追加コンテキストとして注入する）。
4. それ以外は無出力。

- **SSOT を壊さない**: core をハードコピーせず `process.md` を実ファイルから読む。process.md を直せば追従する。
- **セッション1回**: `os.tmpdir()` に `claude-eng-core-<session_id>` マーカーを置き、毎ターンの巨大注入を防ぐ。
- **fail-open**: 何が失敗しても `exit 0`・無出力。ユーザーのプロンプト処理を絶対に止めない。

## 有効化

`.claude/settings.json` の `hooks.UserPromptSubmit` に登録済み（copy/symlink 配布で伝播）。
個別プロジェクトで無効化したいときは、そのプロジェクトの `.claude/settings.local.json` で上書きする。

## 限界（正直に）

検出は**ヒューリスティック**。キーワード方式なので、

- 実装意図なのにキーワードを含まない指示は**取りこぼす**（false negative）。
- 「コード」「テスト」等を含む非実装の会話（構造談義・ブログ執筆）で**誤発火**しうる（false positive）。
  誤発火の実害は「core を1回多く読む」だけなので許容し、取りこぼしを減らす側に寄せている。

「全部を機械判定できる」ふりはしない。core の§1.5 ゲートは、最終的に人間と AI が着手前に自分で通すもの。
本フックはその発火を**忘れさせない**ための補助であって、規律の代替ではない。

## 手動テスト

```bash
echo '{"prompt":"crow で予約フォームを実装して","session_id":"t1"}' \
  | node .claude/hooks/engineering-core-hook/hook.mjs        # → core が出る
echo '{"prompt":"crow で予約フォームを実装して","session_id":"t1"}' \
  | node .claude/hooks/engineering-core-hook/hook.mjs        # → 2回目は無出力(dedup)
echo '{"prompt":"週末の天気は？","session_id":"t2"}' \
  | node .claude/hooks/engineering-core-hook/hook.mjs        # → 無出力(非engineering)
```
