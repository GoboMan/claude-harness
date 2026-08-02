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

# 🔀 Next.js / frontend — 状態とデータフロー

> **適用範囲: Next.js（App Router）の UI 面。** Next.js でなければ本書は適用外として読み捨てること。
>
> 共通則は [common/coding.md](../common/coding.md)、RSC／Client 境界は [coding.md](./coding.md)、
> 粒度は [components.md](./components.md)、住所は [routing.md](./routing.md)、
> サーバ側の責務分離は [backend/coding.md](../backend/coding.md)。
> 本書は**データをどこに持ち、どの向きに流すか**だけを定める。

---

## 0. 到達点の定義（流れが一本だと何が助かるか）

React が保証するのは、ざっくり次の 2 つだけである。

1. state が変われば再レンダされる
2. **props は親から子への一方向**である

ここに「子が親の state を直接書き換える」「どこからでも fetch する」が入ると、
同じ画面の真実が複数箇所に分かれ、AI も人間も変更の影響範囲を読めなくなる。

App Router ではさらに、**Server Component と Client Component のあいだで渡せるものが限られる。**
Web の React の感覚のまま関数やクラスを props で渡すと、実行時エラーになる。

**本書の役目は、データの向きと置き場を固定し、その抜け道を塞ぐことにある。**

---

## 1. データは親→子、イベントは子→親（一方向）

| 向き | 運ぶもの | 手段 |
| --- | --- | --- |
| **親 → 子** | 表示に使うデータ・設定 | **props** |
| **子 → 親** | 「何か起きた」という通知 | 親が渡した **コールバック**（`onX`）だけ |

```tsx
//  OK: データは下り、イベントはコールバックで上る
function Parent() {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onClose={() => setOpen(false)} />;
}

//  NG: 子が親の state やモジュール変数を直接触る
//  NG: グローバル可変オブジェクトを配って各方書き込む
```

- 子は親の state を import や参照で書き換えない
- 横断して共有したくなったら、**まずコンポーネント分割を疑う**。それでも必要なら、プロジェクトの `CLAUDE.md` で認めた共有手段だけを使う（本書は特定ライブラリを固定しない）

```text
[親]  props(data)  →  [子]
[親]  ← onEvent()     [子]
```

---

## 2. イベントハンドラは Client 末端に閉じる

Server Component には `onClick` 等のイベントハンドラを置けない（フレームワークの制約）。

- インタラクションが必要な節だけ `"use client"` にする（[coding.md](./coding.md)）
- **イベントの発生点は Client の葉**に置く
- 葉より上の Client 親へ通知するときも、§1 どおり **props のコールバック**で上げる

Server Component の親は、子 Client に **データ（props）** と、必要なら **Server Actions** を渡す（§3）。
通常のインライン関数を Server から Client へ渡して `onClick` に束ねない。

---

## 3. Server → Client に渡してよいもの

Client Component へ渡す props は、**シリアライズできる値**に限る。

| 渡してよい | 渡してはいけない |
| --- | --- |
| 文字列・数値・真偽・配列・プレーンオブジェクト・`Date` 等、シリアライズ可能なデータ | 通常の関数・クラスインスタンス・Map/Set 等の非シリアル値 |
| **Server Actions**（ミューテーションの入口として渡す） | ユースケース／インフラ／サーバ前提ドメインの関数そのもの |

読み取り配線の手順（params 検証・ユースケース・`notFound`／props 写像）の例は
**[coding.md](./coding.md) §2 が SSOT**（本書に page 全体を再掲しない）。

本書が定めるのは受け渡しの形だけである。

```tsx
//  OK: Client へ渡すのはシリアル化可能なデータと Server Action 参照だけ
<UserEditForm user={user} updateUser={updateUserAction} />

//  NG: Server で定義した通常関数を Client に渡す
//  <Button onClick={() => doSomething()} />
```

**ミューテーションの本体は Server Actions（ミューテーション・コントローラー）に置き、backend-logic が書く。**
詳細は [backend/coding.md](../backend/coding.md)。frontend は呼び出しと props 渡しのみ（[coding.md](./coding.md) §4）。
Client からユースケースや DB クライアントを import して呼ぶことは禁止。

---

## 4. 状態の置き場（軽量ルール）

値を持つ前に、**その値の真実がどこにあるか**を決める。

| 種別 | 定義 | 置き場 |
| --- | --- | --- |
| **サーバの真実** | DB や外部システムが正本のデータ（一覧・詳細・ユーザ情報） | **読み取り**: RSC の配線 → ユースケース。<br/>**更新**: Server Actions → ユースケース（[backend/coding.md](../backend/coding.md)） |
| **クライアントだけの状態** | サーバが知らない UI の一時状態（モーダル開閉・入力途中・タブ） | 必要最小の Client 末端の `useState` 等。共有が要るときだけ、プロジェクトが認めた手段 |

禁止・回避:

- **初期表示のために** Client の `useEffect` で fetch して `setState` しない。読めるなら RSC（ユースケース経由）で取り、props で渡す
- サーバから受け取った一覧・詳細を、編集フォーム以外の理由でそのまま `useState` に複製しない（複製した瞬間、再取得や Action 後の表示とズレる）
- 編集フォームのように「入力中の下書き」が要る場合だけ、初期値として受けてローカル state に載せてよい。**いつサーバ値で初期化し直すか**は明示する

> クライアント側のキャッシュ層（例: TanStack Query）を置くかどうかは、プロジェクトの `CLAUDE.md` で宣言する。
> harness ではライブラリを固定しない。ただし「Client で初期取得を自前 fetch する」ことを既定にはしない。

---

## 5. 画面内の流れ（イメージ）

```text
RSC（page 配線）
  │  ユースケースで読む
  ▼
  props（データ）／ Server Action（更新口）
  │
  ▼
Server / Client の表示コンポーネント木
  │  データは props で下へ
  ▼
Client 末端（入力・クリック）
  │  onX で親 Client へ、または Server Action を直接呼ぶ
  ▼
（ミューテーション後）Action 側で revalidate 等 → 表示が新しいサーバ真実へ
```

---

## ✅ 返す前チェックリスト

- [ ] データが props で親→子に流れているか（子が親の state を直接書いていないか）
- [ ] 子→親の通知が、親から渡したコールバック（または Server Actions）だけになっているか
- [ ] イベントハンドラが Server Component に置かれていないか
- [ ] Server → Client の props がシリアライズ可能なデータか。渡している関数は Server Actions だけか
- [ ] 初期表示の取得を Client の `useEffect` + fetch に逃がしていないか
- [ ] サーバの真実を、編集下書き以外でむやみに `useState` へ複製していないか
