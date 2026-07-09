---
name: enforce-layer-boundaries
description: レイヤー間の依存方向（例 View→ScreenModel→UseCase→Service→Repository→Domain）を宣言的に定義し、逆流や層飛ばしを機械的に弾くアーキテクチャチェックをセットアップする。ユーザーがレイヤードアーキテクチャの依存ルールを強制したい、依存の逆流を防ぎたい、dependency-cruiser や eslint-plugin-boundaries / import-linter / ArchUnit を設定したい、あるいは「層の境界をCIで守りたい」場合に使用する。
---

# Enforce Layer Boundaries

レイヤー間の **許可される依存方向を規約として定義** し、それを **機械的に強制** する。依存の逆流（下位→上位）や層飛ばしがあれば確実に弾く。

これは設計を助言する `improve-codebase-architecture` / `codebase-design` とは別物。あちらは「どう設計するか」の思考支援、こちらは「決めた境界を破ったら止める」強制ゲート。

## 重要：層は押し付けず、検出・ヒアリングする

依存強制はプロジェクトのフォルダ構成に強く依存する。**固定の層を仮定しないこと。**

1. まずリポジトリの構成を調べる（`src/` 配下のディレクトリ、既存の命名）。
2. 実際の層と、許可したい依存方向をユーザーに確認する。
3. 例として提示する既定は次の一方向依存（各層は自分より下位＝右側にのみ依存してよい）:

   ```
   View → ScreenModel → UseCase → Service → Repository → Domain
   ```

   - `Domain` は何にも依存しない（最下層）
   - `View` は `Domain` を含む下位すべてに依存してよい（実運用では「隣接のみ」に絞ることも多い。ユーザーに確認）
   - 逆方向（例 `Domain → Service`）と層飛ばしの可否は必ず確認する

## 手順

### 1. スタックを検出する

- **TypeScript / JavaScript** → dependency-cruiser（既定）または eslint-plugin-boundaries
- **Python** → import-linter
- **Java / Kotlin** → ArchUnit（テストとして記述）

以降は主対象の **TS/JS + dependency-cruiser** を詳述する。他言語は末尾の「他言語」を参照。

### 2. 層とルールを確定する

上記「検出・ヒアリング」に従い、以下を確定させる。

- 層の一覧と、各層に対応するディレクトリ（glob）
- 許可する依存方向（隣接のみ / 下位すべて）
- 層飛ばしの可否

これが **規約の定義本体**になる。

### 3. dependency-cruiser を導入する

パッケージマネージャーを検出（`package-lock.json`=npm / `pnpm-lock.yaml`=pnpm / `yarn.lock`=yarn / `bun.lockb`=bun。不明なら npm）。devDependency として:

```
dependency-cruiser
```

### 4. `.dependency-cruiser.js` を生成する

確定した層構成に合わせて生成する。以下は上記の例（下位＝右側にのみ依存可。逆流を error）を実装したテンプレート。**実際のディレクトリ名に置き換えること。**

```js
// 層は上から下へ。各層は「自分より下位」にのみ依存してよい。
const layers = [
  "view",
  "screenmodel",
  "usecase",
  "service",
  "repository",
  "domain",
];

// 各層 i について、「i より上位（左側）」への依存を禁止する。
const forbidden = layers.map((layer, i) => ({
  name: `no-${layer}-to-upper`,
  comment: `${layer} は上位レイヤーに依存してはいけない（依存は下位方向のみ）`,
  severity: "error",
  from: { path: `^src/${layer}/` },
  to: { path: `^src/(${layers.slice(0, i).join("|")})/` },
}));

module.exports = {
  forbidden: [
    ...forbidden,
    {
      name: "no-circular",
      comment: "循環依存を禁止する",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
  },
};
```

> 「隣接層のみ許可（層飛ばし禁止）」にしたい場合は、`to.path` を「自分より下位すべて」ではなく「1つ下以外の下位」を禁止する形に調整する。ユーザーの選択に従うこと。

### 5. npm スクリプトを追加する

package.json に追加する。

```json
{
  "scripts": {
    "arch:check": "depcruise src"
  }
}
```

### 6. ゲートに接続する

どこで強制するかをユーザーに確認する（両方でもよい）。

- **ローカル pre-commit**（`setup-pre-commit` 導入済みなら `.husky/pre-commit` に `npm run arch:check` を追記）
- **CI / PR**（`setup-ci-checks` のワークフローに `arch:check` ステップを追加）

CI層は回避不可のため、少なくとも CI での実行を推奨する旨を伝える。

### 7. 検証する

- [ ] `.dependency-cruiser.js` が存在し、層とディレクトリが実態に一致している
- [ ] `npm run arch:check` が現状のコードで通る（既存違反があれば報告し、除外するか直すかをユーザーに確認）
- [ ] わざと逆流させた依存（例 `domain/` から `service/` を import）が error で弾かれる
- [ ] 接続先（pre-commit / CI）で実際に走る

### 8. コミットする

変更・作成した全ファイルをステージしてコミットする: `chore: enforce layer boundaries with dependency-cruiser`

## 補足

- **既存違反への対処**: 導入時点で違反が大量に出ることがある。ユーザーに「今すぐ直す / 該当を一時的に warn に下げて段階移行する」を確認する。黙って除外しないこと。
- dependency-cruiser は import の静的解析なので、DI コンテナ経由の実行時依存や文字列動的 import は追えない。境界の第一防衛線であって万能ではない旨を伝える。
- **他言語**:
  - Python → `import-linter`。`.importlinter` に `layers` コントラクトで同様の一方向依存を宣言し、`lint-imports` で検査。
  - Java/Kotlin → `ArchUnit`。`layeredArchitecture()` DSL で層と許可依存を定義し、通常のテストとして実行。
  - どの言語でも「層と許可方向を宣言 → CI/フックで強制」という構図は同じ。
