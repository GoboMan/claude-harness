---
paths:
  - "**/next.config.*"
  - "**/app/**/page.tsx"
  - "**/app/**/layout.tsx"
  - "**/app/**/loading.tsx"
  - "**/app/**/error.tsx"
  - "**/app/**/not-found.tsx"
  - "**/app/**/template.tsx"
  - "**/app/**/default.tsx"
  - "**/components/**"
  - "**/features/**"
---

# 🧭 Next.js / frontend — ルーティング（App Router）

> **適用範囲: Next.js（App Router）。** Next.js でなければ本書は適用外として読み捨てること。
>
> 記法の共通則は [common/coding.md](../common/coding.md)、表面の規約は [coding.md](./coding.md)。
> 本書は**画面の住所と URL から入る前提**だけを定める。状態の持ち方は [dataflow.md](./dataflow.md)、
> 粒度は [components.md](./components.md)。

---

## 0. 到達点の定義（ファイル配置が仕様である）

App Router は**`app/` 配下のファイル配置がそのままルーティング仕様である。**
別途の巨大なルート表で「画面一覧」を持たない。

その代わり、**アプリ内リンクと、URL を直接開く侵入が同じ経路になる。**
つまり**どの page も「前の画面を経由せずにいきなり開かれうる」。**
「前の画面から渡されたはずの値」や「前画面の state」を前提にした page は、この経路で必ず壊れる。

**本書の役目は、ファイル配置の規約を守らせることと、「いきなり開かれる」前提を崩させないことにある。**

---

## 1. `app/` に置くものはルートと枠だけ

**到達可能な UI の入口と、framework が求める特殊ファイル以外を `app/` に置かない。**
汎用コンポーネント・フック・ドメイン・ユースケース・スタイルの置き場を `app/` に作ると、
意図しない URL が増えたり、配線と実装が混ざる。

画面の部品は `app/` の外へ置く（住所はプロジェクトの `CLAUDE.md`）。

Server Actions を `app/` 配下に置く場合も、**ミューテーション・コントローラーとして薄く保つ**
（[backend/coding.md](../backend/coding.md)）。業務本体を Action ファイルに沈めるのは禁止。

**`page.tsx` / `layout.tsx` / `route.ts` 等は framework が要求する default export を使う。**
例外の範囲は [common/coding.md](../common/coding.md)。名前付き export にするとルートが空になることがある。

---

## 2. ファイル名が仕様である

| 名前 | 意味 |
| --- | --- |
| `page.tsx` | そのセグメントの UI 入口 |
| `layout.tsx` | 下位セグメントを包む共通枠（ネストする） |
| `route.ts(x)` | Route Handler（HTTP エンドポイント） |
| `loading.tsx` | その枠の読み込み中 UI（セグメント待ち。ビュー内状態の props loading との分担は [components.md](./components.md) §3） |
| `error.tsx` | その枠のエラー UI（Client Component） |
| `not-found.tsx` | 未存在の受け皿 |
| `template.tsx` | ナビのたびに状態がリセットされる枠 |
| `default.tsx` | Parallel Routes 用のフォールバック |
| `(group)` | URL に現れないグルーピング |
| `[id]` | 動的セグメント |
| `[...slug]` / `[[...slug]]` | catch-all / optional catch-all |

**この規約に手続きで割り込まない。** 1 つの `page.tsx` の中で条件分岐して複数の「画面」を出し分ける
擬似ルートを作ると、URL からその状態へ到達できなくなり、ファイル構成が仕様でなくなる。
画面が 2 つなら、セグメント（ファイル）を 2 つ作る。

---

## 3. `params` / `searchParams` は文字列であって、あなたの型ではない

動的セグメントもクエリも、やって来る値は **文字列（またはその配列）** である。
数値・真偽・日付として使うなら**読み取り配線の縁でパースし、失敗を扱う。**
（[backend/coding.md](../backend/coding.md) §5、[frontend/coding.md](./coding.md) §2、[common/coding.md](../common/coding.md) §1）

```tsx
//  NG: 型パラメータで数値だと信じ込ませ、未検証のままユースケースへ
//  OK: スキーマ検証に失敗したら notFound() 等。成功時だけユースケースへ
```

不正な `id` で開かれるのは**異常系ではなく到達可能な状態**である（URL は編集できる）。
表示は `notFound()` / error UI / ビュー props の error・empty で明示する
（Client 向け ActionResult は読み取りでは必須にしない。[backend/coding.md](../backend/coding.md) §6）。

---

## 4. URL にオブジェクトや「前画面の荷物」を詰めない

searchParams や path に JSON や大きな状態を載せて「次画面へ渡す」ことを既定にしない。
**渡すのは id や、フィルタとして意味のある短いクエリに限る。**
実体はユースケース経由でサーバの真実から引く（[dataflow.md](./dataflow.md)、[backend/coding.md](../backend/coding.md)）。

「もう手元にあるのだから props や URL で全部渡せば速い」は、
直接 URL を開かれた瞬間に破綻する。

---

## 5. 遷移

**宣言的な遷移は `next/link` の `<Link>` を既定にする。**
命令的な `useRouter().push` / `replace` は、**Client のイベントハンドラやロジック側からのみ**呼ぶ
（レンダ中に呼ばない）。

```tsx
//  OK
<Link href={`/users/${id}`}>詳細</Link>

//  動的に組むときも、不正な文字列や未検証の値をそのまま連結しない
```

外部 URL への `Link` や `redirect` では、オープンリダイレクトにならないよう
**許可する行き先をプロジェクト側で制限する**（具体手段はプロジェクト選択）。

---

## 6. 共有 provider は根の `layout.tsx` に寄せる

アプリ全体で共有する Client の provider（テーマ・トースト・クライアント側キャッシュ等）は、
**根に近い `app/layout.tsx`（またはプロジェクトが決めた 1 箇所）に置く。**

page ごとに provider を増やしてキャッシュや設定を分裂させない。
何を provider にするか自体はプロジェクト選択であり、本書は**置き場所の散逸だけを禁ずる。**

---

## ✅ 返す前チェックリスト

- [ ] `app/` にルート／枠／薄いコントローラー以外を置いていないか
- [ ] framework が要求するファイルが default export になっているか
- [ ] 1 つの page で複数画面を条件分岐して擬似ルート化していないか
- [ ] `params` / `searchParams` をパース・検証し、不正時の表示を決めたか
- [ ] URL にオブジェクトや大きな状態を詰めて次画面へ渡していないか
- [ ] 命令的ナビをレンダ中に呼んでいないか
- [ ] 共有 provider を page ごとに増やしていないか
