---
paths:
  - "**/crow3_*/app/viewparts/**"
  - "**/crow3_*/app/views/**"
  - "**/crow3_*/app/assets/css/**"
  - "**/crow3_*/app/assets/js/**"
---

# 🔀 crow / frontend — ビューパーツのデータフローと宣言的な書き方

> パーツの構造規約は [viewpart.md](./viewpart.md)。本書は**状態をどう持ち、どう流すか**を定める。
> 狙いは「読んで挙動が分かる」こと ＝ 手続きの順序を追わなくても、状態とテンプレートを見れば画面が決まる状態にすること。

---

## 0. 到達点の定義（crow でできること・できないこと）

crow のビューパーツは **React ではない**。仮想 DOM も再レンダも差分適用も存在せず、
条件レンダリング・リストレンダリング・イベントの宣言的ディレクティブも無い。
リアクティビティは props への細粒度バインドで実現されている。

**したがって「React のように書く」を目標にしない。** 目標は次の 2 つに絞る。

1. **状態が唯一の真実であり、画面はその導出物である**という関係を崩さない
2. **データは親から子へ、イベントは子から親へ**の単一方向に固定する

1 つめは crow の実装がすでに支えている。`:` によるプロパティバインドは親→子の一方向で、逆流路を持たない。
2 つめは **props でクロージャを渡し、子はそれを呼ぶだけ**という形で実現する（§5）。
**ルールの役目は、機構として空いている抜け道を塞ぐことにある。**

---

## 1. 状態が唯一の真実（DOM から状態を読まない）

**画面の現在値を DOM から読み取らない。** 状態は必ず props 側にあり、DOM はその写像とする。

```php
//	NG: DOM を状態源にしている
let name = self.jq('input_name').val();
if( name === "" ) { ... }

//	OK: props を状態源にする（bind_input で DOM → props が同期される）
if( self.prop('name') === "" ) { ... }
```

入力要素は `bind_input` / `bind_checked` で props と結ぶ。これは **DOM ⇄ 自分の props** の局所的な双方向であり、
フォーム入力に必要なので許可する。**親の props とは結ばない。**

画面を変えたい時は **DOM ではなく props を変更する**。

```php
//	NG: DOM を直接書き換える（次の再描画で失われ、状態と食い違う）
self.jq('label').text("完了");

//	OK: 状態を変える。テンプレートのバインドが画面を更新する
self.prop('status_label', "完了");
```

---

## 2. テンプレートで宣言できるものはテンプレートに書く

`<ready>` や `<method>` で HTML を組み立てない。**`innerHTML` への文字列代入は禁止**（詳細は [viewpart.md](./viewpart.md) §5）。

宣言できるのは次の 4 つ。これで表現できる範囲は必ずこれで書く。

| 記法 | 意味 |
| --- | --- |
| `{{ prop }}` | テキスト補間（HTML エスケープあり） |
| `{{{ prop }}}` | テキスト補間（エスケープなし）。**信頼できる値だけ** |
| `attr=":prop"` / `attr="::"` | 属性バインド（`::` は同名バインド） |
| `[[part arg=:prop]]` | 子パーツの埋め込み ＋ プロパティバインド |

### `{{ }}` は「その要素だけのテキスト」に使う

補間の抽出は「タグの中身がテキストである」形を前提にしている。
**別のタグを挟むと、意図しない範囲まで巻き込んで壊れる。**

```php
<!--  NG: 内側に別タグがある  -->
<p>こんにちは {{ name }} <b>さん</b></p>

<!--  OK: 補間する値を専用要素で包む  -->
<p>こんにちは <span>{{ name }}</span> <b>さん</b></p>
```

**補間する値には必ず専用の要素を与える**、と覚える。

---

## 3. 表示の切り替えは class バインドで表す

crow に条件レンダリングのディレクティブは無い。表示・非表示や状態差分は
**class をバインドし、見た目は `<style>` 側で決める**。

「状態 → class → 見た目」の一本道にすると、状態と CSS を見るだけで画面が決まり、
表示ロジックが `<ready>` に散らばらない。

