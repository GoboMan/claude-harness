# 📦 enforcement — 層依存の機械化（deptrac / dependency-cruiser）

> レイヤー間の**許可される依存方向を宣言し、逆流・層飛ばしを弾く**。設計を助言するのでなく「決めた境界を破ったら止める」強制。
> config 生成・`scripts` 追加は [setup-idempotency.md](../setup-idempotency.md) に従う（既存 `arch:check` を clobber しない）。

## 層は押し付けず検出・ヒアリングする

依存強制はフォルダ構成に強く依存する。**固定の層を仮定しない。** まず構成を調べ、実際の層と許可したい依存方向（隣接のみ／下位すべて／層飛ばし可否）をユーザーに確認する。既存違反が大量に出たら「今直す/一旦 warn に下げ段階移行」を確認（黙って除外しない）。

## PHP — deptrac

依存（Composer・devDependency）: `qossmic/deptrac-shim`。composer script: `"arch:check": "deptrac analyse --fail-on-uncovered"`。

`deptrac.yaml`（**実ディレクトリに置き換える**。`ruleset` は許可先だけ列挙＝列挙外は違反）:

```yaml
deptrac:
  paths:
    - ./src
  layers:
    - name: Controller
      collectors:
        - type: directory
          value: src/controller/.*
    - name: Service
      collectors:
        - type: directory
          value: src/service/.*
    - name: Repository
      collectors:
        - type: directory
          value: src/repository/.*
    - name: Domain
      collectors:
        - type: directory
          value: src/domain/.*
  ruleset:
    Controller:
      - Service
    Service:
      - Repository
      - Domain
    Repository:
      - Domain
    Domain: ~   # 何にも依存しない
```

`--fail-on-uncovered` で「どの層にも属さないファイル」も検出し、宣言漏れを塞ぐ。

## JS/TS — dependency-cruiser

依存: `dependency-cruiser`。npm script: `"arch:check": "depcruise src"`。

`.dependency-cruiser.js`（各層は自分より下位にのみ依存可。逆流を error）:

```js
const layers = ["view", "screenmodel", "usecase", "service", "repository", "domain"];
const forbidden = layers.map((layer, i) => ({
  name: `no-${layer}-to-upper`,
  severity: "error",
  from: { path: `^src/${layer}/` },
  to: { path: `^src/(${layers.slice(0, i).join("|")})/` },
}));
module.exports = {
  forbidden: [
    ...forbidden,
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: { doNotFollow: { path: "node_modules" }, tsConfig: { fileName: "tsconfig.json" } },
};
```

## 他言語

- Python → `import-linter`（`.importlinter` の `layers` コントラクト、`lint-imports`）
- Java/Kotlin → `ArchUnit`（`layeredArchitecture()` DSL、テストとして実行）
- どの言語も「層と許可方向を宣言 → フック/CI で強制」の構図は同じ。

## ゲート接続

`arch:check` を [hooks.md](./hooks.md)（pre-commit）と [ci.md](./ci.md)（CI）に繋ぐ。CI は回避不能なので最低でも CI で走らせる。

## ✅ チェックリスト

- [ ] 層とディレクトリが実態に一致
- [ ] `arch:check` が現状コードで通る（既存違反は対応方針を合意）
- [ ] 逆流（例 domain→service）が error で弾かれる
- [ ] 静的解析の限界（DI/文字列動的 import は追えない）を認識している
