---
paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# 🎨 SwiftUI / frontend — 表面のコーディング規約

> **適用範囲: SwiftUI を使うネイティブ iOS アプリ。** 対象外なら読み捨てること。
>
> **共通則は [common/coding.md](../common/coding.md)**（整形はツール／型を弱めて緑にしない／
> Feature-first・`App`/`Shared`／`@MainActor`・`async/await`／秘密と依存）。
> 状態と層は [dataflow.md](./dataflow.md)、遷移は [routing.md](./routing.md)、
> 粒度と実装体分担は [components.md](./components.md)。
> 本書は**それに従ったうえで**、SwiftUI の表面（View の書き方）にだけ効く差分を定める。共通側の再掲はしない。

---

## 0. 到達点の定義（`body` ができること・できないこと）

SwiftUI の `body` は**いまの状態を見た目に写す宣言**である。
データの取得・永続化・遷移の所有・業務ルールの本体はここには無い。

`body` は再評価されうる。回数やタイミングを前提にした副作用を書くと、
デモ操作では動き、実機・再描画・プレビューでだけ壊れる。

**本書の役目は、View 表面に開きがちな抜け道（副作用・巨大化・リスト事故・縁の欠落）を塞ぐことにある。**

---

## 1. `body` と描画パスに副作用を書かない

```swift
// ❌ NG: 描画のたびに走りうる
var body: some View {
  let _ = viewModel.load()          // 同期副作用
  Text(viewModel.title)
    .onAppear { Task { await api.fetch() } }  // View が Data を知っている
}

// ✅ OK: 表示と「起動の意図」だけ。本体は ViewModel へ
var body: some View {
  Text(viewModel.title)
    .task { await viewModel.onAppear() }
}
```

- **通信・Repository・UseCase の直接呼び出しを View に書かない**（[dataflow.md](./dataflow.md)）
- `body` 内で `Task { }` を起動して「ついでに更新」しない。契機は `.task` / 明確なユーザー操作に限り、中身は ViewModel
- `body` から同期的な重い計算・ファイル I/O・セマフォ待ちをしない（メインが固まる）

`.onAppear` より **`.task`（および必要なら `.task(id:)`）を優先**する。
キャンセルとライフサイクルの扱いが明確で、画面が消えたあとの更新事故を減らせる。

---

## 2. View を巨大な一枚岩にしない

1 ファイル／1 つの `body` にフォーム・リスト・アラート・通信状態・レイアウトを全部載せない。

| 分割の目安 | やること |
| --- | --- |
| 画面の区間が独立して読める | プライベートな子 View（同じファイルの `private struct` で可）に切り出す |
| 再利用またはプレビュー単位が欲しい | Presentation 内の別 View 型にする |
| 状態や操作が増えてきた | それは View 分割ではなく ViewModel / Router 側の設計を疑う（[dataflow.md](./dataflow.md)） |

**見た目だけの分割で UseCase を View に引きずり込まない。**
子 View が必要とするのは表示値とクロージャ（または薄い ViewModel の参照）まで。

---

## 3. リストとアイデンティティ

長い一覧は **`List` / `LazyVStack` / `LazyHStack` 等の遅延コンテナ**を使う。
通常の `VStack` + `ForEach` で数百行を一度に作らない（初期表示とスクロールで落ちる）。

```swift
// ❌ NG: 安定しない id、行の中でまた通信
ForEach(Array(items.enumerated()), id: \.offset) { _, item in
  Row(item: item).task { await loadDetail(item) }
}

// ✅ OK: ドメイン上安定した id。行は表示に徹する
ForEach(items, id: \.id) { item in
  Row(item: item)
}
```

- `ForEach` の id は **ドメイン上安定した識別子**（`offset` や表示文字列を id にしない）
- 行の出現ごとに詳細取得を始めない。一覧に必要なデータは UseCase 側で揃えるか、明示した画面単位のロードにする
- 行に渡すモデルは、その行が表示に使う分に留める（巨大グラフを毎行に配らない）

---

## 4. 画面の縁 — safe area とキーボード

見落とすとシミュレータでは気づきにくく、実機でだけ壊れる。

- ノッチ・ホームインジケータ・ダイナミックアイランドを前提にする。
  必要なら `safeAreaPadding` / `safeAreaInset` を使い、**手動の魔法数だけで余白を埋めない**
- ナビゲーションバーやタブが既に消費している辺に、同じインセットを二重に足さない
- 入力を含む画面は、キーボードで送信ボタンやフィールドが隠れない構造を最初から入れる
  （`ScrollView`、`safeAreaInset(edge: .bottom)` 等。後付けでレイアウトを組み替えない）

---

## 5. Preview は Composition の偽物で動かす

`#Preview` から本番の `URLSession` や実 API に繋がない。

- Preview 用に **Repository / UseCase の偽物**を Composition と同じ形で差し込む
- Preview のために View がシングルトンや `.shared` を参照し始めない（[dataflow.md](./dataflow.md)）
- プレビューが「画面の見た目を確認する装置」であり続け、結合テストの代替にならないよう、依存は明示的に渡す

```swift
#Preview {
  LoginRootView(
    router: LoginRouter(),
    viewModel: LoginViewModel(
      loginUseCase: PreviewLoginUseCase(),
      router: LoginRouter()
    )
  )
}
```

---

## 6. アクセシビリティは「発行」する

アイコンだけ・装飾だけのコントロールは、VoiceOver に名乗らない。

| 対象 | 付けるもの |
| --- | --- |
| 押せるもの全般 | ボタン等として認識されること（`Button` を使う／必要なら `accessibilityAddTraits`） |
| アイコンだけで文言が無いもの | `accessibilityLabel`（操作の意味。「アイコン名」ではない） |
| 装飾だけの画像 | `accessibilityHidden(true)` |
| 状態（選択・無効） | 見た目だけでなくアクセシビリティの状態でも表す |

表示文言のコピーを id 代わりにしない（文言変更で壊れる）。テスト同定が必要なら、**機能で命名した** identifier を別途付ける。

> a11y の深い指針や FE テストの書き方葉は当面置かない。
> develop は FE テストを起票しない前提に合わせ、ここでは発行の最低線だけを固定する。

---

## 7. レイアウトの逃げ道を常用しない

- **`GeometryReader` を「なんとなく置く」ために使わない。** 子が提案するサイズを壊し、ネストするとレイアウトが崩壊しやすい。必要な計測が説明できるときだけ使う
- 色・フォント・余白のマジックナンバーを画面ごとにばらまかない。プロジェクトにデザインの共通口（Asset / 小さなトークン）があるならそれを使う。無いなら勝手にデザインシステム一式を新設せず、既存の書き方に合わせる
- アニメーションは「動いて見える」ためだけに state を毎フレーム更新しない。SwiftUI の `animation` / `withAnimation` に載せ、重い計算をアニメーションのクロージャに埋め込まない

---

## ✅ 返す前チェックリスト

- [ ] `body` や描画パスに通信・重い同期処理・勝手な `Task` 起動が無いか
- [ ] View から UseCase / Repository / `URLSession` を直接呼んでいないか
- [ ] 画面が巨大一枚岩のままになっていないか
- [ ] 長い一覧が遅延コンテナで、`ForEach` の id が安定しているか
- [ ] safe area / キーボードで実機レイアウトが死なないか
- [ ] Preview が実 API や `.shared` に依存していないか
- [ ] アイコンボタン等に `accessibilityLabel`（または同等）があるか
- [ ] 理由のない `GeometryReader` を増やしていないか
