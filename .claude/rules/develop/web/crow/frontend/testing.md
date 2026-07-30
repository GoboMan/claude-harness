---
paths:
  - "**/crow3_*/**"
---

# 🧪 crow / frontend — テスト設計（Node 組み込みランナー）

> **共通則は [common/testing.md](../common/testing.md)**（1テスト=1振る舞い・失敗系を含める・モックは境界だけ・
> 決定性・コマンド一発・スコープ実行・命名・カバレッジの扱い）。本書は**それに従ったうえで**、
> frontend 固有の「何を・どこに置いて・どう回すか」だけを扱う。共通側の再掲はしない。
>
> コードは [common/coding.md](../common/coding.md) のスタイル（Allman・snake_case・strict 比較・`!` 禁止）に従う。
> パーツの構造規約は [viewpart.md](./viewpart.md)、状態と親子の流れは [viewpart-dataflow.md](./viewpart-dataflow.md)。

---

## 1. crow の frontend は 2 媒体ある（どちらも本書の対象）

| 媒体 | 実体 |
| --- | --- |
| クラシック | `app/views/<role>/<module>/<action>.php` ＋ `app/assets/js/<role>/<role>_<module>_<action>.js`（`init(args_)` エントリ・jQuery・`ajax` / `ui`） |
| viewpart | `app/viewparts/**` の独自 DSL |

**書き方は違うが、テストの扱いは同じ**である。どちらも「DOM 配線」と「検証したいロジック」が同居しているので、
後者を外へ出してテストする（§3）。媒体ごとに方針を分けない。

---

## 2. テストはパーツファイル・配線ファイルの中に書かない

ビューパーツにも `assets/js` の配線ファイルにも、テストを同居させない。理由は 2 つある。

1. **producer と oracle が同一ファイルになる。** develop は「作る側」と「判定する側」を別コンテキストに分ける。
   テストが実装と同じファイルにあると、実装体が自分を判定するテストごと書き換えられてしまい、分離が成立しない
2. **crow が持つパーツ内テスト機構は、コマンド実行と終了コードによる判定に対応していない。**
   結果はブラウザのコンソールに出るだけで、共通則の「実行はコマンド一発」を満たせない

---

## 3. 検証するロジックを外へ切り出す

ブラウザ・DOM・遅延ロードに依存したままでは単体テストできない。
**検証したいロジックを「素の JS モジュール」として切り出し、パーツ／配線ファイルはそれを呼ぶだけにする。**

### 切り出す側（テスト対象）の条件

- **純粋関数にする。** 入力は引数、出力は戻り値。同じ入力なら常に同じ出力
- **DOM を触らない。** `document` / jQuery / `self.ref()` を参照しない
- **viewpart の API に依存しない。** `self.prop()` / `create_child()` を呼ばない
- **crow のグローバルに依存しない。** `g` / `dbc` / `ajax` / `ui` / `window` / 実時刻 / 乱数を直接読まない

### 呼ぶ側（パーツ／配線ファイル）の責務

残すのは**配線だけ**にする。「状態を読む → モジュールを呼ぶ → 状態へ書く」で終わる形が理想。

```php
<watch>
{
	rows(old_, new_)
	{
		self.prop('display_rows', build_display_rows(self.prop('rows'), self.prop('filter')));
	}
}
</watch>
```

分岐や計算が配線側に溜まってきたら、それは切り出し漏れである。**「この分岐は純粋関数にできないか」を先に疑う。**

---

## 4. 何をテストし、何をテストしないか

| 対象 | 扱い |
| --- | --- |
| **API クライアントの契約適合**（request 組み立て・response 解釈） | **必須。** frontend の機械オラクルの中核（§5） |
| 切り出した純粋ロジック（整形・判定・変換・入力検証） | **切り出せた分はテストする** |
| 状態遷移のうち、純粋関数に落とせる部分 | テストする |
| テンプレートの見た目・CSS | テストしない。人間の一瞥（develop の 🙋 ゲート）で確認する |
| viewpart のライフサイクル・遅延ロード・DOM マウント | テストしない。framework の責務であり、ここを検証しても壊れやすいだけ |
| ブラウザ駆動の E2E | **develop の工程には無い。** 必要になったプロジェクトが独自に足す（本書は扱わない） |

---

## 5. API クライアントの契約適合が最優先（必須）

develop は結合のための専任工程を置かず、**「FE と BE が双方とも契約を守っていること」を結合の担保にしている**。
つまり **frontend 側でこれを検証しないと、結合欠陥を捕まえる機械オラクルが存在しなくなる。**
切り出しの中でも、ここだけは必ずテストする。

**送信そのものはテストしない。** API クライアントを次の 2 つの純粋関数に割り、送信（`ajax.post`）は配線側に残す。
こうすればネットワークをモックせずに契約適合を検証できる。

