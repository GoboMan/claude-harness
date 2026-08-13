---
paths:
  - "**/crow3_*/app/classes/**"
  - "**/crow3_*/app/assets/query/**"
  - "**/crow3_*/**/module_*.php"
---

# ⚙️ crow / backend — 責務の境界（サーバ側の核）

> **読むタイミング: crow のサーバ側 PHP（action / model / service / presenter / util / SQL）を書く・直すとき、必ず最初に。**
> 本葉は**どの住所を触るときも効く不変則**だけを持つ。住所ごとの書き方は §1.2 の索引から必要な葉だけを開く。
>
> **共通スタイルは [common/coding.md](../common/coding.md)**（インデント表・Allman・snake_case・
> `i_` プレフィックス・`===`／`!` 禁止・コメント `//<TAB>`・80 桁・PHP 閉じタグ・ファイル終端改行）。
> 本書は**それに従ったうえで**、サーバ側にだけ効く差分を定める。
> 共通側の再掲はしない。記法は common に従い、無いルールを埋めるために写してこないこと。
>
> 以下で定めるのは記法ではなく **「サーバ側のロジックをどこに書くか」** である。
> 白紙から実装しても、この区分に自然と収まるように書く。

---

## 1. 全体概要

厳密な 4 層を crow 上で再現しない。やることは **action / model / presenter / 非モデル util の置き場を徹底する** こと。

| よく言う層 | crow での実体 | 一言 |
| --- | --- | --- |
| Presentation（画面） | view / viewpart / フロント JS | 画面固有の見せ方 |
| Presentation（共有表示値） | `model_*_presenter` / `common_presenter` | 契約に載せる表示導出 |
| Application（ユースケース） | `module_*` の `action_*` | 入力を開き、頼み、出力を閉じる |
| Domain（1 表が主語） | `model_<table>` の**手書き**メソッド・フック | その表の意味・判定・定型取得 |
| Domain（複数表にまたがる） | `model_<table>_<table>_service` | 単一の表を主語にできない業務判定・導出（[model.md](./model.md) §3.12） |
| Infrastructure | crow ORM／生成メンバ／`raw` SQL／外部 API | model 継承側に**同居してよい** |
| （表に属さない共有・非表示） | `app/classes/_common_/` の非モデル util | フィルタ衛生など |

**核心（必須）**

1. **その表の意味・判定・定型クエリ（一覧の主語になる取得を含む）→ `model_*`**
   **複数表にまたがり主語を決められない業務判定・導出 → `model_<table>_<table>_service`（[model.md](./model.md) §3.12）**
2. **リクエストの受け・結果を見てどう返すか・複数モデルの更新順／Tx → `action_*`**
   （**action = 入力を開き、model / presenter に頼み、出力を閉じる。** 詳細は [action.md](./action.md) §2.1）
3. **どの表の Domain とも言えない共有の純粋処理（非表示）→ 非モデル util（[model.md](./model.md) §4）**
4. **契約レスポンスの束ね → action。共有の表示値導出 → presenter（[model.md](./model.md) §3.11）。画面固有の見せ方・画面上の並び → frontend（feature / scene）**
   （model に表示用・画面専用を入れない。FE 側の正本は [frontend/viewpart-components.md](../frontend/viewpart-components.md) §9）
5. **一覧・候補の行順（契約上の取得順）→ SQL の `ORDER BY`（定型クエリ／フラグメント）。取得後の PHP 並び替えはしない。**
   FE が並べ替えてよいのは、契約上の行順を変えない見せ方だけ（[model.md](./model.md) §3.4）

補足:

- Domain の独立ディレクトリは作らない。
- model が Domain＋永続化を同居するのは妥協ではなく、**crow における Domain の正規の住所**。
- Domain と Infrastructure を model 外で分離しようとしない。
- **クエリ組み立てのための巨大な横断クラスは新設しない。**
  `common_presenter` は**表示専用の薄い共有**に限る（[model.md](./model.md) §3.11）。置き場に迷ったら [model.md](./model.md) の §3 / §3.11 / §3.12 / §4 の判定表で割り振る。
  ここで禁じているのは**寄せ集めのクエリ工場・何でも入る横断ゴミ箱**であって、
  業務概念名で 1 関心に絞った**ドメインサービス（[model.md](./model.md) §3.12）は禁止対象ではない**。

流れのイメージ:

```
action:     入力を開く → model / service / presenter に頼む → 契約どおりに出力を閉じる
model:      主語テーブルの意味・判定・定型クエリ・保存フック
service:    複数表にまたがり主語を決められない業務判定・導出（Domain）
presenter:  契約に載せる共有表示値（表単位 / 表非依存の共通形）
util:       表に属さない共有の純粋処理（非表示）だけ
FE:         契約 payload を受け、画面固有の見せ方・並びを組み立てる
```

### 1.1 システム責務と業務責務の境界（backend 全葉で最優先の不変則）

