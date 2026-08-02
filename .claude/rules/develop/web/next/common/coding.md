---
paths:
  - "**/next.config.*"
  - "**/middleware.ts"
  - "**/middleware.js"
  - "**/app/**/page.tsx"
  - "**/app/**/layout.tsx"
  - "**/app/**/route.ts"
  - "**/app/**/route.tsx"
  - "**/app/**/loading.tsx"
  - "**/app/**/error.tsx"
  - "**/app/**/not-found.tsx"
  - "**/app/**/template.tsx"
  - "**/app/**/default.tsx"
  - "**/app/**/actions.ts"
  - "**/app/**/actions.tsx"
  - "**/actions/**/*.ts"
  - "**/actions/**/*.tsx"
  - "**/components/**"
  - "**/features/**"
  - "**/domain/**"
  - "**/infrastructure/**"
  - "**/use-cases/**"
  - "**/usecases/**"
---

# 📐 Next.js — コーディングの共通則（全レイヤ）

> **適用範囲: Next.js（App Router）の TypeScript プロジェクト。**
> 取り込み先の `CLAUDE.md` で platform／framework を `web/next` と宣言していることを前提とする。
> 本書の `paths` は Next らしい手がかり（`next.config.*`・`app/**/page.tsx` 等）による弱いゲートである。
> **対象が Next.js（App Router）でなければ本書は適用外**として読み捨てること。
>
> 本書が持つのは**レイヤをまたいで真であること**だけ。サーバ側の責務分離は
> [backend/coding.md](../backend/coding.md)、RSC／Client の表面は
> [frontend/coding.md](../frontend/coding.md)、テストの配線は [testing.md](./testing.md)。
> そちらは**本書への差分**である。**共通則をレイヤ側へ写さないこと**（SSOT はここ 1 箇所）。

---

## 0. 整形は本書ではなくツールが決める

インデント・改行位置・クォート・セミコロン・import 順は **プロジェクトの lint / format コマンドが SSOT** であり、
本書は一切定めない。手で桁を揃えない。**書き終えたら整形コマンドを通してから返す。**

規約が競合したときはツールの出力が正である（人間もそこしか見ない）。

---

## 1. 型を弱めて緑にしない

**`any` / `as any` / non-null assertion（`!`） / `@ts-expect-error` / `eslint-disable` を「型エラーを消すため」に書かない。**
不明な値は `unknown` とし、狭めてから使う。

特に **Server Actions・Route Handlers・`searchParams` / `params` など、外から入る値**を
`as` で業務型に張り付けない。縁での実行時検証（[backend/coding.md](../backend/coding.md)）を経ていない値を
型だけ信じるのは、実行時に別の場所で落ちる欠陥になる。

```ts
//  NG: 外から来た値を型で押し潰している
const input = raw as CreateUserInput;

//  NG: 「たぶん来る」を型に約束させている
const id = params.id!;
```

**抑止したくなったら、実装を止めて「何と何が食い違っているか」を報告する**（各実装体の出力契約のとおり）。
自分で契約を書き換えて辻褄を合わせない。

例外は**外部ライブラリの型定義が実際の挙動と異なる場合だけ**で、そのときは理由をコメントに残す。

---

## 2. モジュールの形

### default export を使わない

import 側で名前を自由に付けられてしまい、同じものが呼び出し箇所ごとに違う名前になる。
**名前付き export に統一する。**

```ts
//  NG
export default function UserCard() {}

//  OK
export function UserCard() {}
```

> **唯一の例外: App Router がファイル規約で要求する default export。**
> 少なくとも `page.tsx` / `layout.tsx` / `route.ts(x)` / `loading.tsx` / `error.tsx` /
> `not-found.tsx` / `template.tsx` / `default.tsx` は framework が default export で解決する。
> 名前付き export にすると**ルートや特殊 UI が空になる**（ビルドは通ることがある）。

### barrel を作らない

再 export しかしない `index.ts` を置かない。循環 import の温床であり、バンドラから見て不要な結線が増える。

`app/` 配下では、置き場所とファイル名自体がルーティング仕様になる。
barrel のつもりで置いたファイルが、意図しないルートや特殊ファイルとして解決されないか注意する。

### 相対パスを積み上げない

`../../../` を書かず、tsconfig のパスエイリアス（多くの Next プロジェクトでは `@/`）を使う。
ファイルを移動した瞬間に全リンクが切れるのを防ぐ。

---

## 3. 環境変数と秘密

**`NEXT_PUBLIC_` を接頭辞に持つ環境変数は、クライアントバンドルへ埋め込まれる。すなわち公開される。**

- API の公開ベース URL・公開キー・機能フラグ → 置いてよい
- API シークレット・署名鍵・DB URL・管理者トークン → **`NEXT_PUBLIC_` を付けない。サーバ側だけの環境変数に置く**

秘密を要する処理が Client Component 側に必要になったら、それはクライアントに置けない処理である。
**実装を止めて報告する**（自分でサーバ側の設計を決めない）。

---

## 4. `middleware` に業務を沈めるな

`middleware.ts` はリクエストの薄い縁（リダイレクト・ヘッダ・認証クッキーの有無チェック等）に限る。
**ドメイン判定・DB アクセス・ユースケース呼び出しを置かない。**

本体の置き場（所有者は [backend/coding.md](../backend/coding.md) §1.1）:

- **ミューテーション**（Actions / Route Handlers）→ backend-logic
- **読み取り配線**（`page` / `layout`）→ frontend-logic
- **`middleware.ts` 自体**（薄い縁のみ）→ backend-logic（別にするなら `CLAUDE.md` に宣言）
- どれもユースケース経由で業務を完結させない。定義は [backend/coding.md](../backend/coding.md) §1

---

## ✅ 返す前チェックリスト

- [ ] lint / format コマンドを通したか
- [ ] `any` / `as any` / `!` / `@ts-expect-error` / `eslint-disable` を緑化のために足していないか
- [ ] App Router が要求するファイル以外で `export default` を使っていないか
- [ ] 再 export だけの `index.ts` を置いていないか
- [ ] 秘密になりうる値を `NEXT_PUBLIC_` に入れてないか
- [ ] `middleware` に業務ロジックや DB アクセスを書いていないか
