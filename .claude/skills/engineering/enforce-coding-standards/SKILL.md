---
name: enforce-coding-standards
description: このリポジトリの coding 規約（crow/PHP の coding.md ＝ Allman・TAB・snake_case・=== / ! 禁止 等）を、リンタ（PHP=PHPCS / JS=ESLint）のルールセットとして機械化し、pre-commit / CI で強制する。ユーザーがコーディング規約を機械チェックしたい、house style を lint で強制したい、Allman や TAB を CI で守りたい場合に使用する。
---

# Enforce Coding Standards

このリポジトリの **coding 規約を機械可読なルールセットに落とし、破ったら止める**。規約の SSOT は
[coding.md](../../../rules/engineering/web/crow/coding.md)（crow/PHP）。本スキルは「どう書くか」を助言する
`codebase-design` とは別で、「決めた書式を破ったら弾く」強制ゲート側。

## 最重要：整形ツールの選定（なぜ Prettier / PHP-CS-Fixer を使わないか）

coding.md は **Allman（`{` を次行に）** と **TAB** を要求する。ここが道具選びの分岐点になる。

- **Prettier（JS）は Allman を出せない**（K&R 固定）。既定は space インデント。→ house style と根本的に非互換。
- **PHP-CS-Fixer / PSR も K&R 前提**。→ 同上。
- したがって「自動整形で house style に寄せる」戦略は取れない。**Allman と TAB を*表現できるリンタ*で*検査*する**方針を採る。
  - **JS/TS → ESLint**（`brace-style: "allman"`, `indent: "tab"` を表現できる）
  - **PHP → PHP_CodeSniffer(PHPCS)**（`Generic.Functions.OpeningFunctionBraceBsdAllman` 等で Allman を検査できる）

## 機械化できる規約／できない規約（正直に線を引く）

coding.md の全項目が既製ルールで表現できるわけではない。**表現できるものは強制し、できないものはレビュー
（human / spec-lint 相当）に回す**と明記する。黙って「全部チェックした」風にしない。

| coding.md の規約 | JS(ESLint) | PHP(PHPCS) |
| --- | --- | --- |
| TAB インデント | `indent: ["error","tab"]` | `Generic.WhiteSpace.DisallowSpaceIndent` + `tab-width` |
| Allman（`{` 次行） | `brace-style: ["error","allman"]` | `Generic.Functions.OpeningFunctionBraceBsdAllman`（関数）※制御構文は限定的 |
| 80 桁 | `max-len: ["error",{code:80}]` | `Generic.Files.LineLength`（`absoluteLineLimit`）|
| LF 改行 | `linebreak-style: ["error","unix"]` | `Generic.Files.LineEndings`（eol=`\n`）|
| `===`/`!==`（bool/null） | `eqeqeq: ["error","always"]` | 標準 sniff に無い → **カスタム or レビュー** |
| **`!` 禁止** | `no-restricted-syntax`（下記セレクタ）| 標準 sniff に無い → **カスタム or レビュー** |
| snake_case | `id-match`（下記・限定的）| 標準 sniff に無い → **カスタム or レビュー** |
| 引数末尾 `_` / 入力 `i_` | ❌ 既製ルール無し | ❌ 既製ルール無し |
| ファイル終端の改行 | ESLint `eol-last` | `Generic.Files.EndFileNewline`? → PSR2 の `Files.EndFileNewline` |
| PHP 短縮開始タグ禁止 | — | `Generic.PHP.DisallowShortOpenTag` |

> `i_` / 引数 `_` / no-`!`(PHP) / snake_case(PHP) はカスタム sniff を書けば機械化できるが自作コストが高い。
> **まずは既製ルールで表現できる範囲を強制し、残りは「レビュー観点」として明示**する。カスタム sniff 化は
> 必要になってから段階的に足す。

## 手順

### 1. 対象スタックを検出する

- `composer.json` または `*.php` → **PHP（PHPCS）** ルートへ
- `package.json` / `tsconfig.json` / `*.ts` `*.js` → **JS/TS（ESLint）** ルートへ
- 両方あるなら両方セットアップする（例: crow 本体 + フロント JS）

### 2A. PHP → PHP_CodeSniffer

依存（Composer）:

```
squizlabs/php_codesniffer
```

`phpcs.xml.dist` を生成する（coding.md の機械化可能サブセット）。**TAB 幅は crow の規約に合わせる。**