**backend のどの葉・どの節よりもこの節が優先する。** 以下と矛盾する読み方をしたら、本節が勝つ。

| | システム責務 | 業務（Domain）責務 |
| --- | --- | --- |
| **住所** | `action_*`（および `module_*` の `preload()`） | `model_<table>` / `model_<table>_<table>_service` |
| **持ちもの** | 入力・出力・**終了**・Tx 境界・DB ハンドル・認証・セッション・致命ログ | 表／業務概念の意味・判定・導出・整合・業務メッセージ文言 |
| **知ってよいこと** | 「誰にどう頼み、結果を見てどう返すか」 | **自分の業務だけ。** リクエストが何か、どう返るか、いつ終わるかを知らない |

> **本節で「Domain 側」と言うとき**は、**action から呼ばれる側のファイルすべて**を指す——
> `model_*` / `model_*_service` / `model_*_presenter` / 非モデル util（住所と書き方は [model.md](./model.md) §3・§4）。
> presenter と util は層としては Domain ではないが、**システム責務を持たない点は同じ**なので、
> 以下の禁止は 4 つとも同じ強さで効く。

**システム責務のシンボル（Domain 側のファイルに 1 つも書かない）**

| 種別 | シンボル |
| --- | --- |
| 入出力 | `crow_request::*` / `crow_response::*` |
| **プログラムの終了** | `app::exit_ok()` / `app::exit_ng()` / `app::exit_*()` / `exit` / `die` / `header()` / redirect |
| トランザクション境界 | `$hdb->begin()` / `commit()` / `rollback()` |
| DB ハンドルの取得 | `crow::get_hdb()`（必要なら**引数で受け取る**。[query.md](./query.md) §3.9） |
| 認証・進行制御 | `crow_auth::*` |
| セッション・Cookie・スーパーグローバル | `$_GET` / `$_POST` / `$_SESSION` 等 |
| 致命ログ | `crow_log::error()`（crow の設定次第で**リクエストを exit させる**＝終了と同義。[action.md](./action.md) §2.10） |

**絶対則（2 本）**

> **1. Domain はプログラムを終わらせない。**
> `model_*` / `model_*_service` / `model_*_presenter` / util の中に、リクエストを終了させうる呼び出しを **1 つも書かない**。
> 異常は **戻り値（`false` / `''` / エラー配列）** か **`push_validation_error()` / `get_last_error()`** で呼び手に返し、
> **止めるか進めるかは action が決める**（[action.md](./action.md) §2.3）。
>
> **2. Domain はシステムの勝手を知らない。**
> 上表のシンボルが Domain 側に現れたら、それは「例外的に許される最適化」ではなく**設計の誤り**である。

**なぜ絶対か**（例外を作ると全部壊れる）

1. Domain が exit すると、**単体テストがプロセスごと落ちて書けない**（[backend/testing.md](./testing.md) の Red 対象は手書き Domain）。
2. 同じ判定を**別経路（別 action・バッチ・CLI）から再利用できない**。
3. **Tx の途中で終了して中間状態が残る**（rollback は action にしか書けない。[action.md](./action.md) §2.8）。

**Domain から出してよい唯一の記録は `crow_log::warning()`**（終了しない）。[action.md](./action.md) §2.10 に従う。

自己点検の grep は §6。

---

### 1.2 葉の索引（書く住所 → 開く葉）

backend 規約は**住所ごとに葉が分かれている**。本葉（境界の核）は常に読み、**そのうえで自分が書く住所の葉だけ**を開く。

| 書く／直す住所 | 開く葉 | 中身 |
| --- | --- | --- |
| `module_*.php` の `action_*`・`preload()` | [action.md](./action.md) | §2. ユースケースの骨格・リクエスト／レスポンス・Tx・認証ゲート・ログ |
| `app/classes/_common_/` の PHP<br/>（`model_*` / `model_*_*_service` / `model_*_presenter` / 非モデル util） | [model.md](./model.md) | §3・§4. Domain の住所・拡張フック・presenter・ドメインサービス・util |
| `app/assets/query/**` の `.sql`（＋それを組み立てる model のメソッド） | [query.md](./query.md) | §3.9. raw フラグメント・allow-list・ページャ付き一覧 |
| `db_design.txt` | [db.md](./db.md) | DB 設計の書式と住所 |
| テストコード | [testing.md](./testing.md) | PHPUnit・Red の対象／非対象 |

- **1 スライスで action と model の両方を書くなら、両方の葉を開く。** 触らない住所の葉は開かない。
- **節番号は backend 規約全体の通し番号**である（本葉 §1 → `action.md` §2 → `model.md` §3・§4／`query.md` §3.9 → 本葉 §5・§6・§7）。
  分割後も番号を振り直さない——他葉・他規約からの参照を切らないため。
- 迷ったら本葉 §1 の判定表・§1.1 の境界に戻る。**葉を開かずに勘で書かない。**

---

## 5. 既存コードを触るとき

