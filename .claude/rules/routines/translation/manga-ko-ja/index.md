# 📖 manga-ko-ja — カタログ（韓国語漫画 → 日本語 翻訳チェックの型）

> 韓国語で描かれた漫画（ウェブトゥーン等）を日本語に翻訳し、**最終的に人間が必ずチェックする**前提で、
> そのチェックコスト（脳の疲労・時間）を最小化するための型。**なぜ・何を**の SSOT をここに置く。
> 実行手続き（パイプライン）は skill [translate-manga-ko-ja](../../../../skills/translate-manga-ko-ja/SKILL.md) が担う。
> あなた（AI）は、タスクの局面に関係する葉だけを開くこと。

- **[全体像・思想](overview.md)** → `overview.md` ★最初に読む
  前提思想（物語理解が翻訳の前提）・フォルダ構成（作品共通の脳 × 話数ごとの作業場）・チェックコスト最小化（全行を等しく読ませない）。この型の不変の核＋着手前チェックリスト。

- **[master/ の補助ドキュメント書式](master-format.md)** → `master-format.md`
  作品共通の「脳」の書式。story.md（作品理解）・characters.md（口調定義表）・glossary.md（確定訳）。
  master をブートストラップ／読み込むとき（skill Stage 1）に開く。

- **[対訳チェックシートの厳格フォーマット](script-format.md)** → `script-format.md`
  `review/script.md` の必須フォーマット（ID・信頼度・用語 の列）と ⚠ 理由コード。精読すべき行へ人間の注意を誘導する本体。
  対訳シートを生成するとき（skill Stage 3）に開く。

- **[韓→日 レジスターの写像](register.md)** → `register.md`
  敬語体系・一人称/二人称・擬音擬態語を日本語口調へ写す判断基準（誤訳の温床）。
  訳文を起こすとき（skill Stage 2）に開く。

- **[増分更新・一貫性の担保](consistency.md)** → `consistency.md`
  master を黙って書き換えない（差分提案）・連載での一貫性（用語/口調のブレ検出）。
  master 更新提案・一貫性レビューをするとき（skill Stage 4・5）に開く。

> **原則:** 1 葉 = 1 関心事。詳細は各ファイルに閉じ込める。まず [overview.md](overview.md) を読み、局面ごとに該当葉を開く。
