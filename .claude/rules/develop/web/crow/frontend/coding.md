---
paths:
  - "**/crow3_*/**"
---

# 🎨 crow / frontend — コーディング規約（表面の上乗せ）

> **共通スタイルは [common/coding.md](../common/coding.md)**（インデント表・Allman・snake_case・
> `i_` プレフィックス・`===`／`!` 禁止・コメント `//<TAB>`・80 桁・PHP 閉じタグ・ファイル終端改行）。
> 本書は**それに従ったうえで**、表面（HTML / CSS / JS）にだけ効く差分を定める。
> 共通側の再掲はしない。
>
> 対象は crow の view（HTML＋埋め込み PHP）・CSS・JS を書く／直すとき。

## HTML 中のコメント

HTML の中のコメントは **`<!-- ～ -->` を使わず**、PHP のコメントを使う。
HTML コメントはそのままクライアントへ送出されてしまうため。

```php
<!-- こうではなくて -->
<div></div>

<?php /**** こうする ****/ ?>
<div></div>
```

## 折り返しの例外（HTML）

[common/coding.md](../common/coding.md) の「横幅 半角 80 文字を基準に折り返す」に従うが、
**HTML はタグの途中で折り返さない**。80 文字を超えてもタグは 1 つのまとまりとして保つ。

## JavaScript における配列・オブジェクトの末尾カンマ

JavaScript では、配列やオブジェクトの**末尾要素の行末をカンマで終わる**ようにする（2024/12/23）。

```javascript
let obj =
{
    key1 : "value1",
    key2 : "value2",
};
```

## JavaScript の比較はすべて型付

common/coding.md の型付比較は「真偽値と null」を対象に定めているが、
**JavaScript では対象を限定せず、常に `===` / `!==` を使う**。

PHP と違い JS の `==` は文字列と数値、`null` と `undefined` を暗黙変換して等しいと判定するため、
`"0" == 0` や `null == undefined` が成立してしまう。比較対象を選ばず型付に統一する。

```javascript
//  NG
if( id == "1" )

//  OK
if( id === "1" )
```

`!` の禁止は common/coding.md のとおり JS でも守る（`=== false` / `!== true` で書く）。