```php
<props>
{
	is_empty	: true,
	list_class	: "list is_empty"
}
</props>

<template>
 <div class=":list_class">
 </div>
</template>

<watch>
{
	//	真偽値の状態から、表示用の class 名を導出する
	is_empty(old_, new_)
	{
		self.prop('list_class', new_ === true ? "list is_empty" : "list");
	}
}
</watch>

<style>
.list
{
	&.is_empty { display : none; }
}
</style>
```

### 例外：挙動を持つ真偽属性は直接バインドする

`checked` / `required` / `disabled` / `readonly` の 4 つは、**class では代替できない挙動**を持つ。
これらだけは真偽値の prop を直接バインドしてよい。

```php
<template>
 <input type="checkbox" checked="::">
 <button disabled=":is_saving">保存</button>
</template>
```

**この 4 つ以外の属性を表示制御に使わない。** 見た目の差はすべて class に寄せる。

---

## 4. リストは「状態 → 単一の描画メソッド」に集約する

crow にリストレンダリングのディレクティブは無いので描画は手続きになるが、
**呼ばれる場所を 1 箇所に固定すれば宣言的な性質は保てる。**

原則：**イベントハンドラから直接 DOM に子を積まない。イベントは状態を変えるだけ。**
状態の変化を `<watch>` が拾い、描画メソッドを 1 つだけ呼ぶ。

```php
<props>
{
	rows : []
}
</props>

<template>
 <div class="list">
  <button ref="btn_reload">再読込</button>
  <div ref="list_body"></div>
 </div>
</template>

<ready>
{
	//	初回描画は ready で起こす。
	//	生成時に args_ で rows を受け取った場合は watch が発火しないため、
	//	これが無いと永久に描画されない
	self.render_rows();

	//	イベントは状態を変えるだけ。DOM には触らない
	self.jq('btn_reload').on('click', () => self.load_rows());
}
</ready>

<watch>
{
	//	状態が変わったら描画メソッドを呼ぶだけ
	rows(old_, new_)
	{
		self.render_rows();
	}
}
</watch>

<method>
{
	//	描画は必ずこの 1 メソッドに閉じる
	render_rows()
	{
		//	自分が作った子だけを消してから作り直す
		self.remove_pref("row");

		//	全行に同じ pref を付けることで、次回の remove_pref で一括破棄できる
		self.create_children_and_append("row", self.prop('rows'), "list_body", "row");
	}
}
</method>
```

- **初回描画は `<ready>` で起こす。** `<watch>` は変更時にしか走らないので、これが無いと
  「生成時に `args_` で渡されたデータが描画されない」という事故になる
- 子の破棄は `remove_pref()` を使い、**リストの全行に同じ pref** を付ける（[viewpart.md](./viewpart.md) §2）
- 配列の中身を書き換えた場合は参照が変わらず watch が発火しないので、`self.update('rows')` で明示的に発火させる
- 差分更新（key による再利用）は crow に無い。**件数が多く全消し全作りが重い場合だけ**、
  局所的な差分更新を `<method>` 内に閉じて書く（呼び出し口は 1 箇所のまま保つ）

---

## 5. 単一方向データフロー（親子の契約）

```
        props（値）
   親 ───────────────▶ 子
   親 ───────────────▶ 子   props（クロージャ）
   親 ◀─────────────── 子   子はそのクロージャを呼ぶだけ
```

**下りも上りも経路は props 1 本**。値もイベントも同じ道を通るので、
親のテンプレートと生成コードだけを見れば、その子との契約が全部読める。

### 下り：親 → 子は props で渡す

```php
<!--  ":" は継続バインド（親の変更が子へ流れ続ける）。属性名が子の prop 名になる  -->
[[user_card name=:user_name]]

<!--  "@" は初回のみ。属性名と prop 名を必ず一致させる  -->
[[user_card user_name=@user_name]]

<!--  リテラルは直接渡す（"true" / "false" は真偽値に変換される）  -->
[[user_card editable="true"]]
```

> **`@` は属性名を見ない。** 参照した prop 名がそのまま子の prop 名になるため、
> `[[user_card name=@user_name]]` は子の `name` を**セットせず**、`user_name` というキーを注入する。
> **名前を一致させないと値が届かない。** 名前を変えて渡したい場合は `:` を使う。

動的に生成する子には `create_child*` の `args_` で渡す。後から親が値を変えたい場合のみ `bind_prop()` を使う。

