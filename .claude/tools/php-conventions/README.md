# php-conventions

coding.md のうち **PHPCS 標準 sniff で表現できない** 項目を、正規表現ヒューリスティックで
検査する harness 同梱の依存ゼロ Node ツール。PHPCS の補完。

- **検査する**: NOT 演算子 `!` の禁止（`!=` / `!==` は除外）／メソッド引数の末尾 `_`
- **検査しない（review 行き）**: `i_` 接頭辞／bool・null の `===` 徹底（文脈依存で誤検知が多い）
- **検査対象の規約**: `../../rules/develop/web/crow/coding.md`（crow のコーディング規約）

```bash
node php-conventions.mjs check [--src src] [path ...]
```

文字列・コメントは除去してから走査するが完全ではない。ヒューリスティックなのでオプトイン。
終了コード: `0`=OK / `1`=違反 / `2`=使い方エラー。Node のみ（外部依存なし）。
