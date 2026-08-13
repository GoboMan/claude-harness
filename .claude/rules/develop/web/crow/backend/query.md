---
paths:
  - "**/crow3_*/app/assets/query/**"
---

# 🗃️ crow / backend — raw SQL とフラグメント

> **読むタイミング: `app/assets/query/**` の `.sql` を書く・直すとき。**
> model 側に raw フラグメントを使う定型クエリを書くときも、**`.sql` を必ず伴う**ので本葉を開く。
> `sql_select_all()` チェーンだけで足りる単純取得なら開かなくてよい（[model.md](./model.md) §3.10）。
>
> **境界の正本は [coding.md](./coding.md) §1.1**（本葉と矛盾したら向こうが勝つ）。
> 置き場の判定は [model.md](./model.md) §3.4、実行を書くのは [action.md](./action.md)。
> SQL ファイルのインデント（TAB）は [common/coding.md](../common/coding.md)。
>
> 節番号は backend 規約全体の通し番号（本葉は `model.md` §3 の中の §3.9 を切り出したもの）。

---

## 3.9 raw SQL とフラグメント

定型取得で `sql_select_all()` ビルダだけでは足りないとき（JOIN・複合 filters・ページャ付き一覧）は、
**SQL フラグメント + 主語 model の組み立て**を使う。

#### 分担

| 層 | 責務 |
| --- | --- |
| **`app/assets/query/`** | `@fragment_name` 形式の SQL 断片（SSOT）。**`ORDER BY` もここに含める** |
| **主語 `model_*`** | フラグメント名・args・WHERE の意味・行順・`get_allowed_*_filter_keys()` |
| **[model.md](./model.md) §4 util** | 表横断のフィルタ衛生（skip / coerce / キーワード正規化） |
| **`action_*`** | いつ実行するか、`$hdb->raw*` / `raw_select*` の呼び出し、pager への受け渡し |

model は **意味と args** を組み立て、**`$hdb` の取得は action**（[coding.md](./coding.md) §1.1 のシステム責務）が行う。
**Domain 側で `crow::get_hdb()` を呼ばない。** 実行に `$hdb` が要るなら**引数で受け取る**
（`build_list_queries($hdb_, ...)` のように、呼び手が渡す）。

#### SQL ファイルの置き場

- **`app/assets/query/_common_/`** … 複数 module で共有する断片
- **`app/assets/query/<module>/`** … module 固有の断片
- フラグメント名 **`@where_progress_status`** 等は、PHP 側の `$hdb->raw('where_progress_status', ...)` と **完全一致**させる。

#### allow-list

- filters の **許可キー**は主語 model の **`get_allowed_*_filter_keys()`**（または同等の static）が持つ。
- action が filters をそのまま SQL に渡さない。
- 表横断 util に allow-list を集約しない（[model.md](./model.md) §4 は衛生だけ）。

#### `raw` と `raw_noencode`

| API | 使う場面 |
| --- | --- |
| `$hdb->raw($name, ...$args)` | フラグメント内の **`"%s"` 付き**プレースホルダへ値を渡す（addslashes される） |
| `$hdb->raw_noencode($name, ...$parts)` | **WHERE 句の結合**、すでに組み立て済みの条件文字列、非引用文脈への埋め込み |

- 非引用文脈（`= %s` / `in (%s)` で引用符が無い `%s`）へ渡す値は **model が `(int)` 等で型を潰す**。
  表横断の skip / coerce は **[model.md](./model.md) §4 util** に委譲（各 model へ複製しない）。
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
- 取得後に PHP で行順を付け直す（`ORDER BY` をフラグメント／定型クエリ側で決める）。

