---
paths:
  - "**/crow3_*/**"
---

# 📦 crow — コーディング規約（全レイヤ共通 / PHP 独自フレームワーク）

> crow で新規システムを作る際の**最低限のコーディングルール**。
> 進め方の基盤は develop の開発プロセス（反証駆動・縦切りスライス）に従うこと。
> 目的：コードを一定のルールで書くことで、後の担当者のメンテナンスを楽にする。
>
> 本書は **PHP / JS / CSS / HTML のすべてに効く共通スタイル**を扱い、
> frontend / backend のどちらを書くときも従う。レイヤ固有の上乗せは
> [frontend/coding.md](../frontend/coding.md) ／ backend 側の葉（[coding.md](../backend/coding.md)＝境界の核・[action.md](../backend/action.md)・[model.md](../backend/model.md)・[query.md](../backend/query.md)）にある。
> **共通ルールをレイヤ側へ写さないこと**（SSOT はここ 1 箇所）。

> **注記:** 以下のコード例は構造（ブロックの揃え方など）を示すもの。実インデントは下表の通り **TAB** を使う（例中は表示の都合で見やすく整形している）。

## インデント

| 対象 | インデント |
| --- | --- |
| PHP | TAB |
| HTML | 半角スペース 1 文字 |
| HTML 内の PHP | TAB |
| CSS | TAB |
| JS | TAB |
| SQL ファイル | TAB |

## 文字コードと改行コード

- **UTF-8** / 改行 **LF** / **BOM 無し** に統一する。

## ブロック記述

`{` と `}` の縦のラインをそろえる（Allman スタイル）。

```php
function func()
{
    $value = "abc";
    if( $value == "abc" )
    {
        return $value;
    }
}
```

## 命名規則

- php / js / css のシンボルは、基本的にすべて **スネークケース**。
- ただし、**メソッドの引数は末尾にアンダーバー `_` を付与**する。

```php
function test_func( $arg1_, $arg2_ )
{
    $local_val = "val";
    return $arg1_.$local_val.$arg2_;
}
```

## 命名規則（ローカル変数）

Web でリクエストパラメータとして受け取った内容を一時変数に格納することがある。
それが**リクエストパラメータ由来か、内部で生まれたデータか**を判断できるよう、
変数名の前に **`i_`（input の意）** を付ける。

```php
function action_test()
{
    $i_name = crow_request::get("name");
    $i_age  = crow_request::get("age");

    if( check_value($i_name) === false ) return エラー;
}
```

## コードをコピペする場合

ブラウザからコードをコピペすると、TAB であるべき箇所がスペースでペーストされる場合がある。
**ペーストした場合は必ずコードの整形をチェックする。**

## 制御構文

- 演算子の前後はブランクをあける。
- `else if` を使う。

```php
if( $value=="abc" )
{
}
else if( $key == "0" && $value == "1" )
{
    //  演算子の前後でブランクをあける
}
```

`switch` の `case` ブロックはインデントを下げる。`break` は中でも外でも可。

```php
switch( $option )
{
    case "pattern1":
    {
        break;
    }

    case "pattern2":
    {
    }
    break;
}
```

## 文字列中の変数

文字列に変数を埋め込まない（連結する）。

```php
$value = "123";

//  こうではなく、
$data = "値は、$value です";

//  こうする
$data = "値は、".$value." です";
```

目視のチェック漏れを防ぐため。エディタのハイライターによっては、文字列中の変数が文字列と一体化して見えづらくなる。

## 複数行に跨る構文

式が複数行にまたがる場合、最後のセミコロン `;` は最終行に書かず、**独立した 1 行**に記載する。
その際、前の行のインデントに合わせる。

```php
$sql = model_xxx::sql_select_all()
    ->and_where("aa", "bb")
    ->and_where("cc", "dd")
    ;
```

追加修正を容易にし、漏れを防ぐため。

## 複数行に跨る関数コール

引数が長くなり改行する場合、`(` と `)` の縦のラインを揃える。

```php
{
    exec_function
    (
        "arg1arg1arg1",
        "arg2arg2arg2",
        "arg2arg2arg2",
    );
}
```

## 複数行に跨る複雑な構文

引数区切りは続けてカンマ `,` を記載し、`{}` や `()` などのブロックは改行する。

```php
{
    test_func
    (
        get_status(crow::get_hdb(), "test_table", "format"),
        simulate
        (
            first_param("abc", "def", "ghi"),
            long_expression
            (
                "abcdefghijklmn",
                "true or false",
                12345
            ),
            "last parameter"
        )
    );
}
```

## コメント

php / js のコード中コメントは **`//<TAB>コメント`** とする。3 行以上になる場合は **`/* ～ */`**。

### コメントの前に改行を入れる

コメントの前には空行をあける。

```php
//  処理です
self::exec_func();

//  処理２です
self::exec_func2();
```

ただし、ブロック開始行の次の行には改行不要。

```php
if( xxxxxx )
{
    //  ここは前に空行不要
    self::exec_func();
}
```

## 文書の横幅と折り返しの目安

- 各プログラムファイルの横幅は **半角 80 文字**を基準に折り返しを考える。
- 80 文字を超える場合は、式の区切りやブラケットで適宜折り返す。
- ただし、コメントの `// ------略-----` は、頭のインデントを含めて横幅 80 文字にあわせる。

## 型付の比較演算子

- 真偽値と null に対する比較演算は**必ず型付（`===` / `!==`）**で行う。
- **NOT 演算子 `!` は使用禁止**。

```php
$target = true;
if( $target === true )
{
    //  処理
}
```

```php
$target = false;

//  ↓ のような「!」は使わない
if( ! $target )
{
}

//  "===" で false チェックする。
//  場合によっては "!==" で true チェックとする。
//  "=== false" と "!== true" のどちらが適切かはロジックや文脈で異なる。
if( $target === false )
{
}
```

## PHP 閉じタグ

ファイル終端の閉じタグ `?>` は、現時点では**つけておく**。
多少オーバーヘッドはあるが気にする程度ではなく、開始に対する終了を明確にした方がよいという考え。

```php
<?php
～
?>
```

## ファイル終端の改行

PHP に限らず、**ファイルの終端は必ず改行で終わる**ようにする。
