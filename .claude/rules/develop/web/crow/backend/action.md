---
paths:
  - "**/crow3_*/**/module_*.php"
---

# 🚦 crow / backend — action（ユースケース）

> **読むタイミング: `module_*` の `action_*` / `preload()` を書く・直すとき。**
> それ以外の住所を触るだけなら開かない。
>
> **境界の正本は [coding.md](./coding.md) §1.1**（本葉と矛盾したら向こうが勝つ）。
> Domain 側の書き方は [model.md](./model.md)、raw SQL フラグメントは [query.md](./query.md)、
> 共通スタイルは [common/coding.md](../common/coding.md)。**共通側・他葉の再掲はしない。**
>
> 節番号は backend 規約全体の通し番号（`coding.md` §1 → 本葉 §2 → `model.md` §3・§4）。

---

## 2. action（ユースケース）

### 2.1 役割

`module_*` の `action_*` は **1 リクエスト分の手続き**だけを持つ。
Clean Architecture の Use Case / Interactor、DDD の Application Service に相当する役割だが、
**Interactor 層は crow に新設しない**。Domain の住所は引き続き `model_*`。

**action は「入力の明示 → 委譲 → 出力の明示」だけを書く。**
action はユースケースのオーケストレータであり、**作業場ではない**。

`action_*` を上から読んだとき、次の三つが **action 本文のローカル変数と、本文から直接見える `exit_*`** から分かること。

1. **何を入力にしたか** — リクエスト由来の `$i_*` と、認証などサーバ側で足す値
2. **何を出力するか** — 本文の `exit_ok` / `exit_ng` に渡す契約上のキーと形
3. **途中で何をしたか** — 業務は `model_*`／定型クエリ、表示は presenter。action 自身は判定や表示整形の中身を持たない

骨格（必須の読み順）:

1. **入力を開く** — `crow_request::*` を action 先頭に直書きし、使う `$i_*` を揃える
2. **受理をゲートする** — 検証・権限は `model_*`（または表非依存なら [model.md](./model.md) §4 util）に聞き、**NG なら action 本文で `exit_ng`**
3. **取得・更新を頼む** — 主語 `model_*` の定型クエリ／保存。複数なら順番と Tx だけ action が持つ
4. **表示値を頼む** — 契約に載せる共有表示値は `model_*_presenter` / `common_presenter`（[model.md](./model.md) §3.11）
5. **出力を閉じる** — 本文の `exit_ok` で契約キーをその場に並べる

委譲の一文:

> action に残してよいのは **呼び出す相手の選定と順番、およびその結果を見て止める／返す判断**だけ。  
> 「どう判定するか」「どう並べるか」「どう表示文字列にするか」は、それぞれ `model_*`・SQL・presenter に依頼する。

```php
public function action_get_xxx_rows()
{
	//  入力を開く
	$i_scope = crow_request::get('assignment_scope', '');
	$i_page_no = crow_request::get_int('page_no', 1);

	//  受理をゲートする（判定は委譲、exit は本文）
	$message = model_xxx::validate_list_request($i_scope);
	if( $message !== '' ) app::exit_ng($message);

	//  取得を頼む
	$login_user_id = (int) crow_auth::get_logined_id();
	$queries = model_xxx::build_list_queries($login_user_id, $i_scope);
	$pager = crow_db_pager::create_with_query($queries['rows'])
		->set_count_query($queries['count'])
		->set_page_no($i_page_no)
		->build()
		;

	//  表示値を頼む
	$rows = model_xxx_presenter::present_list_rows($pager->get_rows());

	//  出力を閉じる（契約キーを明示）
	app::exit_ok(
	[
		'rows' => $rows,
		'pager' => modifier::create_pager_info_for_view($pager),
	]);
}
```

### 2.2 action に置くもの

