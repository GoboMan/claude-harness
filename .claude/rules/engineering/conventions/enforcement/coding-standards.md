# 📦 enforcement — コーディング規約の機械化（PHPCS / ESLint）

> [coding.md](../../web/crow/coding.md)（SSOT）を機械可読なルールセットに落として強制する。
> 規約値を変えたくなったら**リンタ設定でなく coding.md を正**として直し、ルールセットを追従させる。
> config 生成・`scripts` 追加は [setup-idempotency.md](../setup-idempotency.md) に従う（既存 `lint:code` を clobber しない）。

## 道具の選定（なぜ Prettier / PHP-CS-Fixer でないか）

coding.md は **Allman（`{` を次行）** と **TAB** を要求する。**Prettier は Allman を出せず（K&R 固定）、PHP-CS-Fixer/PSR も K&R 前提**。よって「自動整形で寄せる」ではなく、**Allman・TAB を表現できるリンタで*検査*する**。

- **JS/TS → ESLint**（`brace-style: "allman"`, `indent: "tab"`）
- **PHP → PHP_CodeSniffer(PHPCS)**（`Generic.Functions.OpeningFunctionBraceBsdAllman` 等）

## 機械化できる／できない（正直に線を引く）

| coding.md | ESLint | PHPCS |
| --- | --- | --- |
| TAB インデント | `indent:["error","tab"]` | `Generic.WhiteSpace.DisallowSpaceIndent` |
| Allman（`{` 次行） | `brace-style:["error","allman"]` | `Generic.Functions.OpeningFunctionBraceBsdAllman`（関数）※制御構文は限定的 |
| 80 桁 | `max-len:["error",{code:80}]` | `Generic.Files.LineLength` |
| LF / 終端改行 | `linebreak-style`,`eol-last` | `Generic.Files.LineEndings`,`Files.EndFileNewline` |
| `===`/`!==` | `eqeqeq:["error","always"]` | 標準 sniff に無い → レビュー |
| **`!` 禁止** | `no-restricted-syntax`（下記） | **[php-conventions](#php-補完php-conventions)（tool）** |
| snake_case | `id-match`（限定的） | 標準 sniff に無い → レビュー |
| 引数末尾 `_` | ❌ 既製ルール無し | **[php-conventions](#php-補完php-conventions)（tool）** |
| 入力 `i_` | ❌ 既製ルール無し | ❌ → レビュー |
| PHP 短縮開始タグ禁止 | — | `Generic.PHP.DisallowShortOpenTag` |

> **PHP の `!` と 引数 `_`** は PHPCS 標準 sniff に無いが、harness 同梱の [php-conventions](#php-補完php-conventions) で機械化する。
> 残る **`i_` 接頭辞 / 制御構文 Allman / PHP の `===`** は誤検知が多く**レビュー観点**として残す。**「全部チェックした風」にしない。**

## PHP — `phpcs.xml.dist`

依存（Composer）: `squizlabs/php_codesniffer`。composer script: `"lint:code": "phpcs"`。

```xml
<?xml version="1.0"?>
<ruleset name="crow-coding">
    <file>src</file>
    <arg name="tab-width" value="4"/>
    <arg value="p"/>
    <rule ref="Generic.WhiteSpace.DisallowSpaceIndent"/>
    <rule ref="Generic.WhiteSpace.ScopeIndent">
        <properties><property name="tabIndent" value="true"/></properties>
    </rule>
    <rule ref="Generic.Functions.OpeningFunctionBraceBsdAllman"/>
    <rule ref="Generic.Files.LineLength">
        <properties>
            <property name="lineLimit" value="80"/>
            <property name="absoluteLineLimit" value="120"/>
        </properties>
    </rule>
    <rule ref="Generic.Files.LineEndings">
        <properties><property name="eolChar" value="\n"/></properties>
    </rule>
    <rule ref="Generic.PHP.DisallowShortOpenTag"/>
</ruleset>
```

## JS/TS — `eslint.config.js`（flat config・ESLint v9+）

依存: `eslint`。npm script: `"lint:code": "eslint ."`。

```js
export default [
  {
    files: ["**/*.js", "**/*.ts"],
    rules: {
      indent: ["error", "tab"],
      "brace-style": ["error", "allman", { allowSingleLine: false }],
      "max-len": ["error", { code: 80, ignoreUrls: true, tabWidth: 4 }],
      "linebreak-style": ["error", "unix"],
      "eol-last": ["error", "always"],
      eqeqeq: ["error", "always"],
      "comma-dangle": ["error", "always-multiline"],
      "no-restricted-syntax": [
        "error",
        { selector: "UnaryExpression[operator='!']",
          message: "coding.md: ! 禁止。=== false / !== true で書く" },
      ],
      camelcase: "off",
      "id-match": ["error", "^[a-z_][a-z0-9_]*$",
        { properties: false, onlyDeclarations: true }],
    },
  },
];
```

> `id-match` の snake_case は外部シンボル/型で誤検知しうる。既存コードで大量に出たら「今直す/一旦 warn に下げ段階移行」をユーザーに確認（黙って除外しない）。

## PHP 補完（php-conventions）

PHPCS 標準 sniff で表現できない **`!` 禁止**・**引数末尾 `_`** を、harness 同梱の依存ゼロ Node ツール
[`.claude/tools/php-conventions/php-conventions.mjs`](../../../../tools/php-conventions/php-conventions.mjs) で
機械化する（文字列・コメントを除去してから正規表現走査。`!=`/`!==` は除外）。

```bash
node .claude/tools/php-conventions/php-conventions.mjs check --src src
```

- ヒューリスティックなので**オプトイン**。誤検知が出たら該当を確認（黙って無効化しない）。
- `i_` 接頭辞・`===`（bool/null）はデータフロー/文脈依存で誤検知が多く、**引き続きレビュー観点**。
- composer/npm script 例: `"lint:code:php": "node .claude/tools/php-conventions/php-conventions.mjs check --src src"`
  （既存 `lint:code`〈phpcs〉と並べて実行。[setup-idempotency.md](../setup-idempotency.md) の dedup に従う）。

## ゲート接続

`lint:code`（phpcs/eslint）と、PHP なら php-conventions を [hooks.md](./hooks.md)（pre-commit）と [ci.md](./ci.md)（CI）に繋ぐ。

## ✅ チェックリスト

- [ ] `phpcs.xml.dist` / `eslint.config.js` が対象パスに一致
- [ ] `lint:code` が現状コードで通る（既存違反は対応方針を合意）
- [ ] space インデント / K&R `{` / `!` が弾かれる
- [ ] PHP は php-conventions で `!`・引数 `_` を検査した
- [ ] なお機械化しない規約（`i_`・制御構文 Allman・PHP の `===`）をレビュー観点として明示した
