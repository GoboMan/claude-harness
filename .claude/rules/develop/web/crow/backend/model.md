---
paths:
  - "**/crow3_*/app/classes/**"
---

# 🧠 crow / backend — model / service / presenter / util（Domain 側）

> **読むタイミング: `app/classes/_common_/` の PHP を書く・直すとき**
> （`model_<table>` / `model_<table>_<table>_service` / `model_<table>_presenter` / `common_presenter` / 非モデル util）。
> action だけを触るなら開かない。
>
> **境界の正本は [coding.md](./coding.md) §1.1**（本葉と矛盾したら向こうが勝つ）。
> action 側は [action.md](./action.md)、**raw フラグメントを使う定型クエリを書くなら [query.md](./query.md) §3.9 も開く**、
> 共通スタイルは [common/coding.md](../common/coding.md)。**共通側・他葉の再掲はしない。**
>
> 節番号は backend 規約全体の通し番号（`coding.md` §1 → `action.md` §2 → 本葉 §3・§4）。

---

## 3. model（Domain）

### 3.1 役割

`model_<table>` の**手書き部分**が、そのテーブルの Domain の住所。
永続化（ORM・生成メンバ）は framework 継承で同居する。それでよい。

> **そのモデルが主語であるロジック（判定・導出・定型取得）は、
> `model_<table>` のメソッドとして定義する。`module_*` 側に書かない。**

理由: module に置くと機能別に散り、同じ判定・同じ取得が複数 `action_*` に重複する。
モデルに寄せれば、**そのテーブルの意味を知りたいときに読む場所が 1 つ**になる。

### 3.2 crow の生成と拡張点

- crow は `db_design.txt`（住所と書式は [backend/db.md](./db.md)）から
  **`model_<table>` を自動生成**する。生成物はキャッシュであり、手で編集しない。
- 拡張は **`app/classes/_common_/model_<table>.php`**。
  crow はクラス宣言直後（最初の `{` の直後）に生成メンバを差し込んでから読み込む。
- ファイルが無ければ標準生成クラスのまま。**拡張は後から足せる。**

### 3.3 model に置くもの

| ロジックの性質 | 書き方 |
| --- | --- |
| 1 行の状態から導かれる派生値・判定（例: `is_owned_by()`） | **インスタンスメソッド**（配列行だけ扱うなら同趣旨の **static** でも可） |
| そのテーブルが**主語**の検索条件・集計・定型クエリ（JOIN を含んでよい） | **static メソッド**（`sql_select_all()` 起点、または `raw` フラグメントの組み立て） |
| 主語行に、関連表の情報を付け足す定型の合成（スキル一覧の後付け等） | 主語 model の **static**（HTTP は触らない） |
| 保存前の値の補完・整合チェック・削除時の後始末 | **拡張フック**（§3.7） |

表示用整形（`display_name`、日付の未設定表現、アプリが足す enum 表示など）は **model に置かない**（→ §3.11 presenter）。

### 3.4 定型クエリの置き場（JOIN を含む）

一覧・候補・件数付き検索を書くとき、**返す行集合の主語テーブル**の model に置く。

| 決め方 | 置き場所 |
| --- | --- |
| ページャの `rows` が何の一覧か | そのテーブルの `model_*` |
| JOIN やサブクエリで他表を参照する | それでも主語は上と同じ。他表は参照として書く |
| 他モデルを 1 つ参照するだけ（`xxx_row()` で親を引く等） | 参照元の model で完結してよい |

**取得（クエリ）の主語は常に表である。** JOIN があっても返す行集合の主語は一意に決まるので、
**定型クエリを §3.12 の service へ逃がさない**（service は取得ではなく判定・導出の住所）。

**行順（契約上の取得順）**

- 一覧・候補の行順の正本は **SQL の `ORDER BY`**（`sql_select_*` チェーン、または [query.md](./query.md) §3.9 フラグメント）。
- **取得後に PHP で並び替えない**（`usort` / `array_multisort` 等。action / model / presenter / util いずれも）。
- SQL の `ORDER BY` と PHP 側で同じ順を二重に持たない。
- 複数結果の合成後に「順」が要るなら、その順も SQL／取得クエリ側で決める。
- FE が並べ替えてよいのは、**契約上の行順を変えない見せ方だけ**（同一ページ内の一時 UI グルーピング等）。一覧の正順そのものを FE が作り直さない。

