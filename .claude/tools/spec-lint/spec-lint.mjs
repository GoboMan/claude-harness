#!/usr/bin/env node
//
//  spec-lint — docs SSOT のフォーマット / ライフサイクル検証（harness 同梱ツール）
//
//  検証対象の書式は producer サブエージェントの craft（agent body）が定める:
//    agents/develop/ssot-definer.md   §A/§B  (docs/spec/features.md, docs/spec/<feature>.md)
//    agents/develop/contract-author.md 書式リファレンス (docs/contracts/<feature>.md)
//  その書式をコードに落とした実行仕様が本ファイル。
//
//  使い方:
//    node spec-lint.mjs validate [--docs docs]      全 docs を検証（フォーマット＋不変条件）
//    node spec-lint.mjs gate --message <file>       commit メッセージの Feature: トレーラを検証
//    node spec-lint.mjs gate --feature F-001         指定機能が fixed か検証
//
//  終了コード: 0=OK / 1=違反あり / 2=使い方エラー
//

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const SENTINELS = ["F-000", "YYYY-MM-DD", "<feature>"];

const SPEC_SECTIONS = [
	{ key: "目的", test: (t) => t.startsWith("目的") },
	{ key: "アクター・権限", test: (t) => t.startsWith("アクター") },
	{ key: "入力", test: (t) => t.startsWith("入力") },
	{ key: "出力", test: (t) => t.startsWith("出力") },
	{ key: "状態", test: (t) => t.startsWith("状態") },
	{ key: "受け入れ条件", test: (t) => t.startsWith("受け入れ") },
	{ key: "業務ルール", test: (t) => t.startsWith("業務") },
];

const CONTRACT_SECTIONS = [
	{ key: "エンドポイント", test: (t) => t.startsWith("エンドポイント") },
	{ key: "Request", test: (t) => /^request/i.test(t) },
	{ key: "Response（正常）", test: (t) => /^response/i.test(t) && t.includes("正常") },
	{ key: "Response（異常）", test: (t) => /^response/i.test(t) && t.includes("異常") },
	{ key: "エラーコード一覧", test: (t) => t.startsWith("エラーコード") },
	{ key: "具体例", test: (t) => t.startsWith("具体例") },
];

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

function sectionFilled(sec) {
	return sec.lines.some((l) => l.trim().length > 0);
}

function findSection(body, test) {
	return getSections(body).find((s) => test(s.title));
}

