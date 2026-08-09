---
paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# 🧭 SwiftUI / frontend — ルーティング（Feature Router）

> **適用範囲: SwiftUI を使うネイティブ iOS アプリ。** 対象外なら読み捨てること。
>
> 記法の共通則は [common/coding.md](../common/coding.md)、表面の規約は [coding.md](./coding.md)、
> 粒度と分担は [components.md](./components.md)。
> 本書は**画面の住所と遷移**だけを定める。状態と層の流れは [dataflow.md](./dataflow.md)。

---

## 0. 到達点の定義（NavigationStack ができること・できないこと）

`NavigationStack` は **path に従って画面を積む装置**である。
業務上の「今どこへ行けるか」「成功したらどこへ進むか」までは決めない。

path を View の `@State` に置くと、遷移の知識が描画と結びつき、
連打・ディープリンク・テスト差し替えで壊れやすくなる。

**本書の役目は、遷移の所有を Feature の Router に固定し、View から path 操作を排除することにある。**
中身の API は普通の `NavigationStack(path:)` のままである。

---

## 1. Feature ごとに Router を置く

Presentation に **その Feature の Router** を置く。アプリ全体の巨大な単一 Router を既定にしない。

```swift
enum LoginRoute: Hashable {
  case home
  case forgotPassword
}

@Observable
final class LoginRouter {
  var path = NavigationPath()
  var sheet: LoginSheet?

  func showHome() {
    path.append(LoginRoute.home)
  }

  func showForgotPassword() {
    sheet = .forgotPassword
  }
}
```

- path / sheet / fullScreenCover など **「今どの画面が載っているか」は Router が持つ**
- ViewModel は業務結果を出し、遷移してよいときに Router のメソッドを呼ぶ（[dataflow.md](./dataflow.md)）
- ルート View（その Feature の入口）だけが `NavigationStack(path:)` を Router にバインドする

---

## 2. View は `path.append` しない

```swift
// ❌ NG: View が遷移装置を直接いじる
Button("次へ") { path.append(Route.home) }

// ✅ OK: 意図だけを上に渡す（VM 経由でも Router でも、path 操作は View の外）
Button("次へ") { viewModel.nextButtonTapped() }
```

View が書いてよいのは「ユーザーが何をしたか」まで。
`NavigationPath` の mutate、`navigationDestination` の行き先表の所有は Router（と、それをバインドするルート View）側。

```swift
struct LoginRootView: View {
  @Bindable var router: LoginRouter
  @Bindable var viewModel: LoginViewModel

  var body: some View {
    NavigationStack(path: $router.path) {
      LoginFormView(viewModel: viewModel)
        .navigationDestination(for: LoginRoute.self) { route in
          switch route {
          case .home: HomeView(/* 必要な依存は init で */)
          case .forgotPassword: ForgotPasswordView(/* ... */)
          }
        }
    }
    .sheet(item: $router.sheet) { sheet in
      // ...
    }
  }
}
```

---

## 3. 渡すのは id、実体は取り直す

遷移先へ **巨大なモデルや「前の画面で取った JSON」を丸ごと渡さない。**
渡すのは識別子など復元可能な値に留め、実体は遷移先が UseCase 経由で取得する。

前画面のメモリ上の値を前提にすると、ディープリンク・状態復元・プロセスキル後で必ず壊れる。

不正な id で開かれるのは**異常系ではなく到達可能な状態**である。
パース失敗や不存在は、画面として扱える形に落とす（[common/coding.md](../common/coding.md) の「型を弱めて緑にしない」）。

---

## 4. 戻りと閉じるを明示する

- スタックを戻す操作も Router が持つ（`pop` / `popToRoot` 等）。View が `dismiss` だけに頼って業務フローを組み立てない
- sheet / fullScreenCover の提示と解除も Router の状態で表す
- 「戻れない」ときに行く場所（ホーム等）を、必要なら Router のメソッドとして明示する

---

## 5. ルート接続は `App/` か Feature 入口だけ

- アプリ全体の最初の `NavigationStack` 接続と、Feature Router の生成は **Composition Root（`App/`）または Feature の入口**に閉じる
- 子 View の奥で新たな `NavigationStack` を増殖させない（ネストしたスタックは戻る操作とパス解決を壊しやすい）
- 別 Feature へ跨ぐ遷移が必要なら、その結合点を Composition Root か明示的な境界 API に置く。
  Feature 内部の Router が他 Feature の具象 View を無秩序に import し始めない

---

## ✅ 返す前チェックリスト

- [ ] Feature に Router があり、path / sheet の所有がそこにあるか
- [ ] View が `path.append` や遷移装置の直接操作をしていないか
- [ ] ViewModel が業務結果のあとに Router を呼ぶ形になっているか
- [ ] 遷移パラメータが id 中心で、巨大オブジェクトを渡していないか
- [ ] 不正な入力で開かれたときの表示を決めたか
- [ ] 子の奥で `NavigationStack` を増やしていないか
