---
paths:
  - "**/crow3_*/**"
---

# ⚙️ crow / backend — コーディング規約（サーバ側の上乗せ）

> **共通スタイルは [common/coding.md](../common/coding.md)**（インデント表・Allman・snake_case・
> `i_` プレフィックス・`===`／`!` 禁止・コメント `//<TAB>`・80 桁・PHP 閉じタグ・ファイル終端改行）。
> 本書は**それに従ったうえで**、サーバ側（action / model / crow API を叩く PHP）にだけ効く差分を定める。
> 共通側の再掲はしない。記法は common に従い、無いルールを埋めるために写してこないこと。
>
> 以下で定めるのは記法ではなく **「サーバ側のロジックをどこに書くか」** である。
> 白紙から実装しても、この区分に自然と収まるように書く。

---

## 1. 全体概要

厳密な 4 層を crow 上で再現しない。やることは **action / model / 非モデル util の置き場を徹底する** こと。

| よく言う層 | crow での実体 | 一言 |
| --- | --- | --- |
| Presentation | view / viewpart / フロント JS | 画面 |
| Application（ユースケース） | `module_*` の `action_*` | 受けて並べて返す |
| Domain | `model_<table>` の**手書き**メソッド・フック | その表の意味・判定・定型取得 |
| Infrastructure | crow ORM／生成メンバ／`raw` SQL／外部 API | model 継承側に**同居してよい** |
| （表に属さない共有） | `app/classes/_common_/` の非モデルクラス | フィルタ衛生・汎用整形など |

**核心（必須）**

1. **その表の意味・判定・定型クエリ（一覧の主語になる取得を含む）→ `model_*`**
2. **リクエストの受け・結果を見てどう返すか・複数モデルの更新順／Tx → `action_*`**
3. **どの表の Domain とも言えない共有の純粋処理 → 非モデル util（§4）**
4. **契約レスポンスの束ね → action。見せ方・ラベル導出・画面上の並び → frontend（feature / scene）**
   （model に画面専用を入れない。FE 側の正本は [frontend/viewpart-components.md](../frontend/viewpart-components.md) §9）

補足:

- Domain の独立ディレクトリは作らない。
- model が Domain＋永続化を同居するのは妥協ではなく、**crow における Domain の正規の住所**。
- Domain と Infrastructure を model 外で分離しようとしない。
- **クエリ組み立てや行整形のための巨大な横断クラスは新設しない。**
  置き場に迷ったら §3 / §4 の判定表で割り振る。

流れのイメージ:

```
action:  受け取る → model に聞く／並べる → 契約どおりに返す
model:   主語テーブルの意味・判定・定型クエリ・行の導出・保存フック
util:    表に属さない共有の純粋処理だけ
FE:      契約 payload を受け、見せ方・ラベル・画面並びを組み立てる
```

---

## 2. action（ユースケース）

### 2.1 役割

`module_*` の `action_*` は **1 リクエスト分の手続き**だけを持つ。
ドメインの意味判定や定型クエリは書かず、model（と必要なら util）の結果を受けて進行を決める。

骨格:

1. **受け取る**（`crow_request` 等）
2. **ゲート**（認証・権限。中身の判定は model に聞き、NG なら `app::exit_ng` 等で返す）
3. **並べて保存／取得**（複数モデルの更新順・Tx。取得は主語 model の定型クエリを呼ぶ）
4. **返す**（`exit_ok` / `exit_ng` / リダイレクト。**契約レスポンス**をここで束ねる）

### 2.2 action に置くもの

| 置く | 置かない |
| --- | --- |
| リクエストの読み取り・レスポンス | 1 行／1 表から導ける判定・派生値（→ model） |
| 認証・権限チェックの**進行制御**（結果を見て止める／進める） | 一覧・候補の定型クエリ組み立て（→ 主語 model） |
| 複数モデルの更新順序・トランザクション | 保存前の補完・整合・削除後始末（→ model フック） |
| **契約レスポンス**の束ね（`exit_ok` の payload 形） | 見せ方・ラベル導出・画面上の並び（→ FE feature / scene） |
| 複数 model の呼び出しを **1 リクエストとして順番に並べる**こと | 表非依存の共有純粋処理（→ §4 util） |

