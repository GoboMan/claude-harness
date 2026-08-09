---
paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# 🔀 SwiftUI / frontend — 状態とデータフロー（Clean Architecture）

> **適用範囲: SwiftUI を使うネイティブ iOS アプリ。** 対象外なら読み捨てること。
>
> 記法の共通則は [common/coding.md](../common/coding.md)、表面の規約は [coding.md](./coding.md)、
> 画面の住所と遷移は [routing.md](./routing.md)、粒度と分担は [components.md](./components.md)。
> 本書は**状態をどこに持ち、層のあいだでどう流すか**だけを定める。

---

## 0. 到達点の定義（SwiftUI が支えること・支えないこと）

SwiftUI / Observation が保証に近いのは次である。

1. 観測している値が変われば View が更新される
2. データの流れは、設計しない限り勝手には一方向にならない

**ユースケースの実行・通信・キャッシュ方針・永続化・スレッド境界・依存の組み立ては、SwiftUI の守備範囲ではない。**

ここが空いているので、実装は自然と View の `task` / `onAppear` に `URLSession` を書き、
`@Observable` クラスに業務も通信も詰める。その実装はデモ操作では**正しく動いてしまう**。
壊れるのは連打・回線不良・画面の生き残り・テスト差し替えのときであり、そこは検証が届きにくい。

**本書の役目は、その詰め込みを禁じて層と置き場を指定することにある。**

---

## 1. 層と依存の向き（必須）

Feature 内の層は次のとおり。**依存は外から内だけ**（Presentation → Domain ← Data）。

| 層 | 置いてよいもの | 知ってはいけないもの |
| --- | --- | --- |
| **Presentation** | View / 薄い ViewModel / Router | `URLSession`・DTO・他 Feature の Data 実装 |
| **Domain** | Entity / UseCase / Repository の **protocol** | SwiftUI・`URLSession`・DTO・具象ネットワーキング |
| **Data** | Repository の **実装** / DTO / マッピング | View・ViewModel・Router |

```
View ──呼び出す──▶ ViewModel ──呼び出す──▶ UseCase ──依存──▶ Repository(protocol)
                                              ▲
                                              │ 実装
                                         RepositoryImpl（Data, URLSession）
```

- **UseCase は必須。** ViewModel から Repository を直接呼ばない
- **Repository は Domain に protocol、Data に実装。** 具象だけを Domain に置かない
- Domain の型が `import SwiftUI` や `URLSession` を必要としたら、層が溶けている

---

## 2. ViewModel は薄く、`@Observable` + `@MainActor`

画面のクライアント状態（入力途中・ロード表示・エラーメッセージ・選択）は
**その画面の ViewModel** が持つ。

```swift
@MainActor
@Observable
final class LoginViewModel {
  var email = ""
  var password = ""
  var isLoading = false
  var errorMessage: String?

  private let loginUseCase: LoginUseCase
  private let router: LoginRouter

  init(loginUseCase: LoginUseCase, router: LoginRouter) {
    self.loginUseCase = loginUseCase
    self.router = router
  }

  func loginButtonTapped() async {
    isLoading = true
    defer { isLoading = false }
    do {
      try await loginUseCase.execute(email: email, password: password)
      router.showHome()
    } catch {
      errorMessage = "ログインに失敗しました"
    }
  }
}
```

ViewModel がやってよいこと:

- 画面 state の保持と更新
- UseCase の呼び出しと、結果の画面向け整形（表示用メッセージ等）
- Router への「遷移してよい」合図

ViewModel がやってはいけないこと:

- `URLSession` やエンドポイント組み立て
- Entity を跨ぐ業務ルールの本体（それは UseCase）
- 永続化やキーチェーンの直接操作（それは Data 側の責務に下ろす）

**View は UseCase / Repository を知らない。** 知っているのは ViewModel（と、ルート接続に必要な Router のバインディング）だけ。

---

## 3. UseCase と Repository

### UseCase

- 1 つのアプリケーション操作（「ログインする」「明細を取得する」）を表す
- Domain の語彙で入出力する（画面の文言や View の都合を持ち込まない）
- Repository protocol など Domain が許す依存だけを init で受け取る

### Repository

- protocol は Domain
- 実装は Data。**通信の標準は `URLSession` + `async/await`**
- 外部の JSON / DTO と Domain Entity の変換は Data に閉じる（DTO を Presentation まで漏らさない）

```swift
// Domain
protocol UserRepository: Sendable {
  func fetchUser(id: UserID) async throws -> User
}

struct FetchUserUseCase: Sendable {
  private let users: UserRepository
  init(users: UserRepository) { self.users = users }
  func execute(id: UserID) async throws -> User {
    try await users.fetchUser(id: id)
  }
}

// Data
struct UserRepositoryImpl: UserRepository {
  private let session: URLSession
  private let baseURL: URL
  // decode → Entity へマッピング
}
```

---

## 4. Composition Root でだけ具象を知る

**具象型（`UserRepositoryImpl` 等）を生成してつなぐのは `App/`（または Feature の factory）だけ。**
View / ViewModel / UseCase は protocol または抽象に依存し、**init 注入**で受け取る。

- サービスロケータや `.shared` シングルトンで Domain / Data を取らない
- SwiftUI の `Environment` に UseCase や Repository を載せて Domain 相当を配らない
  （Environment に載せてよいのはテーマ等、起動後ほぼ変わらないプレゼンテーション関心事に限る）

差し替え不能な具象結合は、テスト不能と「画面から通信まで一直線」の再発を意味する。

---

## 5. View から通信しない

```swift
// ❌ NG: View が Data の仕事をしている
.task {
  let (data, _) = try await URLSession.shared.data(from: url)
  users = decode(data)
}

// ✅ OK: View は意図だけを渡す
.task { await viewModel.onAppear() }
```

`task` / `onAppear` / ボタンから直接 `URLSession` や Repository 実装を触らない。
再入場・キャンセル・連打の扱いは ViewModel / UseCase 側の設計問題として扱う。

---

## 6. サーバ由来の値と画面だけの値

| 種別 | 定義 | 置き場 |
| --- | --- | --- |
| **サーバ由来** | サーバが真実を持ち、こちらは複製を見ている値 | UseCase 経由で取得。画面にキャッシュし続けるなら方針を明示する |
| **画面だけの値** | 入力途中・モーダル開閉・選択など、サーバが知らない値 | ViewModel（または極小なら View の `@State`） |

判断できない値が出たら、**真実を誰が持つか**を先に決める。
サーバ由来の値を View の `@State` にコピーして「画面の真実」にしない
（編集フォームのように、明示的に編集用コピーを始める場合だけ例外）。

---

## ✅ 返す前チェックリスト

- [ ] View → ViewModel → UseCase → Repository(protocol) → 実装 の向きになっているか
- [ ] UseCase を省略して ViewModel から Repository を呼んでいないか
- [ ] Domain が SwiftUI / `URLSession` / DTO を import していないか
- [ ] ViewModel は `@Observable` + `@MainActor` で、薄く保たれているか
- [ ] 具象の生成が Composition Root 以外に漏れていないか
- [ ] View から `URLSession` や Repository 実装を直接呼んでいないか
- [ ] DTO が Presentation まで漏れていないか
