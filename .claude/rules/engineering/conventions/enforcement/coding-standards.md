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
| `===`/`!==` | `eqeqeq:["error","always"]` | 標準 sniff に無い → カスタム/レビュー |
| **`!` 禁止** | `no-restricted-syntax`（下記） | 標準 sniff に無い → カスタム/レビュー |
| snake_case | `id-match`（限定的） | 標準 sniff に無い → カスタム/レビュー |
| 引数末尾 `_` / 入力 `i_` | ❌ 既製ルール無し | ❌ 既製ルール無し |
| PHP 短縮開始タグ禁止 | — | `Generic.PHP.DisallowShortOpenTag` |

> `i_` / 引数 `_` / 制御構文 Allman / PHP の `!`・`===` は**レビュー観点**として残す（カスタム sniff 化は必要になってから）。**「全部チェックした風」にしない。**

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

## ゲート接続

`lint:code` を [hooks.md](./hooks.md)（pre-commit）と [ci.md](./ci.md)（CI）に繋ぐ。

## ✅ チェックリスト

- [ ] `phpcs.xml.dist` / `eslint.config.js` が対象パスに一致
- [ ] `lint:code` が現状コードで通る（既存違反は対応方針を合意）
- [ ] space インデント / K&R `{` / `!` が弾かれる
- [ ] 機械化できない規約（`i_`・引数 `_`・制御構文 Allman・PHP の `!`/`===`）をレビュー観点として明示した