### 2.3 判定は model、結果の扱いは action

「所有者か？」のような**判定自体は Domain（model）**。
action はその **bool／結果を受けて** `exit_ng` するかどうかを決める。

```php
//  model（Domain）— 判定
public function is_owned_by($user_id)
{
	return $this->owner_id === $user_id;
}

//  action（ユースケース）— 結果を受けて進行を決める
if( ! $row->is_owned_by($user_id) )
{
	app::exit_ng('forbidden');
}
```

複数 action で同じ「結果を見て止める」形を共有したいときだけ、
module 内の薄いヘルパにまとめてよい。
ヘルパの中でも**判定は model を呼び**、`exit_*` だけを寄せる。
判定ロジックをヘルパや action にベタ書きしない。

`crow_request` / `app::exit_*` / 認証を model に入れない
（単体テストと再利用が死ぬ）。

### 2.4 命名

`action_*` は **`action_<動詞>_<リソース>`** とする。

| 動詞 | 用途の例 |
| --- | --- |
| `get` | 一覧・1件・件数などの取得 |
| `create` | 新規作成 |
| `update` | 更新（部分更新も同 verb） |
| `delete` | 削除 |

例: `action_get_progress_rows` / `action_update_progress` / `action_create_project` / `action_delete_progress`

### 2.5 リクエストの受け方

[common/coding.md](../common/coding.md) の **`i_` プレフィックス**に従う。
リクエストパラメータ由来の変数には必ず `i_` を付ける。

| 読み方 | 使う場面 |
| --- | --- |
| `crow_request::get_int($key, $default)` | ID・`page_no` など数値。default を明示する |
| `crow_request::get($key, $default)` | `filters` 配列・文字列・構造体 |

```php
$i_page_no = crow_request::get_int('page_no', 1);
$i_filters = crow_request::get('filters', []);
$i_progress_id = crow_request::get_int('progress_id', 0);
```

- 入力の読み取りは **action の先頭**にまとめる。
- 複数パラメータを束ねる薄いヘルパを module 内に置いてもよい（判定は model に残す）。

### 2.6 レスポンスの返し方

**Ajax／API 向け action** は、成功・失敗とも **`app::exit_ok` / `app::exit_ng` で終了**するのが基本。

| 結果 | 返し方 |
| --- | --- |
| 成功（データあり） | `app::exit_ok($payload)` |
| 成功（データなし） | `app::exit_ok()` |
| 失敗 | `app::exit_ng($message)` |

**画面遷移向け action** は `return` やリダイレクトも使ってよい。
用途で混在してよいが、**1 action 内で exit_* と return を混ぜない**
（その action の出口を読み手が追えるようにする）。

- `exit_ok` / `exit_ng` の後に処理を書かない（到達不能）。
- 例外を action の主経路にしない（crow の慣習は exit_* 中心）。

### 2.7 エラーメッセージの層分け

ユーザー向け文言は **model と action で役割を分ける**。

| 種類 | 置き場所 | action での使い方 |
| --- | --- | --- |
| 業務ルール由来（競合・状態不正・保存失敗の理由など） | **model**（`build_*_message()` や行の `get_last_error()`） | `app::exit_ng($row->get_last_error())` 等、**model から受け取って渡すだけ** |
| 取得失敗の汎用定型（「対象が見つかりません」等） | action に短い定型文を置いてよい | 行が取れない／ID が 0 など、**action 入口で分かる失敗** |
| 権限・担当外 | 文言は action または model のメッセージビルダのどちらかに統一 | 判定は model、止めるのは action（§2.3） |