**やってはいけないこと**

- 複数テーブルのクエリを寄せ集める**横断のクエリ工場クラス**を新設し、そこに定型取得を溜め込むこと。
- 「JOIN があるから model に置けない」と判断すること（主語が一意なら model）。
- クエリ結果を PHP で並べ替えること（行順は SQL に閉じる）。

**action に残す取得まわり**

- いつどのクエリを呼ぶか、結果を見て止める／返すか。
- 複数の主語クエリを 1 リクエスト内で**順番に呼ぶ**こと（オーケストレーション）。
- 更新の Tx 境界。

### 3.5 行の付け足し・表示の置き場

取得後に行へフィールドを足す・表示用に直す処理は、中身で割る。

| 中身 | 置き場所 |
| --- | --- |
| 1 表（主語行）から導ける**業務上の派生値・判定** | その `model_*` |
| **複数表の状態を同時に見ないと決まらない業務上の判定・導出** | `model_<table>_<table>_service`（§3.12） |
| 1 表から導ける**共有の表示用整形**（契約に載せる） | `model_*_presenter`（§3.11） |
| 表非依存の**汎用表示整形** | `common_presenter`（§3.11） |
| 主語行に関連表データを定型で付け足す | 主語 `model_*` の static（または action が複数 model を順に呼ぶ） |
| 特定画面だけの見出し・文言・サマリー・見せ方 | **FE** feature / scene（action に溜めない） |
| 表非依存の**非表示**共有（フィルタ衛生など） | **非モデル util**（§4） |

「整形用の巨大クラスに何でも足す」はしない。迷ったら上表で割る。

### 3.6 拡張ファイルの書き方

```php
<?php

class model_user extends crow_db_table_model
{
	//--------------------------------------------------------------------------
	//	所有者かどうか（Domain 判定）
	//--------------------------------------------------------------------------
	public function is_owned_by($user_id)
	{
		return $this->owner_id === $user_id;
	}

	//--------------------------------------------------------------------------
	//	有効なユーザだけを引くクエリ
	//--------------------------------------------------------------------------
	public static function sql_select_active()
	{
		return self::sql_select_all()
			->and_where("deleted", 0)
			;
	}
}

?>
```

- クラス名は **`model_<テーブル名>`**、継承は **`crow_db_table_model`**。
- **`__construct()` を書かない。** 初期化が要るときは **`construct()`**
  （生成コンストラクタから呼ばれる）。
- **生成済みメンバを再定義しない。** フィールド、`m_table_name` / `table_name` / `primary_key`、
  `sql_select_all()` / `sql_select_one()`、定数まわりの `get_<field>_keys()` / `_map()` / `_symbols()` /
  `get_<field>_str()` / `<field>_str()`、参照テーブルの `<refer>_row()` は crow が差し込む。
  **定型クエリは `sql_select_all()` を上書きせず別名で生やす。**

### 3.7 保存・検証フック

保存や削除に絡む処理は action で前後に挟まず、**モデルの拡張フック**に置く。
`check_and_save()` 等から crow が呼ぶので、どの経路から保存されても効く。

| フック | 用途 |
| --- | --- |
| `validation_crow_ext()` | 追加バリデーション。失敗は `push_validation_error()` |
| `save_crow_ext()` | 保存の拡張。失敗時はエラーを積みつつ **`false` を返す** |
| `trash_crow_ext()` | 論理削除の拡張。失敗時は同上 |
| `delete_crow_ext()` | 物理削除の拡張。失敗時は同上 |

`save_ext()` / `validation_ext()` / `trash_ext()`（`_crow_` の無い名前）は
crow 内部用。**アプリ側で定義しない。**

### 3.8 model に持ち込まないもの

- **[coding.md](./coding.md) §1.1 のシステム責務すべて**（入出力・**終了**・Tx 境界・`$hdb` 取得・認証・セッション・`crow_log::error()`）。
  ここは「原則」ではなく**絶対**。異常は戻り値／`push_validation_error()` / `get_last_error()` で返し、止める判断は action に委ねる。
