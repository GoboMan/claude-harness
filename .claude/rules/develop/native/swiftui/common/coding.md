---
paths:
  - "**/*.swift"
  - "**/Package.swift"
---

# 📐 SwiftUI — コーディングの共通則（全レイヤ）

> **適用範囲: SwiftUI を使うネイティブ iOS アプリ。**
> 本書は拡張子で発火するため、サーバサイド Swift や SwiftUI 以外のターゲットにも注入されうる。
> **対象が SwiftUI iOS アプリでなければ本書は適用外**として読み捨てること。
>
> 本書が持つのは**レイヤをまたいで真であること**だけ。SwiftUI 表面の差分は
> [frontend/coding.md](../frontend/coding.md)、状態と層は
> [frontend/dataflow.md](../frontend/dataflow.md)、画面遷移は
> [frontend/routing.md](../frontend/routing.md)、粒度と分担は
> [frontend/components.md](../frontend/components.md)。テスト配線は
> [testing.md](./testing.md)、テストの実行タイミングは
> [test-execution.md](./test-execution.md)。
> **共通則をレイヤ側へ写さないこと**（SSOT はここ 1 箇所）。

---

## 0. 整形は本書ではなくツールが決める

インデント・改行位置・import 順・スペースは **プロジェクトの format / lint コマンドが SSOT** であり、
本書は一切定めない。手で桁を揃えない。**書き終えたら整形コマンドを通してから返す。**

規約が競合したときはツールの出力が正である（人間もそこしか見ない）。

---

## 1. 型と失敗を弱めて緑にしない

**強制アンラップ（`!`）／`try!`／`as!`／理由のない `fatalError` を「コンパイルを通すため」に書かない。**

これらを書く必要が出たということは、**型か契約のどちらかが間違っている**という信号である。
黙って潰すと、間違った前提のまま下流が積み上がり、実行時に別の場所で落ちる。

```swift
// ❌ NG: 失敗しうる値を成功前提に押し潰している
let user = try! await repository.fetchUser(id: id)
let id = Int(rawId)!

// ✅ OK: 失敗を型で運び、呼び出し側で扱う
let user = try await repository.fetchUser(id: id)
guard let id = Int(rawId) else { /* 到達可能な不正入力として扱う */ return }
```

**潰したくなったら、実装を止めて「何と何が食い違っているか」を報告する**（各実装体の出力契約のとおり）。
自分で契約を書き換えて辻褄を合わせない。

例外は**外部 API やシステムが「ここは必ず存在する」と文書で保証している場合だけ**で、そのときは理由をコメントに残す。
IB 出口の `@IBOutlet` 慣例など、framework が強制するものはそれに従う。

---

## 2. モジュールと住所（Feature-first）

コードの住所は **Feature-first** とする。層名をトップに置かない。

```
App/                         # 起動・Composition Root・ルート接続だけ
Shared/                      # 複数 Feature から本当に使われるものだけ
Features/
  Login/
    Presentation/            # View / ViewModel / Router
    Domain/                  # Entity / UseCase / Repository の protocol
    Data/                    # Repository 実装 / DTO / URLSession 利用
```

### `App/` に置いてよいもの

- アプリ入口（`@main`）
- **Composition Root**（具象型の生成と配線。詳細は [dataflow.md](../frontend/dataflow.md)）
- ルートの `NavigationStack` 接続（詳細は [routing.md](../frontend/routing.md)）

業務ロジック・画面・Repository 実装を `App/` に逃がさない。

### `Shared/` に上げる条件

**いま 2 つ以上の Feature から使われているものだけ**を上げる。
「将来使いそう」で上げない。1 Feature 専用の型は、その Feature 配下に置く。

`Shared/` が Domain のゴミ箱になった瞬間、Feature-first の局所性が壊れる。

### 依存の向き（住所を跨いでも同じ）

- Feature の Domain は SwiftUI・`URLSession`・他 Feature の Presentation / Data を知らない
- Feature 同士が互いの内部実装を直接 import して依存し合わない
  （共有が必要なら本当に共有の型だけを `Shared/` へ抜き、それでも足りない結合は設計として報告する）

---

## 3. 並行: `async/await` のみ、UI state は Main

**新規コードに Combine を増やさない**（`PassthroughSubject` / `AnyPublisher` 等）。
非同期は `async` / `await` / `Task` で書く。

**画面の state を持つ ViewModel は `@MainActor` にする。**
UI を触る値の更新をメインスレッドに固定し、View からの呼び出しと更新の競合を型で防ぐ。

```swift
@MainActor
@Observable
final class LoginViewModel {
  var isLoading = false
  // ...
}
```

- 重い処理・通信の本体は ViewModel に書かず、UseCase / Repository 側へ下ろす（[dataflow.md](../frontend/dataflow.md)）
- UseCase / Repository を無差別に `@MainActor` にしない（メインを占有し、画面が固まる）
- View の `body` から同期的にブロッキング I/O や重い計算をしない

既存コードに Combine が残っていても、**新規経路は `async/await` に寄せる。**
移行方針が必要な規模なら、そのプロジェクトの `CLAUDE.md` か ADR に書く。

---

## 4. 秘密をソースとクライアントに埋め込まない

配布バイナリから取り出せる場所に、秘密を置かない。

- API のベース URL・機能フラグ・公開キー → クライアントにあってよい
- API シークレット・署名鍵・管理者トークン → **置かない**

xcconfig / Info.plist / ソースリテラルのどれであっても、クライアントに焼いた値は秘密ではない。
秘密を要する処理が必要になったら、それはクライアントに置けない処理である。
**実装を止めて報告する**（自分でサーバ側の設計を決めない）。

---

## 5. 依存を足す境界

**Swift Package や CocoaPods / SPM 製品依存を勝手に追加しない。**

追加はビルド・審査・既存の解決済みバージョンに影響する。
コンパイルが通ったことは、依存追加の承認にはならない。

依存の追加が必要になったら、**何を・なぜ足したいかを報告して止める。**
すでにプロジェクトに入っている依存を使う分には制限しない。

ネットワークの標準は **`URLSession` + `async/await`** とする（[dataflow.md](../frontend/dataflow.md)）。
別クライアントを既定にするプロジェクトは、そのプロジェクトの `CLAUDE.md` に宣言する。

---

## ✅ 返す前チェックリスト

- [ ] lint / format コマンドを通したか
- [ ] `!` / `try!` / `as!` を緑化のために足していないか
- [ ] 新規コードに Combine を増やしていないか
- [ ] UI state を持つ ViewModel に `@MainActor` が付いているか
- [ ] 1 Feature 専用の型を `Shared/` に上げていないか
- [ ] 秘密になりうる値をクライアント成果物に埋め込んでいないか
- [ ] 新規の外部依存を無断で追加していないか
