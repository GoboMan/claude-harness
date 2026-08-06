---
paths:
  - "**/crow3_*/**"
---

# 🧪 crow / backend — テスト設計（PHPUnit）

> **共通則は [common/testing.md](../common/testing.md)**（テスト対象はドメインだけ・1テスト=1振る舞い・
> 失敗系を含める・モックは境界だけ・決定性・コマンド一発・命名・カバレッジの扱い）。本書は**それに従ったうえで**、
> PHPUnit 固有の書き方と、crow 生成面の除外を扱う。共通側の再掲はしない。
>
> コードは [common/coding.md](../common/coding.md) のスタイル（Allman・snake_case・strict 比較・`!` 禁止）に従う。

---

## 何を Red にするか（kernel／生成面は除外）

共通則の「テスト対象はドメイン（手書き）だけ」を backend で機械的に切る。

**Red の対象（手書き・`app/`）**

- `app/classes/_common_/model_<table>.php` に**自分で定義した**インスタンス／static メソッド
- 拡張フック（`validation_crow_ext()` / `save_crow_ext()` / `trash_crow_ext()` / `delete_crow_ext()`）
- `module_*` の `action_*` および、どのテーブルにも属さない手書きユーティリティ（例: `modifier` の独自ヘルパ）

**Red にしない（1）— `engine/kernel/**`**

SUT が crow 本体であるテストは起こさない。例:

- `crow_db_table_model::input_from_request()` が受け付ける datetime キー形の網羅・特性化
- kernel のバリデーション／CSRF／viewpart 解決／mysqli 層そのものの挙動固定
- 「engine は直接直さないので実測して表を固定する」類の characterization（それは framework 側の関心。app ゲートを直すなら **ゲート側**を Red にする）

**Red にしない（2）— crow が差し込む生成メンバ**

[backend/coding.md](./coding.md) の「生成済みメンバを再定義しない」と同じ集合。例:

- フィールド本体、`m_table_name` / `table_name` / `primary_key`
- `sql_select_all()` / `sql_select_one()`（定型クエリを別名で生やした手書きメソッドは対象）
- 定数／enum まわりの `get_<field>_keys()` / `_map()` / `_symbols()` / `get_<field>_str()` / `<field>_str()`
- 参照テーブルの `<refer>_row()`
- `db_design.txt` ↔ 生成キャッシュ／`get_*_map()` の一致を値ごとに写経する sync テスト

```php
//  NG: kernel の入力形を特性化する（SUT が engine）
public function test_engine_resolves_split_date_keys()
{
    //  crow_db_table_model::input_from_request() を実測して固定する、など
}

//  NG: 生成された定数マップを値ごとに写経する（enum が増えるたびケースが増えるだけ）
public function test_status_map_contains_active()
{
    $this->assertArrayHasKey("active", model_user::get_status_map());
}

//  OK: 手書きドメイン／ゲートが、ある入力のときにどう振る舞うかを検証する
public function test_is_active_returns_false_when_status_is_banned()
{
    $row = new model_user();
    $row->status = "banned";
    $this->assertFalse($row->is_active());
}
```

**境界の判定（迷ったらここ）**

| 問い | Yes → | No → |
| --- | --- | --- |
| 落ちたとき直すコードは `app/` か？ | 対象になりうる | 対象外（kernel／生成面） |
| 既存の `engine_*_characterization_*` や生成 map sync を増やそうとしているか？ | 止める | — |
---

## ツールと配置

- テストランナーは **PHPUnit**。設定は `phpunit.xml`（または `phpunit.xml.dist`）に集約する
- **既定スイート**は `tests/` 配下に置き、**対象コードのディレクトリ構成をミラー**する
- **結合スイート**（実 DB・実サービスに接続するもの）は `tests/integration/` へ分ける（§スイートの分離）
- 1 テスト対象（クラス／関数）につき **1 テストクラス**。ファイル名＝クラス名
- **ファイル名の探索規則を `phpunit.xml` に明示する。** PHPUnit の既定は `*Test.php` サフィックスなので、
  crow の snake_case 命名（`check_value_test.php`）のままだと**1 件も発見されない**。
  `<testsuite>` の `<directory suffix="_test.php">` を設定する
- **機能ID タグ**（共通則の「スコープ実行」）: テストクラスに `#[Group('F-001')]`
  （PHPUnit 9 以前は `@group F-001`）を付ける。指定実行は `phpunit --group F-001`

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

---

## スイートの分離（`phpunit.xml` で住所ごとに切る）

実 DB・実サービスに接続するテストは、共通則の
[「スイートは実行に何を要求するかで分ける」](../common/testing.md)に従って**フォルダで**分ける。
**`@group integration` のようなタグで分けない。** タグ方式は既定スイートの実行コマンドが
`--exclude-group` を落とした瞬間に混入し、しかもその混入が緑のまま気づけない。

PHPUnit の既定探索は `tests` 配下を再帰的に拾うので、**`<exclude>` を書かないと結合テストが既定スイートに混ざる**。

```xml
<testsuites>
    <testsuite name="default">
        <directory suffix="_test.php">tests</directory>
        <exclude>tests/integration</exclude>
    </testsuite>
    <testsuite name="integration">
        <directory suffix="_test.php">tests/integration</directory>
    </testsuite>
</testsuites>
```

| スイート | 実行 | いつ回すか |
| --- | --- | --- |
| 既定 | `phpunit --testsuite default` | 赤緑ループで毎回。**DB が無いマシンでも緑になること** |
| 結合 | `phpunit --testsuite integration` | 境界（返す直前・commit 前・CI）のみ |

`tests/` 直下（既定スイート）では、DB ハンドル等の境界を上記「crow の境界を差し替える」のとおり**必ずモックする**。
実接続したくなったら、それは `tests/integration/` へ置くべきテストである。

---

## ✅ テスト着手前チェックリスト

- [ ] 対象の GWT 受け入れ条件（orchestrator が渡す）を先に確認したか
- [ ] **検証対象は手書きドメイン（`app/`）か**（`engine/kernel`・生成メンバ・enum アクセサ網羅・engine 特性化になっていないか）
- [ ] `phpunit.xml` のファイル探索サフィックスが crow の命名と一致しているか
- [ ] 書こうとしているテストは実 DB・実サービスに繋ぐか（繋ぐなら `tests/integration/`、繋がないなら `tests/` 直下）
- [ ] `phpunit.xml` の既定スイートが `tests/integration` を `<exclude>` しているか
- [ ] `assertSame` / `assertTrue|False` / `assertNull` で strict に検証しているか（`!` を使っていないか）
- [ ] 入力バリエーションをデータプロバイダにまとめ、ケース名を付けたか（kernel／生成面の値一覧展開になっていないか）
- [ ] スーパーグローバル・静的状態を元に戻しているか