| 置く | 置かない |
| --- | --- |
| リクエストの読み取り（先頭直書き）・レスポンス | 1 行／1 表から導ける判定・派生値（→ model） |
| **[coding.md](./coding.md) §1.1 のシステム責務すべて**（終了・Tx 境界・`$hdb` 取得・認証・致命ログ） | **複数表にまたがる業務判定・導出**（→ [model.md](./model.md) §3.12 service） |
| 認証・権限チェックの**進行制御**（結果を見て本文で止める／進める） | 一覧・候補の定型クエリ組み立て（→ 主語 model） |
| 複数モデルの更新順序・トランザクション | 保存前の補完・整合・削除後始末（→ model フック） |
| **契約レスポンス**の束ね（`exit_ok` のキーを明示） | 共有の表示値導出（→ presenter）。画面固有の見せ方・並び（→ FE） |
| 複数 model / presenter の呼び出しを **1 リクエストとして順番に並べる**こと | 表非依存の共有純粋処理（→ [model.md](./model.md) §4 util） |
| | `crow_request` を隠すだけの薄い束ねヘルパ、通過コピーだけの飾りヘルパ |

### 2.3 判定は model、結果の扱いは action

「所有者か？」のような**判定自体は Domain（model / service）**。
action はその **bool／結果を受けて** 本文で `exit_ng` するかどうかを決める。
これは [coding.md](./coding.md) §1.1 の絶対則 1 の具体形である——**Domain は真偽を返すだけで、止めない。**

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
ヘルパは **判定結果（bool／メッセージ等）を返すだけ**とし、**`exit_*` は action 本文に残す**
（本文から出口が追えるようにする）。判定ロジックをヘルパや action にベタ書きしない。

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

- 入力の読み取りは **action の先頭に直書き**する。
- **`crow_request` を隠すだけの薄い束ねヘルパ**（例: `*_list_request()` が get をまとめるだけ）は**置かない**。
- 一度読んだキーを別箇所で `crow_request` から**再読しない**（先頭の `$i_*` だけを使う）。
- 検証用に配列が要るなら、action 内でその場で組み立てて validate に渡すか、validate に個別引数を渡す。
- 意味のある validate / parse（引数 → 受理値 or エラー文言）は残してよい。
  表の意味なら `model_*`、表非依存なら [model.md](./model.md) §4 util。**request の読取自体は action に残す**。

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
- **`exit_ok` の payload は契約フィールドをその場で明示して並べる。**
  巨大な共有 `to_rows` 結果などを丸投げして、契約キーが見えない返し方をしない。
  共有表示値は presenter の出力を契約キーに載せる（[model.md](./model.md) §3.11）。
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
| `$hdb->begin()` / `commit()` / `rollback()` | **action のみ**（[coding.md](./coding.md) §1.1 のシステム責務） |
| 複数副作用の成否判定（`can_commit_*`） | **Domain**（純粋関数。DB を触らない）。主語が 1 表なら `model_*`、**主語を決められないなら `model_<table>_<table>_service`（[model.md](./model.md) §3.12）** |
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
| **warning** | 業務乖離・想定外入力・修復可能な異常（enum 乖離、想定外型の行など） | **model / service / presenter / util**（Domain から出してよい唯一の記録） |
| **error** | 続行不能・設定不備・本来起きない致命 | **action 入口 / preload のみ。** Domain（model / service / presenter / util）から**呼ばない**——`crow_log::error()` は exit しうるので [coding.md](./coding.md) §1.1 絶対則 1 の違反になる |

**enum 乖離・map に無い DB 値**

- 表示は presenter 側で既定値に倒しつつ、乖離検知は **`crow_log::warning()` で記録**する（model / util / presenter のいずれか一箇所）。
- **同一リクエスト内で同じ乖離を何度も warning しない**（1 回だけ記録する）。

**やらないこと**

- Domain（model / service / presenter / util）から `crow_log::error()` を呼ぶ（exit リスク。[coding.md](./coding.md) §1.1）。
- 握り潰し（ログも無しで既定値だけ返す）— 乖離は warning で残す。
- action が正常系の細部まで logging する（ノイズ化）。

---

