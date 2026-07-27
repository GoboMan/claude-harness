---
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/app.json"
  - "**/app.config.*"
  - "**/eas.json"
---

# 🧭 Expo / frontend — ルーティング（expo-router）

> **適用範囲: Expo (expo-router) の React Native アプリ。** Expo でなければ本書は適用外として読み捨てること。
>
> 記法の共通則は [common/coding.md](../common/coding.md)、表面の規約は [coding.md](./coding.md)。
> 本書は**画面の住所と遷移**だけを定める。状態の持ち方は [dataflow.md](./dataflow.md)。

---

## 0. 到達点の定義（expo-router ができること・できないこと）

expo-router は**ファイルの配置がそのままルーティング仕様である**。
ルータ設定オブジェクトも、遷移テーブルも、登録処理も存在しない。

その代わり、**アプリ内の遷移と、URL・ディープリンクからの直接侵入が同じ経路になる。**
つまり**どの画面も「前の画面を経由せずにいきなり開かれうる」**。
「前の画面から渡されたはずの値」を前提にした画面は、この経路で必ず壊れる。

**本書の役目は、ファイル配置の規約を守らせることと、「いきなり開かれる」前提を崩させないことにある。**

---

## 1. `app/` 配下に置いたファイルは、意図に関係なくルートになる

コンポーネント・フック・定数・型定義を `app/` に置かない。**置いた瞬間に到達可能な画面が 1 枚増える。**
画面以外は `app/` の外（`components/` `hooks/` 等、住所はプロジェクトの `CLAUDE.md` に従う）へ置く。

**ルートファイルは `export default` が必須。**
[common/coding.md](../common/coding.md) の「default export を使わない」の**唯一の例外**がここである。
名前付き export にすると framework がルートを解決できず、**画面が空になる**（ビルドは通る）。

---

## 2. ファイル名が仕様である

| 名前 | 意味 |
| --- | --- |
| `_layout.tsx` | そのディレクトリ以下の共通レイアウトとナビゲータ |
| `(group)` | URL に現れないグルーピング（タブ・認証状態などの束ね） |
| `[id]` | 動的セグメント |
| `[...rest]` | catch-all |
| `+not-found.tsx` | 未定義パスの受け皿 |
| `index.tsx` | そのディレクトリ自身のパス |

**この規約に手続きで割り込まない。** 1 つのファイルの中で条件分岐して複数画面を出し分ける
「擬似ルート」を作ると、URL からその状態へ到達できなくなり、ファイル構成が仕様でなくなる。
画面が 2 つなら、ファイルを 2 つ作る。

---

## 3. params は文字列であって、あなたの型ではない

`useLocalSearchParams()` が返すのは **`string | string[] | undefined`** である。
数値・真偽値・日付・JSON は**必ずパースし、失敗を扱う。**

```tsx
//  NG: 型を騙しているだけ。不正な値でそのまま下流へ流れる
const { id } = useLocalSearchParams<{ id: number }>();

//  OK: パースして、不正なら到達可能な状態として扱う
const { id: rawId } = useLocalSearchParams<{ id: string }>();
const id = Number(rawId);
if (Number.isNaN(id)) return <NotFound />;
```

不正な `id` で開かれるのは**異常系ではなく到達可能な状態**である（URL は編集できる）。
[common/coding.md](../common/coding.md) の「型を弱めて緑にしない」がここに効く。

**既定は `useLocalSearchParams`。** `useGlobalSearchParams` は現在フォーカスされているルートの params を返すため、
**アプリ内のどこで遷移しても再レンダが走る**。使う理由を説明できるときだけ使う。

---

## 4. params にオブジェクトを詰めない

params はシリアライズされて URL に載る。**「前の画面から渡された JSON」を前提にした画面は、
ディープリンクと復元経路で必ず壊れる。**

**渡すのは id だけにし、実体はキャッシュ層から引く**（[dataflow.md](./dataflow.md)）。
「もう手元にあるのだから渡したほうが速い」は、キャッシュ層があれば成立しない理由である。

---

## 5. 遷移

**既定は `<Link>` の宣言的な形にする。**

```tsx
//  NG: エスケープ漏れが起き、typed routes の恩恵も消える
<Link href={`/user/${id}?tab=${tab}`} />

//  OK
<Link href={{ pathname: '/user/[id]', params: { id, tab } }} />
```

命令的な `router.push` / `router.replace` は、**イベントハンドラかロジック側からのみ**呼ぶ
（レンダ中に呼ばない）。

**`router.back()` は `router.canGoBack()` で守る。**
ディープリンクで直接その画面に入ったときはスタックに戻り先が無く、
「閉じるボタンが無反応」という形で壊れる。戻れないときの行き先（ホーム等）を明示する。

---

## 6. provider はルートの `_layout.tsx` に 1 箇所だけ

アプリ全体で共有する provider（クエリクライアント・safe area・テーマ・認証状態）は、
**最上位の `_layout.tsx` にのみ置く。**

画面ごとに provider を作ると、**キャッシュとインセットが画面ごとに分裂し、
「戻ると値が違う」「余白が画面ごとにずれる」**という追いにくい壊れ方をする。

---

## ✅ 返す前チェックリスト

- [ ] `app/` の中に画面以外のファイルを置いていないか
- [ ] ルートファイルが `export default` になっているか
- [ ] 1 ファイルの中で条件分岐して複数画面を出し分けていないか
- [ ] params をパースし、不正値のときの表示を決めたか
- [ ] params にオブジェクトを詰めず、id だけを渡しているか
- [ ] `href` を文字列連結で組んでいないか
- [ ] `router.back()` を `canGoBack()` で守ったか
- [ ] provider を画面ごとに作っていないか