> **渡すのは参照である。** `:` バインドも `args_` もオブジェクト・配列を**コピーせずそのまま**渡す。
> 子が中身を破壊的に変更すると**親のデータがそのまま書き換わり、しかも watch も発火しない**（後述の禁止事項）。

### 上り：子 → 親は、親から渡されたクロージャを呼ぶ

**`postup` / `postdown` は既定では使わない**（例外は後述）。
処理の実体は親が持ち、**子にはそれを呼ぶための関数を prop として渡す**。
子は「自分に何が起きたか」を伝えるだけで、親がそれで何をするかは知らない。

**親：処理の実体を `<method>` に置く**

```php
<method>
{
	//	処理の実体は親が持つ
	on_row_selected(id_)
	{
		self.prop('selected_id', id_);
	}
}
</method>
```

**親：動的に作る子には、生成時の `args_` で渡す**

```php
<ready>
{
	self.create_child_and_append
	(
		"row",
		{
			id			: 1,
			on_select	: (id_) => self.on_row_selected(id_)
		},
		"list_body"
	);
}
</ready>
```

**親：テンプレートに埋め込む子には、prop 経由で渡す**

```php
<props>
{
	//	クロージャは <props> の中で定義しない。null で枠だけ宣言する
	on_select : null
}
</props>

<template>
 <div>
  [[row on_select=:on_select]]
 </div>
</template>

<init>
{
	//	self が使えるのは <init> 以降。ここで実体を入れる
	self.prop('on_select', (id_) => self.on_row_selected(id_));
}
</init>
```

> テンプレート埋め込みの子は**親の `<init>` より先に生成される**ため、生成の瞬間は `null` が入っている。
> `:` の継続バインドによって `<init>` での代入が子へ流れる。ここから 2 つの制約が出る。
>
> - **子は `<init>` の中でクロージャを呼んではいけない**（まだ届いていない）
> - **親は `<init>` で `watch_stop()` してはいけない**。停止中は `:` バインドの伝播も止まるため、
>   クロージャが子へ永久に届かなくなる（[viewpart.md](./viewpart.md) §3）

**子：受け取って呼ぶだけ**

```php
<props>
{
	id			: 0,
	on_select	: null
}
</props>

<ready>
{
	self.jq('btn').on('click', () =>
	{
		//	渡されていない場合に落ちないよう存在を確認する
		if( self.prop('on_select') === null ) return;
		self.prop('on_select')(self.prop('id'));
	});
}
</ready>
```

### クロージャ props の規約

- **名前は `on_` ＋ 起きた事実。** `on_select` / `on_close_requested` のように**子で何が起きたか**で名付ける。
  `on_delete_user` のように**親が何をするか**で名付けない（子が親の都合を知ってしまう）
- **`<props>` の中でクロージャを定義しない。** props セクションには `self` が存在しないため、
  そこで書いた関数は自分のパーツに触れない。`null` で枠だけ宣言し、`<init>` で実体を入れる
- **子は呼ぶだけ。戻り値に依存しない。** 親がどう処理したかを子が知る必要はない
- **渡す引数は最小限の値にする。** DOM 要素・イベントオブジェクト・自分自身のインスタンスを渡さない
- **未設定を許容する。** 呼ぶ前に `null` を確認し、無ければ何もしない
- **バケツリレーが 3 階層を超えたら設計を疑う。** 中間パーツが素通しするだけのクロージャが積み上がってきたら、
  その状態は共通の祖先ではなく `dbc` へ寄せる

### 例外：横断的な通知だけ postup / `<recv>` を使う

**画面のどこからでも上げる必要があり、受け手がルートに 1 つしかない**通知に限って `postup` を使う。
典型はエラーダイアログとメッセージ表示で、中間の全パーツにクロージャを通すのが不合理なケースである。

**発信してよいのは feature 以上（feature / scene / root）だけ。**
`ui` / `parts` は `postup` 禁止（クロージャ props で親へ返す。
[viewpart-components.md](./viewpart-components.md) §3）。

```php
//	feature 以上: 横断的な通知だけは postup を使う
self.postup('error', ["E001", "保存に失敗しました"]);
```