- `action_*` に主語が一意な判定・定型クエリがベタ書きされていたら、
  **その機能の実装スコープ内だけ** 主語 model へ移す。
- `action_*` に**複数表にまたがる業務判定**がベタ書きされていたら、
  **その機能の実装スコープ内だけ** [model.md](./model.md) §3.12 の service へ移す（新設してよい）。
- Domain（model / service / presenter / util）に `exit_*` / Tx / `crow_request` / `crow::get_hdb()` が
  混ざっていたら、**触る機能のスコープ内だけ** §1.1 の形（Domain は値を返し、action が止める）に直す。
  **これは「既存に合わせる」ことを許さない**——新しく書くコードでこの形を踏襲しない。
- model や module に表示用整形が溜まっていたら、
  **触る機能のスコープ内だけ** [model.md](./model.md) §3.11 の判定で presenter へ移す。
- 横断クラスに定型取得や行整形が溜まっているのを見つけたら、
  **触る機能のスコープ内だけ** [model.md](./model.md) の §3 / §3.11 / §4 の判定表で割り振る（一括解体はしない）。
- **一括リライトはしない。**
- 未拡張テーブルにドメインが載るなら、そのスコープで
  `app/classes/_common_/model_<table>.php` を生やす。

---

## 6. 責務の自己点検（サーバ側を書いたら、返す前に必ず）

**§1.1 は目視だけに頼らない。** 書き終えたら次を実行する。

```bash
#	Domain 側（model / service / presenter / util）にシステム責務が漏れていないか
#	→ ヒット 0 が正
grep -rnE "crow_request|crow_response|app::exit_|crow_auth::|crow::get_hdb|crow_log::error|->begin\(|->commit\(|->rollback\(|\bdie\b|\bexit\b|\bheader\(|\\\$_(GET|POST|SESSION|COOKIE)" \
	app/classes/_common_/
```

**ヒットしたら §1.1 に照らして判断する。**
自分が今回書いた行なら**直してから返す**。既存行なら §5（触る機能のスコープ内だけ直す）に従い、
スコープ外で直さないものは**報告に残す**（黙って見送らない）。
コメント・文字列リテラルへの偶発一致は、その旨を確認したうえで見送ってよい——
**ただし「たぶんコメントだろう」で済ませず、必ず該当行を開いて確かめる。**

続けて、grep で取れない分を読んで確かめる。

- [ ] `action_*` を上から読んで、**入力 → 委譲 → 出力**の 3 段だけになっているか（[action.md](./action.md) §2.1）
- [ ] `action_*` の中に、**業務の条件式**（`&&` / `||` で組んだ業務ルール・状態遷移の判定）が残っていないか。
      1 表なら model、**複数表なら [model.md](./model.md) §3.12 service** へ移す
- [ ] Domain が**異常を戻り値で返し**、止める判断を action に委ねているか（§1.1 絶対則 1）
- [ ] `begin()` したすべての経路で、`exit_ng` の前に `rollback()` しているか（[action.md](./action.md) §2.8）
- [ ] 新設した service の名前が **またがる表名の連結（アルファベット順）＋ `_service`** になっているか。
      業務概念名になっていないか。**同じ組み合わせの既存 service を見落として二重に作っていないか**
      （`ls app/classes/_common_/model_*_service.php` で確認する）。
      既存メソッドが見る表を増やしたなら、クラス名も追随しているか（[model.md](./model.md) §3.12）
- [ ] Domain に書いたメソッドが、**行オブジェクト／配列を渡すだけで単体テストできる**か
      （できないなら、まだシステムの都合が混ざっている）

---

## 7. ここに書くもの（育て方）

サーバ側にだけ効く規約が出てきたら、**その規約が効く住所の葉**に追記する（§1.2 の索引と同じ割り方）。

| 追記したい内容 | 追記先 | `paths`（ロード契機） |
| --- | --- | --- |
| 住所をまたいで効く不変則・層の境界・自己点検 | 本葉 `coding.md` | サーバ側の全住所 |
| action の書き方 | [action.md](./action.md) | `module_*.php` |
| model / service / presenter / util の書き方 | [model.md](./model.md) | `app/classes/**` |
| `.sql` フラグメントの書き方 | [query.md](./query.md) | `app/assets/query/**` |

- **本葉を太らせない。** ここが太ると全住所で読み込まれる。住所固有の話は必ず住所の葉へ。
- **葉を足すときは `paths` を必ず絞る**（住所を特定できないなら、それは住所固有の規約ではない＝本葉に書くべき不変則か、
  そもそも [common/coding.md](../common/coding.md) 行きかを先に判定する）。
- **責務境界の正本は §1.1** であり、他葉はそこを参照する（各葉に禁止事項を写経しない）。
- **節番号は通し番号を維持する**（§1.2）。葉をまたいで参照されているので振り直さない。
- **frontend にも効く話になった時点で、backend ではなく [common/coding.md](../common/coding.md) へ上げる。**