```xml
<?xml version="1.0"?>
<ruleset name="crow-coding">
    <description>coding.md（crow/PHP）の機械化可能サブセット</description>

    <file>src</file>
    <arg name="tab-width" value="4"/>
    <arg value="p"/>

    <!-- TAB インデント（スペース禁止） -->
    <rule ref="Generic.WhiteSpace.DisallowSpaceIndent"/>
    <rule ref="Generic.WhiteSpace.ScopeIndent">
        <properties>
            <property name="tabIndent" value="true"/>
        </properties>
    </rule>

    <!-- Allman（関数の { を次行） -->
    <rule ref="Generic.Functions.OpeningFunctionBraceBsdAllman"/>

    <!-- 80 桁を基準（超過は warning、極端な超過を error） -->
    <rule ref="Generic.Files.LineLength">
        <properties>
            <property name="lineLimit" value="80"/>
            <property name="absoluteLineLimit" value="120"/>
        </properties>
    </rule>

    <!-- LF / ファイル終端の改行 / 短縮開始タグ禁止 -->
    <rule ref="Generic.Files.LineEndings">
        <properties>
            <property name="eolChar" value="\n"/>
        </properties>
    </rule>
    <rule ref="Generic.PHP.DisallowShortOpenTag"/>
</ruleset>
```

composer script:

```json
{ "scripts": { "lint:code": "phpcs" } }
```

> **制御構文の Allman**（`if(){` の `{` 次行）や `===`/no-`!`/`i_`/引数 `_` は上表の通り標準 sniff で表現
> できない。これらは coding.md の「レビュー観点」として残し、必要なら custom sniff（`sniffs/` に自作）で
> 段階的に機械化する。この判断をユーザーに伝える。

### 2B. JS/TS → ESLint（flat config）

依存（検出した package manager で devDependency）:

```
eslint
```

`eslint.config.js`（flat config・ESLint v9+）を生成する。**coding.md を表現する。**

```js
export default [
  {
    files: ["**/*.js", "**/*.ts"],
    rules: {
      // TAB インデント
      indent: ["error", "tab"],
      // Allman（{ を次行に）
      "brace-style": ["error", "allman", { allowSingleLine: false }],
      // 80 桁
      "max-len": ["error", { code: 80, ignoreUrls: true, tabWidth: 4 }],
      // LF 改行 / ファイル終端の改行
      "linebreak-style": ["error", "unix"],
      "eol-last": ["error", "always"],
      // bool/null は型付比較
      eqeqeq: ["error", "always"],
      // 配列・オブジェクトの末尾カンマ（coding.md JS 規約）
      "comma-dangle": ["error", "always-multiline"],
      // NOT 演算子 "!" の禁止（coding.md）
      "no-restricted-syntax": [
        "error",
        {
          selector: "UnaryExpression[operator='!']",
          message: "coding.md: NOT 演算子 ! は使用禁止。=== false / !== true で書く",
        },
      ],
      // snake_case（限定的・既存の型名等で誤検知しうる。ユーザーに確認）
      camelcase: "off",
      "id-match": [
        "error",
        "^[a-z_][a-z0-9_]*$",
        { properties: false, onlyDeclarations: true },
      ],
    },
  },
];
```

npm script:

```json
{ "scripts": { "lint:code": "eslint ." } }
```

> `id-match` の snake_case は import した外部シンボルや型で誤検知しうる。**既存コードで大量に出たら**、
> ユーザーに「今直す / 一旦 warn に下げて段階移行」を確認する（黙って除外しない）。

### 3. ゲートに接続する

`lint:code` を強制点に繋ぐ（どちらか／両方をユーザーに確認）。

- **ローカル pre-commit** … `setup-pre-commit` 導入済みなら、そのフックに `lint:code` を追記
  （PHP は `composer run lint:code`、JS は `npm run lint:code`）。
- **CI / PR** … `setup-ci-checks` のワークフローに `lint:code` ステップを追加（回避不可の最終ゲート）。

### 4. 検証する

- [ ] `phpcs.xml.dist` または `eslint.config.js` が存在し、対象パスが実態に一致
- [ ] `composer run lint:code` / `npm run lint:code` が現状コードで通る（既存違反は対応方針を合意）
- [ ] わざと space インデント / K&R `{` / `!` を入れたコードが弾かれる
- [ ] pre-commit / CI で実際に走る
- [ ] **機械化できない規約（`i_`・引数 `_`・制御構文 Allman・PHP の `!`/`===`）をレビュー観点として明示したか**

### 5. コミットする

`chore: enforce coding standards (phpcs / eslint from coding.md)`

## 補足

- **これは coding.md の一部しか機械化しない**。process.md の通り「機械チェック緑は前提であって完成条件では
  ない」。表で ❌／レビュー行きにした規約は、人間または spec-lint 系レビューで担保する。
- 規約の SSOT はあくまで [coding.md](../../../rules/engineering/web/crow/coding.md)。ルール値を変えたく
  なったらリンタ設定でなく coding.md を正として直し、その後ルールセットを追従させる。
- native（モバイル）等 crow 以外のスタックには対応する coding 規約が rules 側にまだ無い。規約が増えたら
  本スキルに言語別ルートを足す。