```php
//	ルート: <recv> で受ける
<recv>
{
	//	横断: 全パーツから上がるエラー表示。クロージャを全階層に通さないためここで受ける
	error(sender_, params_)
	{
		ui.dialog.popup_error("error", params_[0], params_[1]);

		//	処理しきったので伝播を止める
		return true;
	}
}
</recv>
```

受信ハンドラの第 1 引数は**発信元インスタンス固定**、第 2 引数が `postup` に渡したパラメータ。
処理を完結させたら `true` を返して伝播を止める（返さないと祖先まで上り続ける）。

**使うときは `<recv>` 側に「なぜ横断なのか」をコメントで残す。**
理由が書けないなら、それはクロージャで渡すべきイベントである。

### 禁止事項（機構としては可能だが、単一方向を壊すもの）

- **子から親の状態を書き換えない。** `self.parent().prop(...)` / `self.parent().jq(...)` を書かない。
  `parent()` は public なので機構上は可能だが、これをやると変更元が追えなくなる。
  子は**渡されたクロージャを呼ぶだけ**にする
- **子は親から受け取った prop を書き換えない。** 再代入しても親には伝わらず、親の変更で上書きされる。
  さらに**オブジェクト・配列は参照が共有されている**ので、中身を書き換えると
  **親のデータが静かに汚染され、watch も発火しない**（最も追いにくい壊れ方になる）。
  加工したい場合は**別名の prop を用意して `<watch>` で導出する**
- **兄弟パーツを直接参照しない。** `viewpart_find_by_name()` / `viewpart_find_all_by_name()` で兄弟を掴んで
  操作しない。共通の親でクロージャを受け、親が `pref()` 経由でもう一方の子へ反映する
- **孫を直接掴まない。** `self.pref('a').pref('b')` のような連鎖参照を書かない。1 階層ずつ責務を委ねる

### 広域で共有する状態は dbc に置く

祖先が遠い・画面をまたぐ状態は、共通祖先へ持ち上げずに `dbc`（データキャッシュ）を使う。

```php
//	dbc の値をパーツの prop にバインドする
dbc.bind("user.list", user_id, self, "user_row");
```

- **`dbc.bind()` は dbc → prop の一方向である**（prop を変えても dbc は変わらない）。
  更新は必ず `dbc.set()` / `dbc.set_list()` / `dbc.merge_list()` 経由で行い、prop を直接書き換えない
- **バインドはパーツ破棄時に自動で解除される。** 明示的な `dbc.unbind(self, "prop名")` は、
  画面に残したまま早めに外したい場合だけ書く
- **`set_list()` は「新しいリストに含まれないキー」を消さない。** 全件リフレッシュで行が消えたとき、
  バインド済みの prop は**古い値のまま残る**。消えた行を反映する必要があるなら、
  `remove` 系を使うか、描画側で dbc のリストを引き直す

### 通信と応答の適用（ajax / 契約）

誰が通信してよいかは [viewpart-components.md](./viewpart-components.md) §9（feature まで）。
ここでは **出し方と応答の載せ方**を定める。

#### 発行前は fail-closed

必要条件（担当者・選択中行・契約必須キーなど）が揃うまで **ajax を出さない**。
揃わないときは空表示やスケルトンに留め、**緩い条件で取りにいかない**
（サーバの母集団強制や権限が黙って消える経路を作らない）。

リクエスト組み立ては feature 内の **単一経路**（例: `build_*_request_params`）に寄せ、
タブ・ページングなど全 UI 操作がそこを通るようにする。

#### 成功時の載せ方

| データの性質 | 載せ先 |
| --- | --- |
| 画面内で複数パーツが共有する一覧・行 | `dbc.set` / `dbc.set_list` / `dbc.merge_list`。子は `dbc.bind` |
| その feature だけの局所状態 | 自パーツの props |

- 成功コールバックで **DOM を直接組み立てて状態源にしない**（§1・§4）。
  載せてから、既存の単一描画メソッド／子生成へ進む。
- 契約の response 形に沿って載せる（キー名は機能の契約が正。
  `rows` / `rows_with_id` / `pager` は**よくある例**であり必須キー一覧ではない）。

#### 陳腐化した応答を適用しない

`ajax.post` 等は abort ハンドルを返さず、配送済みの応答も止められないことがある。
連打・タブ切替では **リクエスト世代（seq）** を持ち、

