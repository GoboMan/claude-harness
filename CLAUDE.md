# CLAUDE.md — claude-harness 自体の開発ガイド

このリポジトリは **オンデマンド型ルーティング（Prompt as Code）の共通プロンプト** である。  
ここで触るのは「アプリの業務コード」ではなく、**AI が必要な瞬間だけルールをロードするための配線（`.claude/`）** である。

思想・ディレクトリ地図・導入手順の全文は [`README.md`](./README.md)。本ファイルは **harness を改修・拡張するときの作業指針**だけを載せる。

---

## 0. このリポジトリでやってはいけないこと

- **常駐ゼロを崩さない。** `index.md` やカタログ目次を復活させない。`settings.json` に自動注入を足さない（現状 `{}`）。
- **プロジェクト固有の逸脱をここに書かない。** 共有 harness は汎用のみ。案件ごとの事実は、取り込み先プロジェクトの `CLAUDE.md` へ。
- **同じ知識を二重化しない。** 書式の SSOT は 1 箇所（rules の葉・`templates/` のテンプレート・または生成する agent body）。skill に craft / 書式をコピペしない。docs 成果物の書式はテンプレートが正で、spec-lint は必須項目をテンプレートから導出する（lint 側に書式を再記述しない）。
- **`.cursor/` を手で編集しない。** Cursor 射影は生成物。直すなら `.claude/` を直し `./init.sh cursor`（または `.claude/tools/cursor-sync/sync.sh`）で再生成。

---

## 1. 統治ルール（改修前に必ず確認）

> **ある階層の `.md` ＝ その抽象度のルール／サブフォルダ ＝ さらに具体化した特殊化。深いほど具体的。**  
> **ツリーの軸は「種類(kind)」であって「プロジェクト」ではない。**

| 原則 | 意味 |
| --- | --- |
| 常駐ゼロ | ベースラインに載るルールは 0。発見は `paths` ゲートと skill 起動だけ |
| 3木揃え | 手続きキー `<key>` は `skills/<key>`・`agents/<key>`・`rules/<key>` で同名 |
| 作る ≠ 判定する | producer と oracle/reviewer/attacker/judge は別 agent・別コンテキスト |
| skill = 回し方 | orchestrator の判断核・台本のみ。型は rules／templates、craft は agent body |
| 参照は rules → skill の一方通行 | **葉は skill を参照してよい**（「手続きの正本は skill §X」）。**skill は葉の本文を知らない**——見てよいのは配送に要るメタ情報（ディレクトリ位置・ファイル名・`paths:`）だけで、本文の要約・抜粋・節番号を skill に書かない。規約の中身を知るのは**葉を渡された agent** であって、配る側ではない |

**orchestrator 変種の例外:** 台本だけ薄い別入口（例: `skills/develop-light`、`skills/attack`）は、agents / rules を親キー（`develop`）と共用してよく、フル3木を新設しない。craft・規約の二重化を避ける。

---

## 2. 何をどこに置くか（迷い用の早見）

| 置きたいもの | 置き場所 | ロード契機 |
| --- | --- | --- |
| 規約・書式・型（関心ごと 1 葉） | `rules/<key>/.../<leaf>.md` | 葉の `paths:` にマッチしたファイルを触った時 |
| 手続きの入口・orchestrator 台本 | `skills/<name>/SKILL.md` | `/name` または `description` 自動起動 |
| 専門サブエージェントの人格・craft（書き方の判断規則） | `agents/<key>/<name>.md` | orchestrator が Task 起動した時だけ |
| docs 成果物の雛形（書式の SSOT。spec-lint が必須項目を導出） | `templates/<key>/<name>.(md\|yaml)` | producer が雛形として Read した時 |
| 実行アセット（lint・射影スクリプト） | `tools/<name>/` | producer / init が直接叩く時 |
| 導入・更新・Cursor 射影 | ルートの `init.sh` | 人間が明示実行 |

**skill の階層制約:** Claude Code は `skills/<name>/SKILL.md` の 1 階層しか探索しない。ネストさせない。

---

## 3. 拡張チェックリスト

### 3.1 葉（rules）を足す

