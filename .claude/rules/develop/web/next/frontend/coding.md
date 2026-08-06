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

# 🎨 Next.js / frontend — 表面のコーディング規約

> **適用範囲: Next.js（App Router）の UI 面。** Next.js でなければ本書は適用外として読み捨てること。
>
> **共通則は [common/coding.md](../common/coding.md)**。サーバ側の責務分離は
> [backend/coding.md](../backend/coding.md)（Actions 本体・オニオン。FE 実装体の束に含まれる — develop skill §6-B）。
> データの向きと状態の置き場は [dataflow.md](./dataflow.md)。
> コンポーネントの粒度は [components.md](./components.md)、画面の住所は [routing.md](./routing.md)。
> **FE テストは当面起票しない**（frontend の testing 葉は置かない。共通の配線は [common/testing.md](../common/testing.md)）。
> 本書は**それに従ったうえで**、RSC／Client の境界と page の薄さだけを定める。共通側の再掲はしない。
>
> **ディレクトリ名（`components/` 等）は harness では固定しない。** 住所はプロジェクトの `CLAUDE.md` に記録する。

---

## 0. 到達点の定義（RSC が既定である理由）

App Router では、ファイルに何も書かなければ **Server Component** として扱われる。
Client Component（`"use client"`）は、インタラクティブさのために境界を切るための例外である。

`"use client"` をページや大きな枝の根に置くと、その下の木がクライアントバンドルに乗り、
サーバだけで済む取得・秘密・重い依存まで引きずられる。

**本書の役目は、「必要になるまで Client に落とさない」抜け道を塞ぐことにある。**

---

## 1. Server Component を既定にし、Client は末端だけに置く

- **原則すべて Server Component**とする
- `useState` / `useEffect` / ブラウザ専用 API / イベントハンドラ（`onClick` 等）が必要な
  **最小限の末端**にだけ、ファイル先頭へ `"use client"` を書く
- Client 境界は**できるだけ葉に近い位置**に置く（ページ全体を Client にしない）

---

## 2. page / layout は読み取り配線に閉じる

`page.tsx` / `layout.tsx` に複雑な UI 構造やスタイルの本体を書かない。
**構成と読み取り配線だけ**を持ち、表示の実体は presentational なコンポーネントへ渡す。

読み取り配線はオニオンの**外側入口**の一形態である（[backend/coding.md](../backend/coding.md) §1・§3）。

- インフラやドメインを page に直書きしない
- `params` / `searchParams` は縁で検証してからユースケースへ渡す
- 不正なら `notFound()` 等、取得結果はビューの props（empty／error／権限なし等）へ写像する
- **セグメント枠の待ち**は `loading.tsx`。初期表示のサスペンスを props の `loading` で二重に持たない（[components.md](./components.md) §3）

```tsx
//  OK: 読み取り配線（検証 → ユースケース → ビュー）
export default async function UserPage({ params }: Props) {
  const raw = await params;
  const parsed = UserIdSchema.safeParse(raw);
  if (!parsed.success) notFound();

  const outcome = await getUser({ id: parsed.data.id });
  if (!outcome.ok) {
    if (outcome.reason === "not_found") notFound();
    return <UserDetailView user={null} error={toUserMessage(outcome.reason)} />;
  }
  return <UserDetailView user={outcome.user} error={null} />;
}
```

```tsx
//  NG: page に取得と表示と判定が同居／params を未検証のまま流す
export default async function UserPage({ params }: Props) {
  const { id } = await params;
  const row = await prisma.user.findMany();
  //  ...大量の JSX
}
```

粒度・誰が JSX を書くかは [components.md](./components.md)。例の SSOT は本書とする（他葉はリンクのみ）。

---

## 3. Client からサーバの層を import しない

`"use client"` のモジュールが import してよいのは、おおむね次だけである。

- 他の Client Component／クライアントで完結する UI ユーティリティ
- **Server Actions**（ミューテーションの入口。**本体は backend-logic**）
- 公開してよい設定値（`NEXT_PUBLIC_` 等）

**ユースケース・インフラ・サーバ前提のドメイン実装を Client から import しない。**

---

## 4. ミューテーションは Server Actions 経由

同一アプリ内でサーバ上の真実を変える処理は、Client からインフラを叩かず
**Server Actions（ミューテーション・コントローラー）を呼ぶ。**

- Actions / Route Handlers の**本体**（zod・ユースケース・`revalidatePath`）は
  [backend/coding.md](../backend/coding.md) に従い **backend-logic が書く**
- frontend-logic は Action の**呼び出しと props 渡し**に留める
- 外部クライアント向け HTTP は Route Handlers（backend）。**Client から「公開 API」を勝手に直叩きしてミューテーションしない**
  （ブラウザ向けの更新口は Actions を既定とする）

---

## ✅ 返す前チェックリスト

- [ ] `"use client"` がページ根ではなく、インタラクションが必要な末端にだけ付いているか
- [ ] `page.tsx` / `layout.tsx` が読み取り配線に閉じ、UI 本体を下位へ渡しているか
- [ ] `params` / `searchParams` を検証してからユースケースに渡しているか
- [ ] 読み取りでインフラ（Prisma 等）を page から直呼びしていないか
- [ ] Client Component がユースケース／インフラ／サーバ前提ドメインを import していないか
- [ ] 同一アプリ内ミューテーションが Server Actions 経由か（本体は backend）