- 発行ごとに seq を進める
- 応答適用前に「この応答は最新世代か」を判定する
- **最新以外は一覧・状態へ書き込まない**（fail-closed）

陳腐化応答の失敗で、最新世代の一覧を空表示へ潰さない。

#### 失敗時

- サーバが返したメッセージを toast／画面エラーへ **提示**する（言い換え・握りつぶしは §9）。
- 一覧を空にするか直前表示を残すかは機能仕様に従う。どちらかを明示し、曖昧にしない。
- スケルトンを出しっぱなしにしない（失敗時も畳む）。

```php
//  概形（名前は機能に合わせる）
let request_seq = self.next_list_request_seq(self.prop('list_request_seq'));
self.prop('list_request_seq', request_seq);

ajax_or_helper
(
	params,
	(data_) =>
	{
		if( self.should_apply_list_response(request_seq, self.prop('list_request_seq')) === false )
		{
			return;
		}
		//	data_ のキーは契約に従う（以下は例）
		dbc.set_list('example.list', data_.rows_with_id);
		self.prop('pager', data_.pager);
		self.render_list();
	},
	(code_, msg_) =>
	{
		if( self.should_apply_list_response(request_seq, self.prop('list_request_seq')) === false )
		{
			return;
		}
		dbc.set_list('example.list', null);
		self.render_empty();
		//	トースト API 名はプロジェクト側。サーバ文言 msg_ を提示する
		show_error(msg_);
	}
);
```

---

## 6. 手続きが許されるのは「イベント配線」だけ

crow には宣言的なイベントディレクティブが無いので、`<ready>` での配線は避けられない。
**ここだけを手続きの入口と認め、他へ広げない。**

```php
<ready>
{
	//	OK: 配線して、自分の状態を変えるだけ
	self.jq('btn_save').on('click', () => self.prop('saving', true));

	//	OK: 親から渡されたクロージャを呼ぶだけ
	self.jq('btn_close').on('click', () =>
	{
		if( self.prop('on_close_requested') === null ) return;
		self.prop('on_close_requested')();
	});
}
</ready>
```

`<ready>` に画面組み立て・分岐・ループが増えてきたら、それは状態設計の失敗の兆候である。
**「その分岐は prop にできないか」を先に疑う。**

---

## ✅ データフローの確認

- [ ] 画面の値を DOM から読んでいないか（`.val()` / `.text()` を状態源にしていないか）
- [ ] `innerHTML` への文字列代入や HTML の組み立てをしていないか
- [ ] `{{ }}` を専用要素で包んでいるか（内側に別タグが無いか）
- [ ] 表示制御を class バインドで書いているか（真偽属性 4 つ以外を切り替えていないか）
- [ ] リストの初回描画が `<ready>` にあるか
- [ ] リストの描画メソッドが 1 つで、イベントハンドラから直接 DOM に積んでいないか
- [ ] 子が `self.parent()` で親を書き換えていないか
- [ ] 子が親から受け取った prop を書き換えていないか（オブジェクトの中身を含む）
- [ ] 兄弟・孫を直接参照していないか
- [ ] `@` バインドで属性名と prop 名が一致しているか（不一致だと値が届かない）
- [ ] 子 → 親の通知がクロージャ props になっているか（`postup` を既定で使っていないか）
- [ ] クロージャ props が `on_` ＋ 起きた事実で命名されているか
- [ ] クロージャを `<props>` の中で定義していないか（`null` 宣言 ＋ `<init>` で代入になっているか）
- [ ] 子がクロージャを呼ぶ前に `null` を確認しているか／`<init>` で呼んでいないか
- [ ] `postup` を使った箇所に「なぜ横断なのか」のコメントがあり、`true` で伝播を止めているか
- [ ] `postup` の発信が feature 以上か（ui / parts から上げていないか）
- [ ] `<ready>` がイベント配線だけに収まっているか
- [ ] 通信前ゲートが fail-closed か（必要条件未充足で ajax していないか）
- [ ] 共有一覧の成功結果を `dbc`（または局所 props）経由で載せているか
- [ ] リクエスト世代で陳腐化応答を捨てているか（最新以外を一覧へ書いていないか）
- [ ] 失敗時にサーバ文言を提示し、スケルトンを畳んでいるか