**やらないこと**

- 業務メッセージを action にベタ書きして、同じ意味を model と二重管理する。
- model が `get_last_error()` を返しているのに、action で別文言を invent する。

```php
//  保存失敗 — model のエラーをそのまま返す
if( $progress_row->check_and_save() === false )
{
	app::exit_ng($progress_row->get_last_error());
}

//  業務競合 — model のメッセージビルダ
if( model_progress::is_pair_write_congested(...) === true )
{
	app::exit_ng(model_progress::build_pair_write_congestion_message());
}

//  入口で分かる取得失敗 — action の短い定型文でよい
if( $progress_row === false )
{
	app::exit_ng('進捗情報の取得に失敗しました。');
}
```

### 2.8 トランザクション

**1 リクエスト内で複数 model の保存／更新が走るときだけ** Tx を張る。
単一 model の `check_and_save()` だけなら **begin 不要**。

| 操作 | 置き場所 |
| --- | --- |
| `$hdb->begin()` / `commit()` / `rollback()` | **action のみ** |
| 複数副作用の成否判定（`can_commit_*`） | **model**（純粋関数。DB を触らない） |
| 保存本体・フック | model（フック内で Tx を開かない） |

**流れ**

1. 入口ゲート（取得・権限）は **begin の前**でよい。
2. 複数保存が必要なら `$hdb = crow::get_hdb();` → `$hdb->begin();`
3. 各 model を保存。失敗時は **`rollback()` → 後始末 → `exit_ng`**
4. 副作用が複数あるとき、commit 前に **`model_*::can_commit_*()`** で全部成功したか判定
5. NG なら `rollback()` → 後始末 → `exit_ng`
6. OK なら `$hdb->commit();` → `exit_ok`

**rollback（必須）**

`begin()` したあと `exit_ng` する前は **必ず `rollback()`** する。
装置の release など Tx 外の後始末も **action で**行う。

```php
$hdb = crow::get_hdb();
$hdb->begin();

$trash_result = $progress_row->trash();
$release_result = ...;
$expire_result = ...;

if( model_match_suggestion::can_commit_delete(
	$trash_result,
	$release_result,
	$expire_result
) === false )
{
	$hdb->rollback();
	model_progress::release_pair_write_serializer();
	app::exit_ng('進捗情報の削除に失敗しました。');
}

$hdb->commit();
model_progress::release_pair_write_serializer();
app::exit_ok();
```

**`can_commit_*` の役割**

- 複数の保存／副作用結果（成功・0件・false）を **1 箇所で突き合わせる**純粋判定。
- action 内に if 連鎖を散らさず、**中間状態（片方だけ成功）を作らない**ため model に置く。
- 判定ロジックそのもの（「0 件は成功か」等）も model が持つ。

**やらないこと**

- model フック内で `begin` / `commit` / `rollback` する。
- `begin` 後に rollback せず `exit_ng` する。
- 単一 save だけなのに habit で毎回 `begin` する。

### 2.9 認証・権限ゲート

#### ログイン必須（module 入口）

**ログイン済みかどうか**は **`module_*` 基底の `preload()`** で確認する。
各 `action_*` では `crow_auth::is_logined()` を繰り返さない。

| 状況 | 返し方 |
| --- | --- |
| 未ログイン + 通常リクエスト | ログイン画面へ `redirect`（`preload` が `false`） |
| 未ログイン + Ajax | `app::exit_unauthorized()` 等（401 + JSON） |

`preload()` は **module 全体への入口ゲート**（セッション延命・配列入力ガード等もここに置いてよい）。
**個別リソースの担当スコープ**（「この行を触れるか」）は action + model で判定する（下記）。

#### 担当スコープ・権限（リソース単位）