1. 階層を決める: `rules/<scene>/<platform>/<framework>/<concern>.md`（例: `develop/web/crow/common/coding.md`）。framework の中でレイヤ（`common` / `frontend` / `backend`）に分かれるなら、その 1 段を挟んでよい（深いほど具体的）。**レイヤ側の葉は共通側への差分だけを持ち、共通ルールを写さない。**
   platform／framework 層を持つ scene（`develop` 等）では、**全 platform・全 framework に等しく効く関心事に限り scene 直下（`rules/<scene>/<concern>.md`）に置いてよい**（例: コード内コメントの規約）。platform 層を持たない scene（`translate-manga-ko-ja` 等）は直下がそのまま葉の住所である。この位置の葉は develop skill §6-A が framework 判定と無関係に必ず列挙するので、**`paths:` の被覆が落ちるとその葉だけ配送されなくなる**——framework を足したら被覆も更新する。それ以外を直下に置かない。

**ファイル名は人間向けの目印にすぎない。配送先を決めるのは `paths:` である。**
何をどう分割し何と名付けるかは rules 側の自由で、develop skill はファイル名の意味を知らない（§1 一方通行）。
慣例として `coding.md`（プロダクションコードの記法）／`testing.md`（テストの書き方）／`db.md`（DB 設計）を使うが、
**この名前に配送上の効力は無い。**
2. **frontmatter の `paths:` が配送契約である。** ここに書いた glob にマッチするファイルを**書く** producer だけが、その葉を受け取る（develop skill §6-B）。したがって:
   - **その葉を読ませたい相手が「書く」住所を、過不足なく `paths:` に列挙する。**
     テストの書き方なら**テストファイル**の glob、DB 設計なら**DB 設計 SSOT** の glob、プロダクションコードの記法ならその**コードの住所**。
   - **その葉が実際に効く住所まで絞る。** framework 全体を指す広い glob（`**/<fw>_*/**`）を書いてよいのは、**全住所に効く葉だけ**（共通スタイル・レイヤの核）。
     住所固有の葉を広い glob のままにすると、無関係なファイルを触っただけで全葉がロードされ、分割した意味が消える。
   - **逆に絞りすぎると配送されない。** 「テスト規約なのに `paths:` がプロダクションコードだけ」なら test-designer に届かない。
     `paths:` は Claude Code の自動ロード契機であると同時に、**誰に渡すかの宣言**でもある。
3. **1 葉 = 1 関心事**（coding / testing / db …）。overview は入口リンクだけ。
4. レイヤの葉が複数に割れたら、**そのレイヤの `coding.md` を「核＋住所→葉の索引」にする**
   （境界・不変則だけを持ち、住所固有の話は各葉へ）。**索引は葉の側の持ち物**である——
   skill は葉の本文を読まないので（§1 一方通行）、配送の絞り込みは各葉の `paths:` だけで決まるように書く。
5. **他レイヤへ実装を委任する関係は、委任先の葉の `paths:` に当該住所を含めて宣言する。**
   本文に「○○は他レイヤの `coding.md` を見よ」と書くだけでは配送に効かない（skill は本文を読まない）。
6. 目次への追記は不要（存在しない）。

```yaml
#	全住所に効く葉（共通スタイル・レイヤの核）
---
paths:
  - "**/crow3_*/**"
---

#	住所固有の葉（例: Domain 側だけ・SQL だけ）
---
paths:
  - "**/crow3_*/app/classes/**"
---
```

### 3.2 手続き（skill + agents + rules）を足す

1. キー名 `<key>` を決め、**3木を同名で生やす**。
2. `skills/<key>/SKILL.md` … orchestrator の不変則・フロー・委譲先だけ。
3. `agents/<key>/*.md` … producer / oracle を分離。書式リファレンスは生成する agent body に内包。
4. `rules/<key>/**` … paths ゲートで遅延ロードする型。
5. skill 本文から agent パスを相対で指す（絶対パスや他プロジェクト前提を書かない）。

**orchestrator 変種だけ足す場合**（例: `develop-light`）: 新しい agents / rules ツリーは作らず、親キーの agents を Task から参照する薄い `skills/<variant>/SKILL.md` だけを足す。親 skill へ交差参照を置き、ゲート免除の逃げ道にしない。

### 3.3 agent frontmatter の型

```yaml
---
name: <unique-name>          # Cursor 射影時の識別子にもなる
description: <起動条件が分かる一文>
tools: Read, Write, ...      # 必要最小。oracle は read-only に寄せる
model: opus | inherit        # Claude Code 向けの既定ヒント。下記の割り当て規則に従う。Cursor 射影では inherit に正規化され、起動時選択が正
---
```