- **表示用メソッド**（`display_name` やアプリが足す表示導出 → §3.11 presenter）
- **画面固有の都合**（見せ方・画面上の並び → FE。契約レスポンスの束ねは action）
- **表非依存の共有フィルタ衛生**（§4。各 model へ複製しない）
- **一覧の PHP 並び替え**（行順は SQL。§3.4）

> 手書きメソッドは入出力から独立しているため、PHPUnit の単体テスト対象になる。
> 生成メンバはテストしない（切り方は [backend/testing.md](./testing.md)）。
> presenter の手書きメソッドも同様に単体テスト対象になる（§3.11）。

### 3.9 raw SQL とフラグメント

**本節は [query.md](./query.md) へ切り出した。**
JOIN・複合 filters・ページャ付き一覧を `.sql` フラグメントで組むなら、そちらを開く。

---

### 3.10 SQL ビルダチェーン（`sql_select_all()` 系）

単純な 1 表・単純条件の取得は **`sql_select_all()` チェーン**を使う。
複雑検索は [query.md](./query.md) §3.9 の raw フラグメントへ。

| 場面 | 手段 |
| --- | --- |
| 1 表・単純な `and_where` 程度 | `model_*::sql_select_*()` チェーン（別名 static から呼ぶ） |
| JOIN・複合 filters・pager 付き一覧 | [query.md](./query.md) §3.9 raw フラグメント |

**生成メンバ**

- `sql_select_all()` / `sql_select_one()` は **上書き禁止**（§3.6）。
- 定型条件は **`sql_select_active()` 等、別名 static** で生やす。

**記法**

- チェーンの改行・**セミコロン独立行**は [common/coding.md](../common/coding.md) に従う（backend では再掲しない）。

```php
public static function sql_select_active()
{
	return self::sql_select_all()
		->and_where("deleted", 0)
		;
}
```

### 3.11 presenter（共有表示値）

契約 payload に載せる**共有の表示値**は model ではなく presenter に置く。
画面固有の見せ方は FE（[frontend/viewpart-components.md](../frontend/viewpart-components.md) §9）。

#### 判定 — presenter に載せる表示値

次を**すべて**満たすもの:

1. 表（または表横断の共通形）の意味として安定している
2. **2 画面以上、または画面以外のチャネル（メール等）でも同じ文言／形が要る**
3. 契約 payload のフィールドとして載せる（FE は再導出せず提示する）

満たさない（その画面の見出し・レイアウト用ラベル・class 名など）→ FE。

#### `model_<table>_presenter`

| 項目 | 内容 |
| --- | --- |
| **住所** | `app/classes/_common_/model_<table>_presenter.php`（クラス名同名） |
| **入力** | 主語の `model_*` 行、または同趣旨の配列行。HTTP / `$hdb` / 認証は触らない |
| **出力** | 表示用のスカラー／小さい配列（契約フィールドの素材） |
| **呼び出し元** | action が契約レスポンスを束ねるとき。必要なら内部で `common_presenter` を使う |
| **置かないもの** | 業務判定、SQL、Tx、画面固有レイアウト、一覧の並び替え |

presenter → model の読み取り（行フィールド参照）は可。**model / service / util から presenter は呼ばない。**

生成 API（`get_<field>_str()` / `<field>_str()` 等）は crow 生成物として model に残す。
**アプリが足す表示導出**は presenter へ（生成メンバを presenter に複製しない）。

```php
<?php

class model_user_presenter
{
	//--------------------------------------------------------------------------
	//	表示用の氏名（契約・複数画面で共有）
	//--------------------------------------------------------------------------
	public static function display_name($user_row_)
	{
		$name = is_object($user_row_) ? $user_row_->name : ($user_row_['name'] ?? '');
		if( $name === '' ) return crow_msg::get('db.user.no_name');
		return $name;
	}
}

?>
```

#### `common_presenter`

| 項目 | 内容 |
| --- | --- |
| **住所** | `app/classes/_common_/common_presenter.php` |
| **責務** | 表に属さない表示整形の単一点（日付の未設定表現、null 安全な表示変換、enum マップ引きの**表示用**共通ヘルパなど） |
| **置かないもの** | 特定表の表示名組み立て（→ `model_*_presenter`）、フィルタ衛生・Domain 判定（→ §4 util / model）、クエリ工場 |

