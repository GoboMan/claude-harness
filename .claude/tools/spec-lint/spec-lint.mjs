#!/usr/bin/env node
//
//  spec-lint — docs SSOT のフォーマット / ライフサイクル検証（harness 同梱ツール）
//
//  検証対象のレイアウト（1 機能 1 ディレクトリ）:
//    docs/PRD.md                             【任意】Why / スコープ / 横断業務原則
//    docs/design.md                          【任意】How の現在形
//    docs/specs/specs.md                     台帳（全機能一覧・工程列）
//    docs/specs/_shared/components.yaml      契約の共有語彙（$ref 先）
//    docs/specs/F-xxx-<slug>/spec.md         機能詳細（SSOT・GWT）
//    docs/specs/F-xxx-<slug>/api-contract.yaml  処理インターフェース契約（OpenAPI 3.1）
//
//  書式の SSOT は .claude/templates/develop/ のテンプレート。本ツールは
//  spec.md の必須セクション・必須フロントマター・契約の必須 x- キーを
//  テンプレートから導出する（書式改定はテンプレートを直せば lint も追従する）。
//
//  使い方:
//    node spec-lint.mjs validate [--docs docs]      全 docs を検証（フォーマット＋不変条件）
//    node spec-lint.mjs gate --message <file>       commit メッセージの Feature: トレーラを検証
//    node spec-lint.mjs gate --feature F-001         指定機能が fixed か検証
//
//  終了コード: 0=OK / 1=違反あり / 2=使い方エラー
//

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"templates",
	"develop",
);

const SENTINELS = ["F-000", "YYYY-MM-DD"];
const DIR_RE = /^F-\d+-[a-z0-9-]+$/;

//  --- 肥大の閾値（本ツールが唯一の SSOT。producer craft に数値を書き写さない）---
//  spec.md は 1 スライスで producer / oracle の 9 箇所が全文を読むため、分量は
//  そのまま全エージェントのコンテキスト＝コストになる。書き手（ssot-definer）は
//  数を数えず、validate の warn がゼロになるまで削ることで予算を守る。
//  spec の本体は「業務ルール」（規則）で、「受け入れ条件」はそれだけでは解釈が
//  割れる箇所に置く代表例。ケースの網羅は test-designer の職務なので、GWT の
//  予算は規則より小さい（規則 1 本 → テスト N 本が正常な比率）。
const MAX_SPEC_CHARS = 12000; //  spec.md 本文の文字数（行数では 1 行 1,000 字の肥大を見逃す）
const MAX_RULE_BULLETS = 30; //  業務ルールの本数（1 規則 1 文）
const MAX_RULE_CHARS = 150; //  規則 1 本の長さ（超えるのは複数規則の圧縮）
const MAX_GWT_BULLETS = 15; //  受け入れ条件の本数（規則を補う代表例のみ。テストケース一覧ではない）
const MAX_CROSS_REFS = 20; //  自機能以外の F-xxx 参照の総数（複製の密度）
const MAX_CONTRACT_LINES = 400; //  契約 YAML は 1 行 1 キーの ASCII なので行数で測る

//  --- 収集した違反 ---
const errors = [];
const warns = [];
const err = (file, msg) => errors.push({ file, msg });
const warn = (file, msg) => warns.push({ file, msg });

