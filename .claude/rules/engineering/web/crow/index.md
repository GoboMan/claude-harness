# 📖 crow — カタログ（framework: crow / PHP 独自フレームワーク）

> **crow** は知人作の PHP 独自フレームワーク。ここはその「箱」。
> crow 固有の規約・実装ルール・テスト設計を、**関心ごとの葉（`.md`）として必要になった時に生やす**。
> あなた（AI）は、タスクに関係する葉だけを開くこと。

## ⛔ 書く前に：実装着手ゲート

> **coding.md / testing.md を開く前に、必ずここを通す。**
> crow のコードを書く／直す前に、対象機能が `docs/spec/features.md` に載っており、
> `docs/spec/<feature>.md` と `docs/contracts/<feature>.md` が **`fixed`** かを確認する。
> **1つでも欠けたら実装しない。** [practices/process.md](../../practices/process.md) の
> **§1.5 実装着手ゲート**に従い Phase 1（定義）へ戻る。
> 「既存パターンに似た小さな CRUD」も「ユーザーが実装を頼んだ」も免除にならない。
> ゲートを通した後に、下記の style / test 規約を開くこと。

> ⚠️ **将来 2つ目の PHP framework（Laravel 等）を導入するとき:** coding.md / testing.md は
> `paths: **/*.php` で条件ロードしている。別 framework の `.php` にも crow 規約（Allman・TAB・snake_case・
> 引数末尾 `_`・`!` 禁止）が誤適用され**スタイルを誤らせる（correctness 退行）**。その際は crow の
> coding/testing を crow 開発 skill へ切り出すか、framework 判別子（ディレクトリ限定の glob 等）を入れること。

## 📦 crow のルール

- **[コーディング規約](./coding.md)** → `./coding.md`
  インデント・命名（スネークケース／引数末尾 `_`／入力変数 `i_`）・ブロック整形・比較演算子など、crow の記述スタイル。
  crow のコードを書く／直す／レビューするときに参照する。

- **[テスト設計（PHPUnit）](./testing.md)** → `./testing.md`
  PHPUnit 前提のテストの書き方（AAA・strict アサーション・データプロバイダ・モックは境界だけ）。
  crow のテストを設計・実装するときに参照する。原則は practices/process.md が土台。

<!--
  ▼ 関心ごとに 2 行概要＋パスで追記する（例）
- **[〇〇](./xxx.md)** → `./xxx.md`
  概要1行目 / 概要2行目。
-->

> **原則:** 1 葉 = 1 関心事（coding / testing …）。小さく始め、育ったら分割する。