| 層 | 責務 |
| --- | --- |
| **model** | スコープの**意味**（`is_in_assigned_scope($row, $user_id)` 等） |
| **action** | model の結果を見て **止める**（`exit_ng`） |
| **module 基底** | model を呼ぶ**薄いラッパ**（`$this->is_*`）は可。判定ロジックは書かない |

```php
//  model — 担当スコープの意味
public static function is_in_assigned_scope($i_row_, $i_user_id_)
{
	//  案件担当・企業担当・… の業務ルール
}

//  action — 結果を見て止める
if( model_progress::is_in_assigned_scope($org_row, crow_auth::get_logined_id()) === false )
{
	app::exit_ng('担当外のため操作できません。');
}
```

#### エラーメッセージ

権限 NG の文言は **action または model の `build_*_message()` に統一**する
（例: 「担当外のため操作できません。」）。
action ごとに別文言を invent しない。

#### やらないこと

- model 内で `exit_ng` / `redirect` する。
- ログイン確認を各 action にコピペする（`preload` があるのに二重化する）。
- スコープ判定を action にベタ書きする（意味は model へ）。

### 2.10 ログ（warning / error）

crow のエラーハンドラ設定によって **`crow_log::error` がリクエストを exit させる**ことがある。
ログレベルと置き場所を分け、ドメイン層から致命 log を乱発しない。

| レベル | 用途 | 置き場所 |
| --- | --- | --- |
| **warning** | 業務乖離・想定外入力・修復可能な異常（enum 乖離、想定外型の行など） | **model / util** |
| **error** | 続行不能・設定不備・本来起きない致命 | **action 入口 / preload**（model からは原則出さない） |

**enum 乖離・map に無い DB 値**

- 表示は既定値に倒しつつ **`crow_log::warning()` で記録**する。
- **同一リクエスト内で同じ乖離を何度も warning しない**（1 回だけ記録する）。

**やらないこと**

- model / util から `crow_log::error()` を routine に使う（exit リスク）。
- 握り潰し（ログも無しで既定値だけ返す）— 乖離は warning で残す。
- action が正常系の細部まで logging する（ノイズ化）。

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
| 1 行の状態から導かれる派生値・判定・表示用整形（例: `is_owned_by()`・日付の未設定表現・enum 表示） | **インスタンスメソッド**（配列行だけ扱うなら同趣旨の **static** でも可） |
| そのテーブルが**主語**の検索条件・集計・定型クエリ（JOIN を含んでよい） | **static メソッド**（`sql_select_all()` 起点、または `raw` フラグメントの組み立て） |
| 主語行に、関連表の情報を付け足す定型の合成（スキル一覧の後付け等） | 主語 model の **static**（HTTP は触らない） |
| 保存前の値の補完・整合チェック・削除時の後始末 | **拡張フック**（§3.5） |

### 3.4 定型クエリの置き場（JOIN を含む）

一覧・候補・件数付き検索を書くとき、**返す行集合の主語テーブル**の model に置く。

| 決め方 | 置き場所 |
| --- | --- |
| ページャの `rows` が何の一覧か | そのテーブルの `model_*` |
| JOIN やサブクエリで他表を参照する | それでも主語は上と同じ。他表は参照として書く |
| 他モデルを 1 つ参照するだけ（`xxx_row()` で親を引く等） | 参照元の model で完結してよい |

**やってはいけないこと**

- 複数テーブルのクエリを寄せ集める**横断のクエリ工場クラス**を新設し、そこに定型取得を溜め込むこと。
- 「JOIN があるから model に置けない」と判断すること（主語が一意なら model）。

**action に残す取得まわり**

- いつどのクエリを呼ぶか、結果を見て止める／返すか。
- 複数の主語クエリを 1 リクエスト内で**順番に呼ぶ**こと（オーケストレーション）。
- 更新の Tx 境界。

### 3.5 行の整形・付け足しの置き場

取得後に行へフィールドを足す・表示用に直す処理は、中身で割る。

