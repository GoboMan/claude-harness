---
paths:
  - "**/crow3_*/**"
---

# 📦 crow — テスト設計（PHPUnit）

> crow のテストは **PHPUnit** を使う。ここでは最低限のベストプラクティスを定める。
> **テストの原則（何を・なぜテストするか）は develop の開発プロセスが土台。**
> GWT からテストを起こす／テスト設計と実装を別コンテキストで脱相関させる／Red→Green→Refactor／
> 最後はレッドチームで壊しにいく——これらは全開発共通なのでここには再掲せず、そこに従う。
> 本書は crow(PHP)＋PHPUnit の**具体的な書き方**だけを扱う。
> コードは [coding.md](./coding.md) のスタイル（Allman・snake_case・strict 比較・`!` 禁止）に従う。

## ツールと配置

- テストランナーは **PHPUnit**。設定は `phpunit.xml`（または `phpunit.xml.dist`）に集約する。
- テストは `tests/` 配下に置き、**対象コードのディレクトリ構成をミラー**する。
- 1 テスト対象（クラス／関数）につき **1 テストクラス**。ファイル名＝クラス名。
- 実行はコマンド一発で通るようにする（例：`vendor/bin/phpunit`）。CI でも同じコマンドで回す。

## テストの構造（AAA ＝ Given-When-Then）

各テストは **Arrange（準備）→ Act（実行）→ Assert（検証）** の3段で書く。
これは orchestrator が渡す GWT（Given-When-Then）受け入れ条件にそのまま対応する。

```php
<?php

use PHPUnit\Framework\TestCase;

class check_value_test extends TestCase
{
    //  空文字は不正として false を返す
    public function test_returns_false_when_value_is_empty()
    {
        //  Arrange
        $i_value = "";

        //  Act
        $result = check_value($i_value);

        //  Assert
        $this->assertFalse($result);
    }
}
```

## 命名

- テストクラス名は `<対象>_test`（snake_case）。
- テストメソッド名は **`test_` 始まりで、振る舞いを文で表す** snake_case にする。
  「何をしたら何が起きるか」が名前だけで分かること。

```php
public function test_rejects_name_when_it_exceeds_max_length()
public function test_returns_error_when_age_is_not_numeric()
```

## アサーション（strict を徹底）

coding.md の「真偽値・null は型付比較」「`!` 禁止」をテストでも守る。

- 値の一致は **`assertSame()`**（型込みの厳密比較）。`assertEquals()` は原則使わない。
- 真偽は **`assertTrue()` / `assertFalse()`**（`assertTrue( ! $x )` のような否定を書かない）。
- null は **`assertNull()` / `assertNotNull()`**。
- 個数・キーなどは専用アサーション（`assertCount()`, `assertArrayHasKey()` 等）を使い、
  自前で数えて比較しない。

```php
$this->assertSame(3, $count);          //  == ではなく型込みで一致
$this->assertFalse($is_valid);         //  ! を使わずに false を検証
$this->assertNull($record);
$this->assertCount(2, $rows);
```

## 1 テスト = 1 振る舞い

- 1 つのテストは**1 つの振る舞い**だけを検証する。無関係な複数アサートを詰め込まない。
- テスト本文に **条件分岐・ループを書かない**（ロジックが入ると「テストのバグ」を生む）。
  分岐したくなったら、それは別テストかデータプロバイダに分ける。

## 失敗・境界・異常系を網羅する（データプロバイダ）

開発プロセスの「ハッピーパスだけでなく失敗・空・権限・境界を条件に含める」を実装する手段。
同じ振る舞いの入力バリエーションは **`@dataProvider`** でまとめ、ケース名を付ける。

```php
/**
 * @dataProvider invalid_names
 */
public function test_rejects_invalid_name( $i_name_ )
{
    $this->assertFalse(check_value($i_name_));
}

public static function invalid_names(): array
{
    return
    [
        "empty"       => [""],
        "only_spaces" => ["   "],
        "too_long"    => [str_repeat("a", 256)],
    ];
}
```

## テストの独立性

- テスト同士は**順序に依存しない**。共有状態を持ち込まない。
- 準備・後始末は `setUp()` / `tearDown()` に置き、テスト間で状態を持ち越さない。
- グローバル・静的状態やスーパーグローバル（`$_GET` 等）を書き換えたら、必ず元に戻す。

## テストダブル（モックは境界だけ）

- モックするのは **DB・外部 I/O・時刻・乱数など「境界」だけ**。内部ロジックはモックしない。
- crow の DB ハンドル（`crow::get_hdb()` 相当）や `crow_request` など、外界に触れる部分を差し替える。
- モックは最小限に。モックだらけのテストは「実装の写経」になり反証力を失う。

```php
public function test_returns_empty_list_when_no_row_matches()
{
    //  DB 境界をモック（内部ロジックはモックしない）
    $hdb = $this->createMock(crow_hdb::class);
    $hdb->method("select")->willReturn([]);

    $result = list_users($hdb);

    $this->assertSame([], $result);
}
```

## 決定性（フレークを作らない）

- 実時刻・乱数・ネットワーク・ファイルシステムに**暗黙依存しない**。必要なら注入してテストで固定する。
- 外部サービスに実接続する結合テストは、単体テストと**別のスイート**に分ける（`@group integration` 等）。

## カバレッジは目標ではなく信号

- カバレッジ率は「どこを見ていないか」の目安であって**達成目標にしない**。
- 開発プロセスの通り、**テスト緑は前提条件であって完成条件ではない**。緑の後にレッドチーム（攻撃）で壊しにいく。

## ✅ テスト着手前チェックリスト

- [ ] 対象の GWT 受け入れ条件（orchestrator が渡す）を先に確認したか
- [ ] ハッピーパスに加え、失敗・空・境界・権限のケースを洗い出したか
- [ ] 各テストが 1 振る舞いに絞られ、テスト内にロジックが無いか
- [ ] `assertSame` / `assertTrue|False` / `assertNull` で strict に検証しているか（`!` を使っていないか）
- [ ] モックは境界だけに留めているか
- [ ] テストが順序非依存・決定的か
