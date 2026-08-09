---
paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# 🧱 SwiftUI / frontend — View の粒度と分担

> **適用範囲: SwiftUI を使うネイティブ iOS アプリ。** 対象外なら読み捨てること。
>
> 表面の記法は [coding.md](./coding.md)、状態と層は [dataflow.md](./dataflow.md)、
> 画面の住所は [routing.md](./routing.md)。
> 本書は**View 群をどう分割し、誰がどこを書くか**を定める。

---

## 1. 層は責務、住所は共有範囲（この 2 つは別軸）

**層（何を知ってよいか）と住所（どこに置くか）を混同しない。**
層は責務で決まり、住所は「今いくつの場所から使われているか」で決まる。
Feature-first のフォルダ規約自体は [common/coding.md](../common/coding.md) が SSOT。

### 層＝責務（Presentation の内側）

| 層 | 責務 | 例 |
| --- | --- | --- |
| **ui**（原子） | それ以上分解しない見た目の最小単位。業務も UseCase も知らない | `PrimaryButton` `Avatar` `FormTextField` |
| **parts**（分子） | ui を組み合わせた再利用可能なまとまり。局所 UI 状態は持つが業務を知らない | `SearchBar` `EmptyState` `ErrorBanner` |
| **feature**（有機体） | 業務を知るまとまり。ViewModel / Router に触れてよい | `LoginFormView` `UserListView` |
| **root**（配線） | Feature 入口。`NavigationStack` 接続と依存の受け渡しだけ | `LoginRootView` |

**再利用される部品は業務ドメインを知らない。** `PrimaryButton` が「注文」を知り始めたら、それは `feature` である。
引数の名前も、その層の語彙で付ける（`ui` の引数に業務用語を持ち込まない）。

### 住所＝共有範囲

**実際に使われている範囲の最小の場所に置く。** 1 画面でしか使っていないうちは `Shared/` へ上げない。
**2 箇所目が現れた時点で切り出し、住所も一緒に上げる。**

**書き始める前に既存を探す。** 同じ見た目を別々に定義した状態を作らない
（ボタンの角丸を変えるのに複数ファイルを直す、という保守コストを最初から発生させない）。

> **ディレクトリの細名は harness ではこれ以上固定しない。**
> `Presentation/UI` にするかフラットにするかはプロジェクトの `CLAUDE.md` に記録してよい。
> **分離そのもの（ui / parts / feature / root）と Shared へ上げる条件は固定する。**

---

## 2. UI 実装体とロジック実装体の分担境界

**この分離は develop の要求であり、任意ではない。** 見た目とロジックは別コンテキストの実装体が担当し、
オラクル（見た目は人間の一瞥、ロジックは機械テスト）が違うために分けている。

### 構造として必ず作る分割

**root＝配線、presentational＝表示。**
Feature の入口（`LoginRootView` 等）は Router / ViewModel の受け取りと `NavigationStack` の接続に留め、
**画面の見た目の実体は下位の View に置く**（[routing.md](./routing.md)）。

```swift
// ✅ root — 配線だけ
struct LoginRootView: View {
  @Bindable var router: LoginRouter
  @Bindable var viewModel: LoginViewModel

  var body: some View {
    NavigationStack(path: $router.path) {
      LoginFormView(viewModel: viewModel)
        .navigationDestination(for: LoginRoute.self) { /* ... */ }
    }
  }
}

// ✅ presentational に近い feature View — 表示と意図の転送
struct LoginFormView: View {
  @Bindable var viewModel: LoginViewModel

  var body: some View {
    // レイアウトと控件。通信・Repository は知らない
  }
}
```

### その結果として、担当が機械的に分かれる

| 実装体 | 書くもの | 書かないもの |
| --- | --- | --- |
| **UI 実装体** | presentational な View（**渡された値とクロージャだけで表示が決まる**もの）とスタイル | **UseCase / Repository / `URLSession` を import しない。** データは契約どおりの固定モックを引数に流す。Preview も偽物 DI（[coding.md](./coding.md)） |
| **ロジック実装体** | ViewModel / Router / UseCase 接続・root での配線・Domain / Data | **見た目の構造とスタイルを作り直さない**（既存 View の引数へ写像する） |

### 引数（props）型が 2 者の間の契約である

**UI 側が View の入力（初期化引数・渡すモデル型）を定義し、ロジック側はそれに合わせて写像する。**
ロジック側が勝手に「都合のいい引数」へ View を書き換えない。

**足りないと分かったら、どちらの側も実装を止めて報告する**（各実装体の出力契約のとおり）。
自分の都合で片側だけ変えると、もう一方の緑が偽になる。

---

## 3. UI 状態は引数（または薄いバインディング）で表現する

**loading / empty / error / 権限なし / 境界（長文・0 件・巨大な数値）は、表示側から見て入力として表現する。**
UI 側は**その状態がどこから来たかを知らない。**

- `ui` / `parts` は、可能な限り **値とクロージャだけ**で完結させる（ViewModel を直接持たない）
- `feature` が ViewModel を持ってよい。ただし ViewModel の中身（UseCase）を View が知らなくてよい形に保つ
- ロジック側の仕事は「UseCase の結果・進行を、View が受け取る形へ写像する」ことに閉じる

ここが崩れて UI 側が通信を知り始めると、**見た目だけ先に確認する**という分離が成立しなくなる。

---

## 4. 依存は下向きの一方向

`root → feature → parts → ui` の向きにだけ依存する。**逆流と横断を作らない。**

- 下位層が上位層を import しない
- 同じ層どうしで相互に import しない（循環になる）
- 子から親への通知は、**親が渡したクロージャを呼ぶ**形にする（子が親の型を知らない）
- CA の層（Domain / Data）への依存は [dataflow.md](./dataflow.md) に従う。`ui` / `parts` から Domain 実装や Data を触らない

---

## 5. リスト行は「表示部品」に留める

可変長リストの遅延コンテナと安定 id は [coding.md](./coding.md) が SSOT。
本書では分担だけを足す。

- **行 View は `ui` / `parts` に寄せる。** 行の中で UseCase を起動しない
- 一覧に必要なデータは、親の feature / ViewModel が揃えてから渡す
- 行に渡すモデルは、その行が表示に使う分に留める

---

## 6. 見た目のトークンを重複させない

- 色・余白・角丸・字送りは、プロジェクトに共通口があるならそれに置き、画面ごとに生の値をばらまかない
- 同じ見た目のスタイル定義を 2 つの View に書かない
- **再利用される `ui` 層は外側の余白を持たない。**
  置き場所ごとに上書きが必要になり、再利用できなくなる。外側の間隔は**親が決める**

---

## ✅ 返す前チェックリスト

- [ ] 書き始める前に、同じ見た目の既存 View を探したか
- [ ] 再利用する部品が業務ドメインを知っていないか
- [ ] 1 箇所でしか使っていないものを `Shared/` へ上げていないか
- [ ] root に見た目の実体を書きすぎていないか（配線に留まっているか）
- [ ] （UI 実装体）UseCase / Repository / `URLSession` を import していないか
- [ ] （ロジック実装体）見た目の構造とスタイルを作り直していないか
- [ ] UI 状態（loading / empty / error / 権限 / 境界）が表示側の入力として表現されているか
- [ ] 依存が下向き一方向になっているか
- [ ] リスト行が通信や UseCase を抱えていないか
- [ ] `ui` 層が外側の余白を持っていないか