| 中身 | 置き場所 |
| --- | --- |
| 1 表（主語行）から導ける意味・表示用整形 | その `model_*` |
| 主語行に関連表データを定型で付け足す | 主語 `model_*` の static（または action が複数 model を順に呼ぶ） |
| 特定画面だけの見出し・文言・サマリーの束ね | **action**（§2） |
| どの表にも属さない汎用（null 安全な日付変換、enum マップ引きの共通形など） | **非モデル util**（§4） |

「整形用の巨大クラスに何でも足す」はしない。迷ったら上表で割る。

### 3.6 拡張ファイルの書き方

```php
<?php

class model_user extends crow_db_table_model
{
	//--------------------------------------------------------------------------
	//	表示用の氏名を組み立てる
	//--------------------------------------------------------------------------
	public function display_name()
	{
		if( $this->name === "" ) return crow_msg::get('db.user.no_name');
		return $this->name;
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

- **HTTP**（`crow_request` / `crow_response` / `app::exit_ok()` / `exit_ng()` / リダイレクト / 認証の進行制御）
- **画面固有の都合**（見せ方・ラベル導出・画面上の並び → FE。契約レスポンスの束ねは action）
- **複数モデルの Tx 境界**（action の仕事）
- **表非依存の共有フィルタ衛生**（§4。各 model へ複製しない）

> 手書きメソッドは入出力から独立しているため、PHPUnit の単体テスト対象になる。
> 生成メンバはテストしない（切り方は [backend/testing.md](./testing.md)）。

### 3.9 raw SQL とフラグメント

定型取得で `sql_select_all()` ビルダだけでは足りないとき（JOIN・複合 filters・ページャ付き一覧）は、
**SQL フラグメント + 主語 model の組み立て**を使う。

#### 分担

| 層 | 責務 |
| --- | --- |
| **`app/assets/query/`** | `@fragment_name` 形式の SQL 断片（SSOT） |
| **主語 `model_*`** | フラグメント名・args・WHERE の意味・`get_allowed_*_filter_keys()` |
| **§4 util** | 表横断のフィルタ衛生（skip / coerce / キーワード正規化） |
| **`action_*`** | いつ実行するか、`$hdb->raw*` / `raw_select*` の呼び出し、pager への受け渡し |

model は **意味と args** を組み立て、**`$hdb` の取得は action**（または model の `$hdb` 引数付き薄いラッパ）で実行する。
model 内に `$hdb` 取得を散らさない設計を推奨する。

#### SQL ファイルの置き場

- **`app/assets/query/_common_/`** … 複数 module で共有する断片
- **`app/assets/query/<module>/`** … module 固有の断片
- フラグメント名 **`@where_progress_status`** 等は、PHP 側の `$hdb->raw('where_progress_status', ...)` と **完全一致**させる。

#### allow-list

- filters の **許可キー**は主語 model の **`get_allowed_*_filter_keys()`**（または同等の static）が持つ。
- action が filters をそのまま SQL に渡さない。
- 表横断 util に allow-list を集約しない（§4 は衛生だけ）。

#### `raw` と `raw_noencode`

| API | 使う場面 |
| --- | --- |
| `$hdb->raw($name, ...$args)` | フラグメント内の **`"%s"` 付き**プレースホルダへ値を渡す（addslashes される） |
| `$hdb->raw_noencode($name, ...$parts)` | **WHERE 句の結合**、すでに組み立て済みの条件文字列、非引用文脈への埋め込み |

- 非引用文脈（`= %s` / `in (%s)` で引用符が無い `%s`）へ渡す値は **model が `(int)` 等で型を潰す**。
  表横断の skip / coerce は **§4 util** に委譲（各 model へ複製しない）。
- `raw()` の addslashes だけを非引用 `%s` の防御に使わない。

#### ページャ付き一覧（rows + count）

JOIN 付き一覧では **pager の count 自動生成を使わない**（ユーザー入力を WHERE に載せると走査が壊れうる）。

主語 model が **同一 FROM / JOIN / WHERE** の 2 本を返す:

```php
return
[
	'rows' => $hdb->raw_noencode('get_user_rows', $where_str),
	'count' => $hdb->raw_noencode('count_user_rows', $where_str),
];
```

action はこの配列を `crow_db_pager::create_with_query(...)` や `set_count_query()` に渡す。

#### 組み立ての流れ（例）

```php
//  model — 意味と args
public static function build_search_where_fragments($i_filters_)
{
	//  allow-list → fragment name + args（非引用は (int) 等）
}