```javascript
//	契約の request 形に組み立てる
function make_create_user_params( form_ )
{
	return {
		login_id : form_.login_id,
		name     : form_.name,
	};
}

//	契約の response 形を画面が使う形へ解釈する
function parse_user_list( res_ )
{
	//	...
}
```

```javascript
//	配線側（パーツ or assets/js）には送信だけが残る
ajax.post(g.actions.ajax_create, make_create_user_params(form), res_ =>
{
	self.prop('rows', parse_user_list(res_));
});
```

検証は `docs/specs/F-xxx-<slug>/api-contract.yaml` の request / response を正として行う。
**契約に無いキーを送らない・契約にあるキーを落とさない**が主眼で、異常系（エラー response の解釈）も含める。

---

## 6. 住所・形式・実行コマンド（既定。逸脱はプロジェクトの `CLAUDE.md` へ）

crow の frontend にはテストランナーの標準が無いので、**本書が既定を定める**。
プロジェクトの事情で外すのは構わないが、**外すなら取り込み先の `CLAUDE.md` に記録する**（記録が無ければ下表が正）。

| 項目 | 既定 |
| --- | --- |
| ランナー | **Node 組み込み `node --test`**（Node 18+）。**依存パッケージ・`package.json` は不要** |
| 切り出しモジュールの住所 | `app/assets/js/_common_/logic/`（全ロール）／`app/assets/js/<role>/_common_/logic/`（ロール限定） |
| テストの住所 | `tests/js/` に対象構成をミラー |
| テストのファイル名 | `<対象>_test.js` |
| 全件実行 | `node --test "tests/js/**/*_test.js"` |
| スコープ実行 | `node --test --test-name-pattern "F-001" "tests/js/**/*_test.js"` |
| 機能ID タグ | `describe("F-001 <振る舞いの説明>", …)` で機能ID を先頭に置く |

**なぜ Node 組み込みか。** crow プロジェクトは PHP のみの構成で `node_modules` を持たない。
依存ゼロ・設定ファイル無しで動くランナーなら、**導入がテスト着手のブロッカーにならない**。

### 住所の根拠（crow が自動で読む場所に置く）

crow は `app/assets/js/_common_` と `app/assets/js/<role>/_common_` 配下を**再帰検索して全 js を自動で読み込む**。
したがって `logic/` サブフォルダに置けば、**include を書き足さずにブラウザから見える**。

### モジュール形式（ブラウザと Node の両対応）

crow はアセットを**素の `<script>`** として読む。**ESM（`export`）は使えない**（ブラウザ側が壊れる）。
末尾に次の 1 行を置く。ブラウザでは `module` が未定義なので素通りし、Node からは `require` できる。

```javascript
//	Node（テストランナー）からだけ見える出口
if( typeof module !== "undefined" ) module.exports = { build_display_rows, make_create_user_params };
```

### 実行時の注意

- **ディレクトリ引数は使えない。** `node --test tests/js` はモジュール解決に行って失敗する。**glob 形で渡す**
- `*_test.js` は Node の既定探索パターンに含まれるので、**サフィックス設定は不要**
  （backend の PHPUnit と違い、設定漏れで 0 件になる事故は起きない）
- 失敗時の終了コードは `1`。共通則の「終了コードで赤緑が判定できる」を満たす

### テストの書き方

```javascript
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { build_display_rows } = require("../../app/assets/js/_common_/logic/build_rows.js");

describe("F-001 表示行の組み立て", () =>
{
	it("test_returns_empty_when_no_row_matches_filter", () =>
	{
		const result = build_display_rows([{ name : "abc" }], "zzz");
		assert.deepEqual(result, []);
	});
});
```

- 値の一致は **`assert.deepEqual`**（`node:assert/strict` を使うので厳密比較になる）
- 真偽・null は `assert.equal(x, false)` / `assert.equal(x, null)` のように**明示**する
  （common/coding.md の「`!` 禁止」をテストでも守り、`assert.ok( ! x )` を書かない）

---

## ✅ テスト着手前チェックリスト

- [ ] 対象の GWT 受け入れ条件（orchestrator が渡す）を先に確認したか
- [ ] **API クライアントの契約適合テストがあるか**（結合の担保はここしかない）
- [ ] 検証対象が viewpart／配線ファイルの外の純粋関数として切り出されているか
- [ ] その関数が DOM・viewpart API・crow のグローバルに依存していないか
- [ ] 切り出しモジュールに `module.exports` の末尾ガードを書いたか（ESM を使っていないか）
- [ ] `describe` の先頭に機能ID（`F-xxx`）を置いたか
- [ ] パーツファイル・配線ファイルの中にテストを書いていないか