[coding.md](./coding.md) §1 の「横断の巨大クラスを新設しない」は**クエリ／Domain 寄せ集め**を禁ずる話として維持する。
`common_presenter` は**表示専用の薄い共有**に限定する。

日付・enum の**表示**共通形 → `common_presenter`。
フィルタ値の衛生など**非表示** → §4 util。
両方に使う生のマップ引きは model 生成 API／util に残し、表示用ラッパだけ presenter。

### 3.12 ドメインサービス（複数表にまたがる業務ロジック）

**1 つの表を主語にできない業務ロジックは、action に書かない。**
そのロジックをまとめる**クラス（またがる表名を連結した `model_*_service`）**を新設し、そこに閉じる。
これは §3 の Domain の延長であり、action（システム責務）へ business を漏らさないための唯一の逃げ道である。

#### 判定 — service を作る条件

次を**すべて**満たすとき、service を作る（1 つでも欠けたら作らない）。

1. **2 つ以上の `model_*`（表）の状態を同時に見ないと結論が出ない**業務判定・導出である
2. どちらか一方を**主語と言い切れない**（言い切れるなら主語 model の static。§3.3 / §3.4）
3. **業務のルールである**（システムの手続きではない。手続き＝呼ぶ順・Tx・終了は action）

作らない例:

| 見た目 | 実際の住所 |
| --- | --- |
| JOIN で他表を引く一覧・件数 | 主語 `model_*`（取得の主語は常に一意。§3.4） |
| 他表を 1 つ参照して判定するだけ（`xxx_row()` で親を引いて見る） | 参照元の `model_*` |
| 複数 model を「順番に呼ぶ」だけ | `action_*`（オーケストレーション。[action.md](./action.md) §2.1） |
| 表示文言の組み立て | presenter（§3.11） |
| 表非依存・非表示の純粋処理（フィルタ衛生等） | util（§4） |

#### 住所と形

| 項目 | 内容 |
| --- | --- |
| **住所** | `app/classes/_common_/model_<table>_<table>_service.php`（クラス名同名） |
| **命名** | **またがる表の名前を snake_case で連結し、`_service` を付ける。**`model_` ＋ 表名 ＋ … ＋ `_service`（例: `model_project_progress_service`）。**業務概念名・造語を使わない**（`model_assignment_service` のような名前は不可。どの表を束ねているかがファイル名から読めなくなる） |
| **表名の並び順** | **アルファベット順**（同じ組み合わせで別名の service が二重にできるのを防ぐ機械規則）。読みやすさ・主従を理由に並べ替えない。順が名前だけで決まるので、**新設前に既存の有無を名前で引ける** |
| **継承** | **しない**（`crow_db_table_model` を継承しない。表を持たない素のクラス。`model_*_presenter` と同じ形） |
| **入力** | `model_*` の行・配列行・スカラー。`$hdb` が要るなら**引数で受け取る**（[query.md](./query.md) §3.9） |
| **出力** | 判定結果（bool）・導出値・エラー文言・保存対象の値。**戻り値だけで語る** |
| **メソッド** | 原則 static の純粋関数。状態を持たせない |
| **置かないもの** | **[coding.md](./coding.md) §1.1 のシステム責務すべて**（終了・Tx 境界・`crow::get_hdb()`・`crow_request`・`crow_auth`・`crow_log::error()`）、表示整形（→ presenter）、定型クエリ本体（→ 主語 model） |

**1 クラス = 1 つの表の組み合わせ。** 名前が表の集合を表すので、

- **同じ組み合わせの service が既にあれば新設せず、そこにメソッドを足す**（`model_progress_project_service` が既にあるなら、progress × project の判定は全部そこ）。
- 表の組み合わせが違うなら別クラス（`model_progress_project_service` と `model_project_user_service` は別物）。
- **既存メソッドが新たに別の表を見るようになったら、そのメソッドを正しい名前のクラスへ移す**
  （`model_progress_project_service::can_edit()` が user 表も見るようになったら
  `model_progress_project_user_service` へ移す）。名前が表の集合を表す以上、これが唯一一貫した扱いである。
  **元のクラスに残したまま表を増やさない**——名前と中身がズレた瞬間、置き場の判定規則そのものが機能しなくなる。
  移動が面倒だという理由で action に判定を戻さない。
