---
paths:
  - "**/next.config.*"
  - "**/app/**/route.ts"
  - "**/app/**/route.tsx"
  - "**/app/**/actions.ts"
  - "**/app/**/actions.tsx"
  - "**/actions/**/*.ts"
  - "**/actions/**/*.tsx"
  - "**/domain/**"
  - "**/infrastructure/**"
  - "**/use-cases/**"
  - "**/usecases/**"
  - "**/*.{test,spec}.{ts,tsx}"
  - "**/__tests__/**"
---

# 🧪 Next.js / backend — テスト設計

> **適用範囲: Next.js（App Router）のサーバ側処理。** Next.js でなければ本書は適用外として読み捨てること。
>
> **共通則は [common/testing.md](../common/testing.md)**（ランナーはプロジェクト宣言・コマンド一発・
> 決定性・スイート分離・`F-xxx`）。本書は**それに従ったうえで**、
> 役割ごとに何をどう試すかだけを扱う。共通側の再掲はしない。
>
> 責務分離は [backend/coding.md](./coding.md)。
> **読み取り配線（RSC page）の薄い試験は frontend**（[frontend/testing.md](../frontend/testing.md) §3）。

---

## 1. 役割ごとの主戦場

| 役割 | 既定スイートでの扱い |
| --- | --- |
| **ドメイン** | **最優先。** 副作用なし・モック不要の単体 |
| **ユースケース** | **書く。** インフラは境界モックまたは偽実装。**シナリオ結果**（`ok` / `reason` 等）を検証 |
| **インフラ** | 既定では実 DB／実外部 API を要求しない。書くなら結合スイート |
| **ミューテーション・コントローラー**（Actions / Route Handlers） | **薄く書く。** 縁のスキーマ検証失敗、シナリオ結果→呼び手向け形の写像、ユースケース呼び出し。Actions＝Result、RH＝status＋body（[backend/coding.md](./coding.md) §6）。`revalidatePath` 等はモック |

オニオンの内側ほど反証しやすく安い。**ファットな Server Actions にテストを寄せない。**

---

## 2. ドメイン

```ts
describe("F-001 rename policy", () => {
  it("rejects empty display name", () => {
    expect(decideDisplayName(current, "  ").ok).toBe(false);
  });
});
```

- `next/*`・DB・時計に触れない
- 失敗・空・権限・境界をハッピーパスだけで終わらせない

---

## 3. ユースケース

- インフラ依存は引数注入できる形を前提にする
- モックするのは **インフラ境界だけ**（ドメインまでモックし尽くさない）
- 返すのはシナリオ結果。呼び手向け形への写像はミューテーション・コントローラー試験で見る

---

## 4. ミューテーション・コントローラー（Server Actions / Route Handlers）

共通: **不正入力**でユースケースが呼ばれず失敗が判別できること。**正当入力**でユースケースが期待引数で呼ばれ、シナリオ結果が呼び手向け形に載ること。

| 実装形 | 見るもの |
| --- | --- |
| Server Actions | 呼び手向け Result の成功／失敗 |
| Route Handlers | HTTP status ＋ body（契約どおりか） |

Next 固有 API はモックし、キャッシュキー網羅までは求めない。

---

## 5. インフラと結合スイート

- 実 DB 試験は結合スイートへ置き、既定スイートから外す
- 既定ではメモリ偽実装やモックで境界の入出力だけに留める

---

## ✅ 返す前チェックリスト

- [ ] ドメインの純粋試験が主戦場か
- [ ] ユースケースでインフラだけを境界モックしているか
- [ ] ミューテーション・コントローラー試験が縁と成功／失敗判別に閉じているか（Actions＝Result、RH＝status＋body）
- [ ] 読み取り配線の試験を backend 必須にしていないか（frontend 側）
- [ ] 実 DB が結合フォルダに分かれ既定から外れているか
- [ ] 最外グループに `F-xxx` が付いているか