//  マークダウン表の1列目（＝名前列）を拾う。ヘッダ行（＝最初の行）・区切り行は
//  位置で除外する（キーワード判定にすると "name" 等の実パラメータ名を誤って落とす）。
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
function normName(n) {
	return n
		.replace(/`/g, "")
		.trim()
		.replace(/^i_/, "")
		.toLowerCase();
}

function countTableRows(lines) {
	return tableFirstColumn(lines).length;
}

function parseFeaturesTable(body) {
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
			//  状態列は draft|fixed のセルを探す（工程列など他の列が末尾に来ても壊れないよう、
			//  位置でなく値で特定する。見つからなければ旧来どおり末尾列にフォールバック）
			status:
				cells.find((c) => c === "draft" || c === "fixed") ||
				cells[cells.length - 1],
			link,
		});
	}
	return rows;
}

function checkSentinels(file, text, status) {
	if (status !== "fixed") return;
	for (const s of SENTINELS) {
		if (text.includes(s))
			err(file, `fixed なのにテンプレのプレースホルダが残っている: "${s}"`);
	}
}

function checkStatus(file, data) {
	const s = data["ステータス"];
	if (!s) {
		err(file, "フロントマターに ステータス が無い");
		return null;
	}
	if (s !== "draft" && s !== "fixed") {
		err(file, `ステータスは draft|fixed のいずれか。実際: "${s}"`);
	}
	return s;
}

function checkRequiredFm(file, data, keys) {
	for (const k of keys) {
		if (!data[k] || data[k].length === 0) err(file, `フロントマター "${k}" が空/欠落`);
	}
}

function checkSections(file, body, required, status) {
	const secs = getSections(body);
	for (const req of required) {
		const found = secs.find((s) => req.test(s.title));
		if (!found) {
			err(file, `必須セクション "${req.key}" が無い`);
		} else if (status === "fixed" && !sectionFilled(found)) {
			err(file, `fixed なのにセクション "${req.key}" が空`);
		}
	}
}

//  --- docs 衛生（負のリスト混入の検出。負のリストの SSOT は各 producer craft:
//      ssot-definer §B「spec に書かないもの」/ contract-author「契約に書かないもの」）---
//  すべて warn（既存プロジェクトの validate を err で即死させない）。
//  spec/contract は「現在形の不変条件」だけを持つ。改訂経緯・理由・実測・未決・
//  実装アンカーの混入は SSOT 肥大の兆候として警告する。
function checkHygiene(file, body, kind) {
	const lines = body.split(/\r?\n/);

	//  1) 冒頭ナラティブ: フロントマター直後〜最初のセクションまでの blockquote 群。
	//     改訂のたびに差分説明が積まれるパターン（1 日で spec が 3 倍化した実例の主因）。
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

	//  2) 本文中の日付括弧: 「（2026-07-26 改訂）」のような経緯の追記痕。
	const dates = body.match(/[（(]\d{4}-\d{2}-\d{2}/g) || [];
	if (dates.length > 0)
		warn(file, `本文中に日付括弧の経緯記述が ${dates.length} 件（経緯は git が持つ。本文は現在形に統合する）`);

	//  3) 実装アンカー: コード側ファイルへのパス／行番号参照。コードが SSOT なので
	//     docs に書くと腐る。契約はアクション名・エンドポイントが本業のため、
	//     行番号付き（明確に実装確認の痕跡）のみ警告する。
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

	//  6) 肥大の煙探知機
	const maxLines = kind === "spec" ? 300 : 400;
	if (lines.length > maxLines)
		warn(file, `本文が ${lines.length} 行（${maxLines} 行超）— 1 関心事を超えた堆積の疑い（負のリスト該当を排出する）`);
}

//  --- ファイル種別ごとの検証 ---
function validateFeatureSpec(file, text) {
	const { data, body } = parseFrontmatter(text);
	checkRequiredFm(file, data, ["機能ID", "機能名", "ステータス", "更新日"]);
	const status = checkStatus(file, data);
	checkSections(file, body, SPEC_SECTIONS, status);
	checkSentinels(file, text, status);
	checkHygiene(file, body, "spec");
	//  状態セクションにハッピーパス以外が含まれるか（fixed のみ・警告）
	const states = findSection(body, (t) => t.startsWith("状態"));
	const statesText = states ? states.lines.join("") : "";
	if (status === "fixed" && states) {
		for (const kw of ["error", "empty", "権限"]) {
			if (!statesText.includes(kw))
				warn(file, `状態に "${kw}" 系の記述が見当たらない（機能詳細の書式＝ssot-definer §B 参照）`);
		}
	}
	const inputSec = findSection(body, (t) => t.startsWith("入力"));
	const inputs = inputSec ? tableFirstColumn(inputSec.lines) : [];
	return { id: data["機能ID"] || null, status, inputs, statesText };
}

function validateContract(file, text) {
	const { data, body } = parseFrontmatter(text);
	checkRequiredFm(file, data, ["機能ID", "機能名", "ステータス", "更新日", "機能詳細"]);
	const status = checkStatus(file, data);
	checkSections(file, body, CONTRACT_SECTIONS, status);
	checkSentinels(file, text, status);
	checkHygiene(file, body, "contract");
	const reqSec = findSection(body, (t) => /^request/i.test(t));
	const requestParams = reqSec ? tableFirstColumn(reqSec.lines) : [];
	const errSec = findSection(body, (t) => /^response/i.test(t) && t.includes("異常"));
	const errorRows = errSec ? countTableRows(errSec.lines) : 0;
	return {
		id: data["機能ID"] || null,
		status,
		specLink: data["機能詳細"] || null,
		requestParams,
		errorRows,
	};
}

function listMd(dir) {
	if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.map((f) => join(dir, f));
}

//  --- validate コマンド ---
function loadModel(docsDir) {
	const specDir = join(docsDir, "spec");
	const contractsDir = join(docsDir, "contracts");
	const featuresFile = join(specDir, "features.md");

	const specs = new Map(); //  id -> { file, status }
	const contracts = new Map(); //  id -> { file, status, specLink }
	let features = null;

	for (const file of listMd(specDir)) {
		if (basename(file) === "features.md") continue;
		const res = validateFeatureSpec(file, readFileSync(file, "utf8"));
		if (res.id) {
			if (specs.has(res.id))
				err(file, `機能ID "${res.id}" が重複（${specs.get(res.id).file} と）`);
			else
				specs.set(res.id, {
					file,
					status: res.status,
					inputs: res.inputs,
					statesText: res.statesText,
				});
		}
	}

	for (const file of listMd(contractsDir)) {
		const res = validateContract(file, readFileSync(file, "utf8"));
		if (res.id)
			contracts.set(res.id, {
				file,
				status: res.status,
				specLink: res.specLink,
				requestParams: res.requestParams,
				errorRows: res.errorRows,
			});
	}

	if (existsSync(featuresFile)) {
		const { data, body } = parseFrontmatter(readFileSync(featuresFile, "utf8"));
		checkRequiredFm(featuresFile, data, ["ステータス", "更新日"]);
		checkStatus(featuresFile, data);
		features = parseFeaturesTable(body);
		if (features.length === 0) warn(featuresFile, "機能一覧テーブルに行が無い");
	} else {
		warn(featuresFile, "機能一覧 features.md が無い（機能一覧の書式＝ssot-definer §A 参照）");
	}

	return { specs, contracts, features, specDir, featuresFile };
}

function crossChecks(model) {
	const { specs, contracts, features, specDir, featuresFile } = model;

	//  features.md ↔ <feature>.md（状態一致・リンク整合・列挙漏れ）
	if (features) {
		const listed = new Set();
		for (const row of features) {
			listed.add(row.id);
			const spec = specs.get(row.id);
			if (!spec) {
				err(featuresFile, `機能一覧の "${row.id}" に対応する spec が docs/spec に無い`);
				continue;
			}
			if (row.link) {
				const target = join(specDir, row.link.replace(/^\.\//, ""));
				if (!existsSync(target))
					err(featuresFile, `"${row.id}" の詳細リンクが解決しない: ${row.link}`);
			}
			if (row.status !== spec.status)
				err(
					featuresFile,
					`"${row.id}" の状態が不一致: features.md="${row.status}" / spec="${spec.status}"`,
				);
		}
		for (const [id, spec] of specs) {
			if (!listed.has(id)) err(spec.file, `spec "${id}" が features.md に列挙されていない`);
		}
	}

	//  契約カバレッジ: spec が fixed（＝実装に進んでよい）なのに契約ファイルが
	//  無い機能を可視化する。実装は契約 fixed を前提とするため、欠落を沈黙させない。
	//  誤検知の余地（契約整備前の中間状態）があるため err でなく warn。
	for (const [id, spec] of specs) {
		if (spec.status === "fixed" && !contracts.has(id))
			warn(spec.file, `${id}: spec が fixed だが契約ファイルが無い（docs/contracts に契約を作る）`);
	}

	//  contract ↔ spec（親 draft に fixed 契約は不可・親の存在・入出力の相互整合）
	for (const [id, c] of contracts) {
		const spec = specs.get(id);
		if (!spec) {
			err(c.file, `契約 "${id}" に対応する spec が docs/spec に無い`);
			continue;
		}
		if (c.status === "fixed" && spec.status === "draft")
			err(
				c.file,
				`親 spec が draft なのに契約が fixed（先に spec を fixed にする）: ${id}`,
			);
		crossConsistency(id, spec, c);
	}
}

//  構造整合オラクル相当（ヒューリスティック・warn 中心）:
//  機能詳細の入力 ↔ 契約の Request、機能詳細の異常状態 ↔ 契約の異常 Response。
//  名前は i_ 接頭辞を吸収して突き合わせる。名付けの揺れで誤検知しうるため warn。
function crossConsistency(id, spec, c) {
	const specIn = new Set(spec.inputs.map(normName));
	const reqIn = new Set(c.requestParams.map(normName));

	for (const n of specIn)
		if (!reqIn.has(n))
			warn(c.file, `${id}: 機能詳細の入力 "${n}" が契約 Request に見当たらない`);
	for (const n of reqIn)
		if (!specIn.has(n))
			warn(c.file, `${id}: 契約 Request の "${n}" が機能詳細の入力に見当たらない`);

	//  機能詳細が error/権限/境界 の異常状態を持つのに、契約の異常 Response が空
	const hasAbnormalState = /error|権限|境界/.test(spec.statesText);
	if (hasAbnormalState && c.errorRows === 0)
		warn(
			c.file,
			`${id}: 機能詳細に異常状態があるが契約の「Response（異常）」に行が無い`,
		);
}

function cmdValidate(docsDir) {
	if (!existsSync(join(docsDir, "spec"))) {
		console.log(`spec-lint: ${docsDir}/spec が無いため検証をスキップ`);
		return 0;
	}
	const model = loadModel(docsDir);
	crossChecks(model);
	report();
	return errors.length > 0 ? 1 : 0;
}

//  --- gate コマンド（draft なのに実装、を防ぐ） ---
function statusOf(docsDir, id) {
	const spec = existsSync(join(docsDir, "spec"))
		? listMd(join(docsDir, "spec")).find((f) => {
				if (basename(f) === "features.md") return false;
				return parseFrontmatter(readFileSync(f, "utf8")).data["機能ID"] === id;
			})
		: null;
	const contract = existsSync(join(docsDir, "contracts"))
		? listMd(join(docsDir, "contracts")).find(
				(f) => parseFrontmatter(readFileSync(f, "utf8")).data["機能ID"] === id,
			)
		: null;
	const st = (f) => (f ? parseFrontmatter(readFileSync(f, "utf8")).data["ステータス"] : null);
	return { spec: st(spec), contract: st(contract), specFound: !!spec, contractFound: !!contract };
}

function gateFeature(docsDir, id) {
	const s = statusOf(docsDir, id);
	if (!s.specFound) {
		err("gate", `${id}: 対応する spec が無い（docs/spec に機能詳細を作る）`);
		return;
	}
	if (s.spec !== "fixed")
		err("gate", `${id}: spec が fixed でない（draft のまま実装しない）`);
	//  契約は「存在し、かつ fixed」を要求する。契約ファイルの欠落を
	//  実装ゲートで素通りさせない（契約なしのまま実装が進む事故を断つ）。
	if (!s.contractFound)
		err("gate", `${id}: 契約が無い（docs/contracts に契約を作り fixed にする）`);
	else if (s.contract !== "fixed")
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