- **表名が 4 つ以上連なったら、本当に 1 つの判定かを疑う。** たいていは判定が 2 つ以上混ざっているか、
  実は主語が 1 表（→ `model_*`）である。名前を短くするために業務概念名へ逃げない——**分割して考え直す**。

呼び出し方向は **action → service → model**（読み取り）。
**model / presenter / util から service を呼ばない**（循環と、どちらが主語か分からないコードを避ける）。

#### 例

`project` × `assign` × `user` にまたがる判定（アルファベット順に並べて assign → project → user）:

```php
<?php

class model_assign_project_user_service
{
	//--------------------------------------------------------------------------
	//	この担当者がこの案件の進捗を編集してよいか
	//	（案件・担当割当・ユーザ権限の 3 表にまたがる業務ルール）
	//--------------------------------------------------------------------------
	public static function can_edit_progress($project_row_, $assign_row_, $user_row_)
	{
		if( $project_row_ === false ) return false;
		if( $project_row_->is_closed() === true ) return false;
		if( $user_row_->is_admin() === true ) return true;

		return model_assign::is_active_assignee($assign_row_, $user_row_->id);
	}
}

?>
```

```php
//	action — 結果を受けて止めるのは action（[action.md](./action.md) §2.3 / [coding.md](./coding.md) §1.1）
if( model_assign_project_user_service::can_edit_progress
	(
		$project_row,
		$assign_row,
		$user_row
	) === false )
{
	app::exit_ng('担当外のため操作できません。');
}
```

#### やらないこと

- **業務概念名・造語でクラスを立てる**（`model_assignment_service` / `model_billing_service` 等）。名前は**またがる表の連結**であること
- **service を「何でも入る横断クラス」にする**（[coding.md](./coding.md) §1）。表の組み合わせが違う判定を同じクラスへ寄せない
- 単一表の判定を service に上げる（主語 model が痩せて意味の在り処が散る）
- service に定型クエリ・SQL・Tx・終了を持ち込む
- **複数表判定を action にベタ書きして済ませる**（本節が存在する理由。これが最大の逸脱）

> service の手書きメソッドも **PHPUnit の単体テスト対象**（[backend/testing.md](./testing.md)）。
> [coding.md](./coding.md) §1.1 を守っていれば、行オブジェクト／配列を渡すだけでテストできる。

---

## 4. 非モデル util（表に属さない共有・非表示）

**どの `model_<table>` の Domain とも言えない**、かつ**表示ではない**処理だけを
`app/classes/_common_/` の非モデルクラスへ置く。

| 置いてよい | 置かない（寄せ先） |
| --- | --- |
| 複数 type／複数表の検索で共有するフィルタ値の衛生（型の強制、未指定センチネルの判定、キーワード LIKE 用の正規化など） | 特定表が主語の定型クエリ本体（→ 主語 model） |
| 表非依存の受理／parse のうち非表示のもの | **業務ルールとしての判定・導出**（1 表なら model、複数表なら §3.12 service）。util は業務を知らない |
| | 表非依存の**汎用表示整形**（→ `common_presenter`） |
| メール組み立ての送信処理、外部 API クライアントなど表に紐づかないサービス（表示文言の素材は presenter） | 1 表から導ける共有表示値（→ `model_*_presenter`） |
| | 画面固有の見せ方・画面上の並び（→ FE）。契約レスポンスの束ね（→ action） |

**単一の判定点を保つ。** 上記の共有衛生を各 model にコピーしない
（複製すると経路ごとに挙動がずれ、検索が一気に壊れる）。

model 側は「自表の許可キー・fragment 名・WHERE の意味」を持ち、
共有衛生が要るときだけ util に委譲する。

無理にどれかの model へねじ込まない。逆に、主語が一意な取得を util に逃がさない。
表示整形を util に置かない（§3.11）。

---