//  action — 実行
$hdb = crow::get_hdb();
$fragments = model_user::build_search_where_fragments($i_filters);
$where = [];
foreach($fragments as $f)
{
	$where[] = $hdb->raw($f['name'], ...$f['args']);
}
$where_str = (count($where) > 0) ? implode(' and ', $where) : true;
$queries = model_user::build_list_queries($hdb, $where_str);
```

#### やらないこと

- 横断クラスに `@fragment` 名と args 組み立てを溜め込む。
- PHP 内に長い SQL 文字列をベタ書きする（`.sql` に置く）。
- JOIN 一覧で count 自動生成だけに頼る。

### 3.10 SQL ビルダチェーン（`sql_select_all()` 系）

単純な 1 表・単純条件の取得は **`sql_select_all()` チェーン**を使う。
複雑検索は §3.9 の raw フラグメントへ。

| 場面 | 手段 |
| --- | --- |
| 1 表・単純な `and_where` 程度 | `model_*::sql_select_*()` チェーン（別名 static から呼ぶ） |
| JOIN・複合 filters・pager 付き一覧 | §3.9 raw フラグメント |

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

---

## 4. 非モデル util（表に属さない共有）

**どの `model_<table>` の Domain とも言えない**処理だけを
`app/classes/_common_/` の非モデルクラスへ置く。

| 置いてよい | 置かない（寄せ先） |
| --- | --- |
| 複数 type／複数表の検索で共有するフィルタ値の衛生（型の強制、未指定センチネルの判定、キーワード LIKE 用の正規化など） | 特定表が主語の定型クエリ本体（→ 主語 model） |
| 表非依存の汎用整形（null 安全な日付変換、enum マップ引きの共通形など） | 1 表から導ける表示用整形（→ その model） |
| メール組み立て、外部 API クライアントなど表に紐づかないサービス | 見せ方・画面上の並び・ラベル導出（→ FE feature / scene）。契約レスポンスの束ね（→ action） |

**単一の判定点を保つ。** 上記の共有衛生を各 model にコピーしない
（複製すると経路ごとに挙動がずれ、検索が一気に壊れる）。

model 側は「自表の許可キー・fragment 名・WHERE の意味」を持ち、
共有衛生が要るときだけ util に委譲する。

無理にどれかの model へねじ込まない。逆に、主語が一意な取得を util に逃がさない。

---

## 5. 既存コードを触るとき

- `action_*` に主語が一意な判定・導出・定型クエリがベタ書きされていたら、
  **その機能の実装スコープ内だけ** 主語 model へ移す。
- 横断クラスに定型取得や行整形が溜まっているのを見つけたら、
  **触る機能のスコープ内だけ** §3 / §4 の判定表で割り振る（一括解体はしない）。
- **一括リライトはしない。**
- 未拡張テーブルにドメインが載るなら、そのスコープで
  `app/classes/_common_/model_<table>.php` を生やす。

---

## 6. ここに書くもの（育て方）

サーバ側にだけ効く規約が出てきたら、この葉に追記する。
action / model / util の責務配置・リクエスト／Tx／raw／認証／ログ・ビルダは本書で扱う。

> 1 葉が肥大したら関心事ごとに分割する（`backend/model.md` 等）。
> **frontend にも効く話になった時点で、この葉ではなく common/coding.md へ上げる。**
