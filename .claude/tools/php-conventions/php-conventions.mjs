#!/usr/bin/env node
//
//  php-conventions — coding.md のうち PHPCS 標準 sniff で表現できない項目を
//  正規表現ヒューリスティックで検査する（harness 同梱・依存ゼロ）。
//
//  検査する（coding.md）:
//    - NOT 演算子 "!" の禁止（!= / !== は除外）
//    - メソッド引数は末尾 "_" を付与する
//  検査しない（誤検知が多く review 行き）: i_ 接頭辞 / bool・null の === 徹底
//
//  ヒューリスティックなのでオプトイン。文字列・コメントは除去してから走査するが
//  完全ではない。使い方:
//    node php-conventions.mjs check [--src src] [path ...]
//  終了コード: 0=OK / 1=違反 / 2=使い方エラー
//

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const errors = [];
const err = (file, line, msg) => errors.push({ file, line, msg });

//  文字列リテラルとコメントを空白に潰す（改行は保持して行番号を維持）。
function stripStringsAndComments(src) {
	let out = "";
	let i = 0;
	const n = src.length;
	//  state: code | line | block | sq | dq
	let state = "code";
	while (i < n) {
		const c = src[i];
		const c2 = src[i + 1];
		if (state === "code") {
			if (c === "/" && c2 === "/") {
				state = "line";
				out += "  ";
				i += 2;
			} else if (c === "#") {
				state = "line";
				out += " ";
				i += 1;
			} else if (c === "/" && c2 === "*") {
				state = "block";
				out += "  ";
				i += 2;
			} else if (c === "'") {
				state = "sq";
				out += " ";
				i += 1;
			} else if (c === '"') {
				state = "dq";
				out += " ";
				i += 1;
			} else {
				out += c;
				i += 1;
			}
		} else if (state === "line") {
			out += c === "\n" ? "\n" : " ";
			if (c === "\n") state = "code";
			i += 1;
		} else if (state === "block") {
			if (c === "*" && c2 === "/") {
				out += "  ";
				i += 2;
				state = "code";
			} else {
				out += c === "\n" ? "\n" : " ";
				i += 1;
			}
		} else if (state === "sq") {
			if (c === "\\") {
				out += "  ";
				i += 2;
			} else if (c === "'") {
				out += " ";
				i += 1;
				state = "code";
			} else {
				out += c === "\n" ? "\n" : " ";
				i += 1;
			}
		} else if (state === "dq") {
			if (c === "\\") {
				out += "  ";
				i += 2;
			} else if (c === '"') {
				out += " ";
				i += 1;
				state = "code";
			} else {
				out += c === "\n" ? "\n" : " ";
				i += 1;
			}
		}
	}
	return out;
}

function lineOf(text, index) {
	let line = 1;
	for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
	return line;
}

//  NOT 演算子 "!"（!= / !== を除く）
function checkBang(file, code) {
	//  "!" の直後が "=" でないもの。直前が "!"（!! は稀）も個別に拾う。
	const re = /!(?!=)/g;
	let m;
	while ((m = re.exec(code)) !== null) {
		err(file, lineOf(code, m.index), 'coding.md: NOT 演算子 "!" は禁止（=== false / !== true で書く）');
	}
}

//  メソッド/関数の引数は末尾 "_"
function checkArgUnderscore(file, code) {
	const re = /function\s*&?\s*\w*\s*\(([^)]*)\)/g;
	let m;
	while ((m = re.exec(code)) !== null) {
		const params = m[1].trim();
		if (params.length === 0) continue;
		const line = lineOf(code, m.index);
		for (const seg of params.split(",")) {
			const vm = seg.match(/\$(\w+)/); //  セグメント最初の $変数＝引数名
			if (!vm) continue;
			const name = vm[1];
			if (!name.endsWith("_"))
				err(file, line, `coding.md: 引数 "$${name}" は末尾に "_" を付ける（$${name}_）`);
		}
	}
}

function scanFile(file) {
	const raw = readFileSync(file, "utf8");
	const code = stripStringsAndComments(raw);
	checkBang(file, code);
	checkArgUnderscore(file, code);
}

function collectPhp(paths) {
	const files = [];
	for (const p of paths) {
		if (!existsSync(p)) continue;
		if (statSync(p).isDirectory()) {
			for (const f of readdirSync(p, { recursive: true }))
				if (typeof f === "string" && f.endsWith(".php")) files.push(join(p, f));
		} else if (p.endsWith(".php")) {
			files.push(p);
		}
	}
	return files;
}

function main() {
	const argv = process.argv.slice(2);
	const cmd = argv[0];
	if (cmd !== "check" && cmd !== undefined) {
		console.error("usage: php-conventions.mjs check [--src src] [path ...]");
		process.exit(2);
	}
	const paths = [];
	let src = null;
	for (let i = cmd ? 1 : 0; i < argv.length; i++) {
		if (argv[i] === "--src") src = argv[++i];
		else paths.push(argv[i]);
	}
	const targets = paths.length > 0 ? paths : [src || "src"];
	const files = collectPhp(targets);
	if (files.length === 0) {
		console.log(`php-conventions: 対象 .php が無い（${targets.join(", ")}）`);
		process.exit(0);
	}
	for (const f of files) scanFile(f);
	for (const e of errors) console.error(`  ${e.file}:${e.line}: ${e.msg}`);
	if (errors.length === 0) console.log(`php-conventions: OK（${files.length} files）`);
	else console.error(`php-conventions: ${errors.length} 件の違反`);
	process.exit(errors.length > 0 ? 1 : 0);
}

main();
