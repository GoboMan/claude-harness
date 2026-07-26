---
paths:
  - "**/crow3_*/**"
---

# 🧪 crow / backend — テスト設計（PHPUnit）

> **共通則は [common/testing.md](../common/testing.md)**（1テスト=1振る舞い・失敗系を含める・モックは境界だけ・
> 決定性・コマンド一発・命名・カバレッジの扱い）。本書は**それに従ったうえで**、
> PHPUnit 固有の書き方だけを扱う。共通側の再掲はしない。
>
> コードは [common/coding.md](../common/coding.md) のスタイル（Allman・snake_case・strict 比較・`!` 禁止）に従う。

---

## ツールと配置

- テストランナーは **PHPUnit**。設定は `phpunit.xml`（または `phpunit.xml.dist`）に集約する
- テストは `tests/` 配下に置き、**対象コードのディレクトリ構成をミラー**する
- 1 テスト対象（クラス／関数）につき **1 テストクラス**。ファイル名＝クラス名
- **ファイル名の探索規則を `phpunit.xml` に明示する。** PHPUnit の既定は `*Test.php` サフィックスなので、
  crow の snake_case 命名（`check_value_test.php`）のままだと**1 件も発見されない**。
  `<testsuite>` の `<directory suffix="_test.php">` を設定する

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
        $value = "";

        //  Act
        $result = check_value($value);

        //  Assert
        $this->assertFalse($result);
    }
}
```

> `i_` プレフィックスは**リクエストパラメータ由来であることの印**なので、
> テスト内で組み立てたリテラルには付けない（付けると印の意味が薄まる）。

## 命名

- テストクラス名は `<対象>_test`（snake_case）
- テストメソッド名は **`test_` 始まりで、振る舞いを文で表す** snake_case にする

```php
public function test_rejects_name_when_it_exceeds_max_length()
public function test_returns_error_when_age_is_not_numeric()
```

## アサーション（strict を徹底）

common/coding.md の「真偽値・null は型付比較」「`!` 禁止」をテストでも守る。

- 値の一致は **`assertSame()`**（型込みの厳密比較）。`assertEquals()` は原則使わない
- 真偽は **`assertTrue()` / `assertFalse()`**（`assertTrue( ! $x )` のような否定を書かない）
- null は **`assertNull()` / `assertNotNull()`**
- 個数・キーなどは専用アサーション（`assertCount()`, `assertArrayHasKey()` 等）を使い、自前で数えて比較しない

```php
$this->assertSame(3, $count);          //  == ではなく型込みで一致
$this->assertFalse($is_valid);         //  ! を使わずに false を検証
$this->assertNull($record);
$this->assertCount(2, $rows);
```

## 入力バリエーションはデータプロバイダで

共通則の「ハッピーパスで終えない」を PHPUnit で実装する手段。
同じ振る舞いの入力バリエーションは **`@dataProvider`** でまとめ、ケース名を付ける。

```php
/**
 * @dataProvider invalid_names
 */
public function test_rejects_invalid_name( $name_ )
{
    $this->assertFalse(check_value($name_));
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

## 準備と後始末

- 準備・後始末は `setUp()` / `tearDown()` に置く（PHPUnit が要求する camelCase なので、
  この 2 つは snake_case 規約の例外になる）
- グローバル・静的状態やスーパーグローバル（`$_GET` 等）を書き換えたら、必ず元に戻す

## crow の境界を差し替える

モックの対象は crow の**外界に触れる部分**に限る。DB ハンドル（`crow::get_hdb()` 相当）や `crow_request` がそれにあたる。

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

外部サービスに実接続する結合テストは、単体テストと**別のスイート**に分ける（`@group integration` 等）。

---

## ✅ テスト着手前チェックリスト

- [ ] 対象の GWT 受け入れ条件（orchestrator が渡す）を先に確認したか
- [ ] `phpunit.xml` のファイル探索サフィックスが crow の命名と一致しているか
- [ ] `assertSame` / `assertTrue|False` / `assertNull` で strict に検証しているか（`!` を使っていないか）
- [ ] 入力バリエーションをデータプロバイダにまとめ、ケース名を付けたか
- [ ] スーパーグローバル・静的状態を元に戻しているか