//  --- パーサ ---
function parseFrontmatter(text) {
	const lines = text.split(/\r?\n/);
	if (lines[0] !== "---") return { data: {}, body: text, hasFm: false };
	const data = {};
	let i = 1;
	for (; i < lines.length; i++) {
		if (lines[i] === "---") {
			i++;
			break;
		}
		const m = lines[i].match(/^([^:]+):\s*(.*)$/);
		if (m) {
			//  行末の "# コメント" を除去
			const val = m[2].replace(/\s+#.*$/, "").trim();
			data[m[1].trim()] = val;
		}
	}
	return { data, body: lines.slice(i).join("\n"), hasFm: true };
}

function getSections(body) {
	const secs = [];
	let cur = null;
	for (const line of body.split(/\r?\n/)) {
		const m = line.match(/^##\s+(.*)$/);
		if (m) {
			cur = { title: m[1].trim(), lines: [] };
			secs.push(cur);
		} else if (cur) {
			cur.lines.push(line);
		}
	}
	return secs;
}

const sectionFilled = (sec) => sec.lines.some((l) => l.trim().length > 0);
const findSection = (body, test) => getSections(body).find((s) => test(s.title));

//  マークダウン表の1列目（＝名前列）を拾う。ヘッダ行・区切り行は位置で除外。
function tableFirstColumn(lines) {
	const names = [];
	let seenHeader = false;
	for (const line of lines) {
		const t = line.trim();
		if (!t.startsWith("|")) continue;
		const cells = t
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim());
		const first = cells[0] || "";
		if (/^:?-{2,}:?$/.test(first)) continue; //  区切り行
		if (!seenHeader) {
			seenHeader = true; //  最初の非区切り行＝ヘッダ
			continue;
		}
		if (!first) continue;
		names.push(first);
	}
	return names;
}

//  入力名/リクエスト名の突き合わせ用に正規化（crow の i_ 接頭辞を吸収）
const normName = (n) =>
	n.replace(/`/g, "").trim().replace(/^i_/, "").toLowerCase();

//  --- テンプレートからの書式導出（fallback はテンプレート欠落時のみ）---
function deriveSpecFormat() {
	const file = join(TEMPLATE_DIR, "spec.md");
	const fallback = {
		fmKeys: ["機能ID", "機能名", "ステータス", "更新日"],
		sections: ["目的", "アクター・権限", "入力", "出力", "状態", "受け入れ条件", "業務ルール"],
	};
	if (!existsSync(file)) return fallback;
	const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
	const fmKeys = Object.keys(data);
	//  見出しの先頭語（空白・括弧の前まで）を必須セクションのキーとする
	const sections = getSections(body).map((s) => s.title.split(/[\s（(]/)[0]);
	if (fmKeys.length === 0 || sections.length === 0) return fallback;
	return { fmKeys, sections };
}

function deriveContractKeys() {
	const file = join(TEMPLATE_DIR, "api-contract.yaml");
	const fallback = ["x-feature-id", "x-status", "x-spec", "x-updated"];
	if (!existsSync(file)) return fallback;
	const keys = [];
	for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
		const m = line.match(/^(x-[\w-]+):/);
		if (m) keys.push(m[1]);
	}
	return keys.length > 0 ? keys : fallback;
}

//  --- 共通チェック ---
function checkSentinels(file, text, status) {
	if (status !== "fixed") return;
	for (const s of SENTINELS) {
		if (text.includes(s))
			err(file, `fixed なのにテンプレのプレースホルダが残っている: "${s}"`);
	}
	const angle = text.match(/<[^>\n]{1,40}>/g) || [];
	for (const a of angle) {
		//  <機能名> のような全角含みプレースホルダのみ（HTML タグ等は対象外）
		if (/[^\x00-\x7F]/.test(a)) {
			err(file, `fixed なのにプレースホルダが残っている: "${a}"`);
			break;
		}
	}
}

function checkStatus(file, s, label = "ステータス") {
	if (!s) {
		err(file, `${label} が無い`);
		return null;
	}
	if (s !== "draft" && s !== "fixed")
		err(file, `${label} は draft|fixed のいずれか。実際: "${s}"`);
	return s;
}

function checkRequiredFm(file, data, keys) {
	for (const k of keys) {
		if (!data[k] || data[k].length === 0) err(file, `フロントマター "${k}" が空/欠落`);
	}
}

function checkSections(file, body, required, status) {
	const secs = getSections(body);
	for (const key of required) {
		const found = secs.find((s) => s.title.startsWith(key));
		if (!found) {
			err(file, `必須セクション "${key}" が無い`);
		} else if (status === "fixed" && !sectionFilled(found)) {
			err(file, `fixed なのにセクション "${key}" が空`);
		}
	}
}

//  --- docs 衛生（負のリスト混入の検出。SSOT は各 producer craft）---
//  すべて warn（既存プロジェクトの validate を err で即死させない）。
function checkHygiene(file, body, kind, opts = {}) {
	const lines = body.split(/\r?\n/);

	//  1) 冒頭ナラティブ: 最初のセクションまでの blockquote 群（改訂差分の堆積痕）
	if (kind === "spec") {
		let preambleQuotes = 0;
		for (const line of lines) {
			if (/^##\s/.test(line)) break;
			if (line.trim().startsWith(">")) preambleQuotes++;
		}
		if (preambleQuotes > 3)
			warn(
				file,
				`冒頭に blockquote が ${preambleQuotes} 行（改訂経緯は commit message、理由・実測は ADR へ。本文は現在形に統合する）`,
			);
	}

	//  2) 本文中の日付括弧: 「（2026-07-26 改訂）」のような経緯の追記痕
	const dates = body.match(/[（(]\d{4}-\d{2}-\d{2}/g) || [];
	if (dates.length > 0)
		warn(file, `本文中に日付括弧の経緯記述が ${dates.length} 件（経緯は git が持つ。本文は現在形に統合する）`);

	//  3) 実装アンカー: コード側ファイルへのパス／行番号参照（コードが SSOT）
	const anchorRe =
		kind === "spec"
			? /[\w./-]+\.(php|js|ts|jsx|tsx|sql|mjs|cjs|py|rb|go|java)\b(:\d+(-\d+)?)?/g
			: /[\w./-]+\.(php|js|ts|jsx|tsx|sql|mjs|cjs|py|rb|go|java)\b:\d+(-\d+)?/g;
	const anchors = body.match(anchorRe) || [];
	if (anchors.length > 0)
		warn(file, `実装アンカーが ${anchors.length} 件（例: ${anchors[0]}）— コードが SSOT。docs に書かない`);

	if (kind === "spec") {
		//  4) framework 内部 API への言及（クラス::メソッド 形式）
		const scopeRefs = body.match(/\w+::\w+/g) || [];
		if (scopeRefs.length > 0)
			warn(
				file,
				`内部 API 参照が ${scopeRefs.length} 件（例: ${scopeRefs[0]}）— spec は観測可能な振る舞いの語彙で書く`,
			);

		//  5) 未決の堆積セクション（fixed spec に未決を溜めない）
		for (const s of getSections(body)) {
			if (/既知の課題|残存リスク|バックログ/.test(s.title))
				warn(file, `セクション「${s.title}」— 未解決論点・リスクは issue 管理へ排出する`);
		}
	}

	if (kind === "contract") {
		//  4c) 業務ルールの契約への書き戻し（MIS 逸脱の煙探知機）
		const dumpKeys =
			body.match(
				/^\s+x-(state-transition|evaluation-order|error-catalog|business-rule|internal-labels)\b/gm,
			) || [];
		if (dumpKeys.length > 0)
			warn(
				file,
				`業務ルール再掲らしき x-* が ${dumpKeys.length} 件（例: ${dumpKeys[0].trim()}）— 規則・判定順序は spec.md。契約は境界の形だけ`,
			);

		//  5c) description 肥大（info/operation の長文。短い response description は許容）
		const longDescs = countLongDescriptions(lines);
		if (longDescs > 0)
			warn(
				file,
				`長い description が ${longDescs} 件（8 行超または 200 字超）— 目的・規則・UI 説明は spec.md。契約は summary 1 行と短い注記のみ`,
			);
	}

	//  6) 肥大の煙探知機
	//
	//  行数では測らない。1 行 1,000 文字の spec が「358 行」で閾値をすり抜け、
	//  下流の全エージェント（spec.md は 1 スライスで 9 箇所が読む）のコンテキストを
	//  食い潰した実例があるため、spec は分量そのもの＝文字数で測る。
	//  契約 YAML は 1 行 1 キーの ASCII なので行数が実効的な尺度のまま。
	if (kind === "spec") {
		const chars = body.length;
		if (chars > MAX_SPEC_CHARS)
			warn(
				file,
				`本文が ${chars} 文字（${MAX_SPEC_CHARS} 文字超）— 1 関心事を超えた堆積の疑い。spec.md は下流の全 producer / oracle が全文を読むため、肥大はそのまま全エージェントのコンテキストになる（負のリスト該当を排出する）`,
			);

		//  6-1) 規則と代表例の本数。
		//       最上位の箇条書きだけを数える（ネストは 1 つの規則・観測の補足であって
		//       独立した項目ではない）。ネストへの逃避は文字数の閾値が受け止める。
		const topBullets = (sec) =>
			sec ? sec.lines.filter((l) => /^[-*]\s+\S/.test(l)).length : 0;

		const ruleSec = findSection(body, (t) => /業務ルール/.test(t));
		const rules = topBullets(ruleSec);
		if (rules > MAX_RULE_BULLETS)
			warn(
				file,
				`業務ルールが ${rules} 本（${MAX_RULE_BULLETS} 本超）— 1 機能の不変条件として過大。機能が大きすぎる疑い（分割を検討する）`,
			);

		//  本数の上限は、規則を段落で書けば簡単に迂回できる。1 規則 1 文を
		//  守らせるため 1 本あたりの長さも見る（長い規則は複数の規則の圧縮）。
		if (ruleSec) {
			const long = ruleSec.lines
				.filter((l) => /^[-*]\s+\S/.test(l))
				.map((l) => l.length)
				.filter((n) => n > MAX_RULE_CHARS);
			if (long.length > 0)
				warn(
					file,
					`業務ルールに ${MAX_RULE_CHARS} 文字超の規則が ${long.length} 本（最長 ${Math.max(...long)} 文字）— 1 規則 1 文になっていない。複数の規則が 1 本に圧縮されていると、どれが破れたのか判定できない（文型はテンプレート templates/develop/spec.md 参照）`,
				);
		}

		//  受け入れ条件は規則を補う代表例であって、テストケースの一覧ではない。
		//  本数の膨張は、規則の言い換え・値違いの列挙・欠陥ごとの 1 本追加の堆積。
		const gwt = topBullets(findSection(body, (t) => /受け入れ条件|GWT/.test(t)));
		if (gwt > MAX_GWT_BULLETS)
			warn(
				file,
				`受け入れ条件が ${gwt} 本（${MAX_GWT_BULLETS} 本超）— 受け入れ条件は業務ルールだけでは解釈が割れる箇所に置く代表例であり、テストケースの一覧ではない。規則の言い換え・値違いの列挙が混ざっていないか（ケースの網羅は test-designer の職務）`,
			);

		//  6-2) 他機能への参照密度: 「F-011 に準拠」と書いた上で振る舞いも書く、
		//       という複製が起きると 1 機能の spec に他機能の spec が写り込む。
		//       参照そのものは正しいので、密度だけを見る。
		const selfId = opts.selfId || "";
		//  ID の桁数は DIR_RE 同様に固定しない（F-001 / F-0001 どちらの採番でも効く）
		const refs = (body.match(/F-\d+/g) || []).filter((r) => r !== selfId);
		if (refs.length > MAX_CROSS_REFS) {
			const top = [...new Set(refs)].slice(0, 3).join(" / ");
			warn(
				file,
				`他機能への参照が ${refs.length} 件（${MAX_CROSS_REFS} 件超。例: ${top}）— 参照先の振る舞いを複製していないか。共有される振る舞いは所有機能の spec だけが持ち、ここは参照 1 行に留める`,
			);
		}
	} else if (lines.length > MAX_CONTRACT_LINES) {
		warn(
			file,
			`本文が ${lines.length} 行（${MAX_CONTRACT_LINES} 行超）— 1 関心事を超えた堆積の疑い（負のリスト該当を排出する）`,
		);
	}
}

//  YAML の description: ブロック／インラインが長い件数を数える（依存ゼロの行スキャン）
function countLongDescriptions(lines) {
	let count = 0;
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(/^(\s*)description:\s*(.*)$/);
		if (!m) continue;
		const indent = m[1].length;
		const rest = m[2].replace(/\s+#.*$/, "").trim();
		if (rest === ">" || rest === ">-" || rest === "|" || rest === "|-") {
			let blockLines = 0;
			let blockChars = 0;
			for (let j = i + 1; j < lines.length; j++) {
				const line = lines[j];
				if (line.trim() === "") {
					blockLines++;
					continue;
				}
				const ind = line.match(/^(\s*)/)[1].length;
				if (ind <= indent) break;
				blockLines++;
				blockChars += line.trim().length;
			}
			if (blockLines > 8 || blockChars > 200) count++;
		} else if (rest.length > 200) {
			count++;
		}
	}
	return count;
}

//  --- spec.md の検証 ---
function validateFeatureSpec(file, text, fmt) {
	const { data, body } = parseFrontmatter(text);
	checkRequiredFm(file, data, fmt.fmKeys);
	const status = checkStatus(file, data["ステータス"]);
	checkSections(file, body, fmt.sections, status);
	checkSentinels(file, text, status);
	checkHygiene(file, body, "spec", { selfId: data["機能ID"] || "" });
	//  状態セクションにハッピーパス以外が含まれるか（fixed のみ・警告）
	const states = findSection(body, (t) => t.startsWith("状態"));
	const statesText = states ? states.lines.join("") : "";
	if (status === "fixed" && states) {
		for (const kw of ["error", "empty", "権限"]) {
			if (!statesText.includes(kw))
				warn(file, `状態に "${kw}" 系の記述が見当たらない（テンプレート templates/develop/spec.md 参照）`);
		}
	}
	const inputSec = findSection(body, (t) => t.startsWith("入力"));
	const inputs = inputSec ? tableFirstColumn(inputSec.lines) : [];
	//  入力表に型・必須・制約列があると契約との二重化（MIS 逸脱）
	if (inputSec) {
		for (const line of inputSec.lines) {
			const t = line.trim();
			if (!t.startsWith("|")) continue;
			if (/\|.*型.*\|/.test(t) || /必須/.test(t) || /制約/.test(t)) {
				warn(
					file,
					`入力表に型・必須・制約列がある — 型情報の正は api-contract.yaml。spec の入力は「名前｜業務上の意味」のみ（templates/develop/spec.md）`,
				);
				break;
			}
		}
	}
	return { id: data["機能ID"] || null, status, inputs, statesText };
}

//  --- api-contract.yaml の検証（依存ゼロの行スキャン。構文の完全検証は
//      producer が redocly/spectral で行う前提で、ここではライフサイクル・
//      参照整合・spec との突き合わせに限定する）---
function topLevelYamlKeys(text) {
	const keys = {};
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(/^([\w-]+):\s*(.*)$/);
		if (m) keys[m[1]] = m[2].replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "").trim();
	}
	return keys;
}

function validateContract(file, text, dirId, xKeys) {
	const keys = topLevelYamlKeys(text);

	if (!keys["openapi"]) err(file, `トップレベル "openapi:" が無い（OpenAPI 3.1 で書く）`);
	else if (!keys["openapi"].startsWith("3.1"))
		warn(file, `openapi バージョンが 3.1 系でない: "${keys["openapi"]}"`);
	if (!/^paths:/m.test(text)) err(file, `トップレベル "paths:" が無い`);

	for (const k of xKeys) {
		if (!(k in keys) || keys[k].length === 0) err(file, `必須キー "${k}" が空/欠落`);
	}
	const status = checkStatus(file, keys["x-status"], "x-status");
	const id = keys["x-feature-id"] || null;
	if (id && dirId && id !== dirId)
		err(file, `x-feature-id "${id}" がディレクトリ名の ID "${dirId}" と不一致`);

	//  x-spec の解決
	if (keys["x-spec"]) {
		const target = join(dirname(file), keys["x-spec"]);
		if (!existsSync(target)) err(file, `x-spec が解決しない: ${keys["x-spec"]}`);
	}

	//  $ref の解決（相対ファイルの存在＋アンカー末尾キーの存在）
	for (const m of text.matchAll(/\$ref:\s*["']?([^"'\s]+)["']?/g)) {
		const ref = m[1];
		const [path, anchor] = ref.split("#");
		let targetText = text;
		if (path) {
			const target = join(dirname(file), path);
			if (!existsSync(target)) {
				err(file, `$ref のファイルが無い: ${path}`);
				continue;
			}
			targetText = readFileSync(target, "utf8");
		}
		if (anchor) {
			const leaf = anchor.split("/").filter(Boolean).pop();
			if (leaf && !new RegExp(`^\\s+${leaf}:`, "m").test(targetText))
				err(file, `$ref のアンカーが見つからない: ${ref}`);
		}
	}

	checkSentinels(file, text, status);
	checkHygiene(file, text, "contract");

	//  具体例（fixed のみ）
	if (status === "fixed" && !/^\s+examples?:/m.test(text))
		warn(file, `fixed なのに examples が無い（正常 1 件＋異常 1 件以上の実値を書く）`);

	//  異常系レスポンスの行数相当（4xx/5xx キーの検出）
	const errorResponses = (text.match(/^\s+["']?[45]\d\d["']?:/gm) || []).length;
	return { id, status, errorResponses };
}

//  --- PRD / design（任意ファイル・warn 中心）---
function validateRootDoc(file, kind) {
	if (!existsSync(file)) return;
	const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
	if (!data["ステータス"] || !data["更新日"])
		warn(file, `フロントマター（ステータス/更新日）が無い`);
	if (kind === "prd") {
		//  機能別の受け入れ条件は spec の関心事（境界の機械チェック）
		if (/Given|When|Then|受け入れ条件/.test(body))
			warn(file, `GWT/受け入れ条件らしき記述がある — 機能別の受け入れ条件は docs/specs/F-xxx/spec.md へ`);
	}
}

//  --- 台帳（specs.md）---
function parseLedgerTable(body) {
	const rows = [];
	for (const line of body.split(/\r?\n/)) {
		const t = line.trim();
		if (!t.startsWith("|")) continue;
		const cells = t
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim());
		const idm = cells[0] && cells[0].match(/F-\d+/);
		if (!idm) continue; //  ヘッダ・区切り行を飛ばす
		let link = null;
		for (const c of cells) {
			const lm = c.match(/\]\(([^)]+)\)/);
			if (lm) {
				link = lm[1];
				break;
			}
		}
		rows.push({
			id: idm[0],
			name: cells[1] || "",
			status:
				cells.find((c) => c === "draft" || c === "fixed") ||
				cells[cells.length - 1],
			link,
		});
	}
	return rows;
}

//  --- validate コマンド ---
function loadModel(docsDir) {
	const specsRoot = join(docsDir, "specs");
	const ledgerFile = join(specsRoot, "specs.md");
	const fmt = deriveSpecFormat();
	const xKeys = deriveContractKeys();

	const specs = new Map(); //  id -> { file, dir, status, inputs, statesText }
	const contracts = new Map(); //  id -> { file, status, errorResponses }
	let ledger = null;

	//  機能ディレクトリの走査（F-* のみ。specs.md / _shared は自然に対象外）
	const dirs = readdirSync(specsRoot, { withFileTypes: true })
		.filter((d) => d.isDirectory() && d.name.startsWith("F-"))
		.map((d) => d.name)
		.sort();

	for (const dir of dirs) {
		const dirPath = join(specsRoot, dir);
		const dirId = (dir.match(/^F-\d+/) || [null])[0];
		if (!DIR_RE.test(dir))
			err(dirPath, `ディレクトリ名が F-xxx-<slug>（slug は小文字ケバブ）でない`);

		const specFile = join(dirPath, "spec.md");
		if (!existsSync(specFile)) {
			err(dirPath, `spec.md が無い（機能ディレクトリには必須）`);
			continue;
		}
		const res = validateFeatureSpec(specFile, readFileSync(specFile, "utf8"), fmt);
		if (res.id && dirId && res.id !== dirId)
			err(specFile, `機能ID "${res.id}" がディレクトリ名の ID "${dirId}" と不一致`);
		const id = res.id || dirId;
		if (id) {
			if (specs.has(id))
				err(specFile, `機能ID "${id}" が重複（${specs.get(id).file} と）`);
			else specs.set(id, { file: specFile, dir, ...res });
		}

		const contractFile = join(dirPath, "api-contract.yaml");
		if (existsSync(contractFile)) {
			const c = validateContract(contractFile, readFileSync(contractFile, "utf8"), dirId, xKeys);
			if (c.id) contracts.set(c.id, { file: contractFile, ...c });
		}
	}

	//  台帳
	if (existsSync(ledgerFile)) {
		const { data, body } = parseFrontmatter(readFileSync(ledgerFile, "utf8"));
		checkRequiredFm(ledgerFile, data, ["ステータス", "更新日"]);
		checkStatus(ledgerFile, data["ステータス"]);
		ledger = parseLedgerTable(body);
		if (ledger.length === 0) warn(ledgerFile, "機能一覧テーブルに行が無い");
	} else {
		warn(ledgerFile, "台帳 specs.md が無い（テンプレート templates/develop/specs.md 参照）");
	}

	return { specs, contracts, ledger, specsRoot, ledgerFile };
}

function crossChecks(model) {
	const { specs, contracts, ledger, specsRoot, ledgerFile } = model;

	//  台帳 ↔ spec.md（状態一致・リンク整合・列挙漏れ）
	if (ledger) {
		const listed = new Set();
		for (const row of ledger) {
			listed.add(row.id);
			const spec = specs.get(row.id);
			if (!spec) {
				err(ledgerFile, `台帳の "${row.id}" に対応する機能ディレクトリが docs/specs に無い`);
				continue;
			}
			if (row.link) {
				const target = join(specsRoot, row.link.replace(/^\.\//, ""));
				if (!existsSync(target))
					err(ledgerFile, `"${row.id}" の詳細リンクが解決しない: ${row.link}`);
			}
			if (row.status !== spec.status)
				err(
					ledgerFile,
					`"${row.id}" の状態が不一致: specs.md="${row.status}" / spec="${spec.status}"`,
				);
		}
		for (const [id, spec] of specs) {
			if (!listed.has(id)) err(spec.file, `spec "${id}" が台帳 specs.md に列挙されていない`);
		}
	}

	//  契約カバレッジ: spec が fixed（＝実装に進んでよい）なのに契約が無い機能を可視化
	for (const [id, spec] of specs) {
		if (spec.status === "fixed" && !contracts.has(id))
			warn(spec.file, `${id}: spec が fixed だが api-contract.yaml が無い`);
	}

	//  contract ↔ spec（親 draft に fixed 契約は不可・入出力の相互整合）
	for (const [id, c] of contracts) {
		const spec = specs.get(id);
		if (!spec) {
			err(c.file, `契約 "${id}" に対応する spec が無い`);
			continue;
		}
		if (c.status === "fixed" && spec.status === "draft")
			err(c.file, `親 spec が draft なのに契約が fixed（先に spec を fixed にする）: ${id}`);
		crossConsistency(id, spec, c);
	}
}

//  構造整合オラクル相当（ヒューリスティック・warn）:
//  機能詳細の入力名が契約本文に現れるか／異常状態に異常レスポンスが対応するか。
function crossConsistency(id, spec, c) {
	const contractText = readFileSync(c.file, "utf8").toLowerCase();
	for (const raw of spec.inputs) {
		const n = normName(raw);
		if (!n) continue;
		if (!contractText.includes(n))
			warn(c.file, `${id}: 機能詳細の入力 "${raw}" が契約に見当たらない`);
	}
	const hasAbnormalState = /error|権限|境界/.test(spec.statesText);
	if (hasAbnormalState && c.errorResponses === 0)
		warn(c.file, `${id}: 機能詳細に異常状態があるが契約に 4xx/5xx レスポンスが無い`);
}

function cmdValidate(docsDir) {
	if (!existsSync(join(docsDir, "specs"))) {
		if (existsSync(join(docsDir, "spec"))) {
			console.error(
				`spec-lint: 旧レイアウト（${docsDir}/spec + ${docsDir}/contracts）を検出。` +
					`新レイアウト（${docsDir}/specs/F-xxx-<slug>/）へ移行するか、移行までは旧タグの harness を使う`,
			);
			return 1;
		}
		console.log(`spec-lint: ${docsDir}/specs が無いため検証をスキップ`);
		return 0;
	}
	validateRootDoc(join(docsDir, "PRD.md"), "prd");
	validateRootDoc(join(docsDir, "design.md"), "design");
	const model = loadModel(docsDir);
	crossChecks(model);
	report();
	return errors.length > 0 ? 1 : 0;
}

//  --- gate コマンド（draft なのに実装、を防ぐ） ---
function featureDir(docsDir, id) {
	const specsRoot = join(docsDir, "specs");
	if (!existsSync(specsRoot)) return null;
	const hit = readdirSync(specsRoot, { withFileTypes: true }).find(
		(d) => d.isDirectory() && (d.name === id || d.name.startsWith(id + "-")),
	);
	return hit ? join(specsRoot, hit.name) : null;
}

function gateFeature(docsDir, id) {
	const dir = featureDir(docsDir, id);
	if (!dir || !existsSync(join(dir, "spec.md"))) {
		err("gate", `${id}: 対応する spec が無い（docs/specs/${id}-<slug>/spec.md を作る）`);
		return;
	}
	const spec = parseFrontmatter(readFileSync(join(dir, "spec.md"), "utf8")).data;
	if (spec["ステータス"] !== "fixed")
		err("gate", `${id}: spec が fixed でない（draft のまま実装しない）`);
	//  契約は「存在し、かつ fixed」を要求する（契約なしのまま実装が進む事故を断つ）
	const contractFile = join(dir, "api-contract.yaml");
	if (!existsSync(contractFile))
		err("gate", `${id}: 契約が無い（${basename(dir)}/api-contract.yaml を作り fixed にする）`);
	else if (topLevelYamlKeys(readFileSync(contractFile, "utf8"))["x-status"] !== "fixed")
		err("gate", `${id}: 契約が fixed でない（draft のまま実装しない）`);
}

function cmdGate(docsDir, opts) {
	let ids = [];
	if (opts.feature) {
		ids = [opts.feature];
	} else if (opts.message) {
		if (!existsSync(opts.message)) {
			console.error(`spec-lint gate: メッセージファイルが無い: ${opts.message}`);
			return 2;
		}
		const msg = readFileSync(opts.message, "utf8");
		ids = [...msg.matchAll(/^Feature:\s*(F-\d+)/gim)].map((m) => m[1]);
		if (ids.length === 0) {
			//  トレーラ未使用はオプトイン。素通り（未強制）。
			return 0;
		}
	} else {
		console.error("spec-lint gate: --message <file> か --feature F-xxx が要る");
		return 2;
	}
	for (const id of ids) gateFeature(docsDir, id);
	report();
	return errors.length > 0 ? 1 : 0;
}

//  --- 出力 ---
function report() {
	for (const w of warns) console.warn(`  warn  ${w.file}: ${w.msg}`);
	for (const e of errors) console.error(`  ERROR ${e.file}: ${e.msg}`);
	if (errors.length === 0) console.log(`spec-lint: OK（warn ${warns.length}）`);
	else console.error(`spec-lint: ${errors.length} 件の違反`);
}

//  --- 引数 ---
function parseArgs(argv) {
	const opts = { docs: "docs" };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--docs") opts.docs = argv[++i];
		else if (argv[i] === "--message") opts.message = argv[++i];
		else if (argv[i] === "--feature") opts.feature = argv[++i];
	}
	return opts;
}

function main() {
	const [cmd, ...rest] = process.argv.slice(2);
	const opts = parseArgs(rest);
	if (cmd === "validate" || cmd === undefined) process.exit(cmdValidate(opts.docs));
	if (cmd === "gate") process.exit(cmdGate(opts.docs, opts));
	console.error("usage: spec-lint.mjs validate|gate [--docs docs] [--message f] [--feature F-001]");
	process.exit(2);
}

main();