- producer: 入力契約 → craft → 出力契約。自己承認（`fixed` 化）しない。
- oracle / attacker / judge / reviewer: **不整合・欠陥の摘発**が任務。一致確認で満足しない。原則修正しない。

**`model:` の割り当て規則（機械オラクルの有無で切る）**

| ゾーン | 該当 | Claude Code `model:` | Cursor（Task 起動時） | 理由 |
| --- | --- | --- | --- | --- |
| 判断ゾーン（機械で反証できない） | ssot-definer / db-designer / contract-author / test-designer / adr-writer / slice-reviewer、および全 oracle・attacker・judge | `opus` | orchestrator がタスクに合わせて上位モデルを選ぶ | 下流全部の拠り所になる成果物。ここの劣化は「正しく間違った実装」を生む |
| 決定論ゾーン（機械オラクルがある） | 実装 producer 3体 / skeleton-runner / committer | `inherit` | 軽量寄りまたは `inherit` でよい | テスト・ビルドが合否を決めるのでモデル差が最終品質に出にくい |

> **特定の model slug（`sonnet` や Cursor 固有名）を harness にベタ書きしない。** 共有 harness が取り込み先の予算・モデルカタログまで縛ってしまうため（§0）。Cursor では射影が `inherit` になるので、**orchestrator が Task 起動のたびゾーンとタスク性質に応じて選ぶ**（台本の正は develop skill §5）。Claude Code では agent frontmatter の `opus`／`inherit` が既定として効く。

---

## 4. 改修時の作業フロー（この repo での開発）

1. **変更対象の SSOT を特定する**（rules 葉 / skill / agent body / tools / `init.sh` / `README.md`）。
2. **二重化が起きないか確認する**（同じ書式が skill と agent と rules に散らばっていないか）。
3. 変更後、関連 README 節・コメント・他 agent からの参照パスが切れないか目視する。
4. Cursor 併用を触った／rules・skills・agents を変えたら、取り込み先または検証用に射影を再生成:
   ```bash
   ./init.sh cursor .
   # または
   .claude/tools/cursor-sync/sync.sh .claude .cursor
   ```
5. submodule 利用者向けに壊さない変更なら、必要に応じて **`v*` リリースタグ**を切る（`init.sh update` がタグ単位で追従するため）。

---

## 5. 検証の当たり所

| 変更内容 | 最低限の確認 |
| --- | --- |
| rules 葉 | `paths:` の有無・glob の妥当性・1 関心事か |
| skill | description が起動トリガーになるか／orchestrator が自分でコードを書かない指示があるか |
| agent | producer≠oracle 分離／入力・出力契約が明示されているか／`model:` が §3.3 の割り当て規則どおりか（`sonnet` ベタ書きが無いか） |
| cursor-sync | `paths`→`globs`・`alwaysApply: false`・`model: inherit`・GENERATED マーカ |
| templates | 1 成果物 1 テンプレート／プレースホルダが `F-000`・`YYYY-MM-DD`・`<...>` に統一されているか／spec-lint の導出（必須セクション・必須 `x-` キー）が壊れないか |
| spec-lint | `.claude/tools/spec-lint/README.md` の使い方に沿い、producer が直接叩けること。書式はテンプレートから導出し、lint 側に再記述しない |
| gate-hook | 常設にしない（設置は取り込み先の settings.local.json・任意有効化）／docs・`.claude` 配下を塞がない／ブロック理由が develop skill §2 の戻り先を示すこと |
| init.sh | install / update / cursor のヘルプと README の記述が一致しているか |

アプリの業務テストはこのリポジトリの主対象ではない。**配線の一貫性・常駐ゼロ・3木の整合**が品質の軸である。

---

## 6. 読む順（迷ったとき）

1. 本ファイル（作業指針）
2. [`README.md`](./README.md)（思想・地図・導入）
3. 触る対象だけを開く:
   - 手続きを変える → 該当 `skills/<key>/SKILL.md`
   - craft/書式を変える → 該当 `agents/<key>/*.md`
   - framework 規約を変える → 該当 `rules/.../*.md`
   - 射影を変える → `.claude/tools/cursor-sync/sync.sh`
   - 導入を変える → `init.sh`
