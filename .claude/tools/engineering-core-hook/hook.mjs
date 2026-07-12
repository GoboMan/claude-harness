#!/usr/bin/env node
//  UserPromptSubmit フック：engineering 実装意図を検出したら、開発プロセスの
//  「核」(process.md) を SSOT からそのまま注入する。遅延ロード設計を壊さないため、
//  検出したときだけ・セッション1回だけ注入する（fail-open：失敗しても素通り）。
//
//  入出力の契約（Claude Code UserPromptSubmit フック）:
//    stdin  : JSON（prompt / session_id / cwd 等）
//    stdout : exit 0 のとき、その内容が追加コンテキストとして注入される
//    exit   : 常に 0（プロンプト処理を止めない）。無出力＝注入なし。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

//  実装意図の検出パターン（ヒューリスティック。誤検知より取りこぼしを恐れるが、
//  純粋な構造談義での誤発火を減らすため「実装しにいく動詞／コード成果物」に寄せる）。
//  ここは調整前提。全部を機械判定できるふりはしない（README 参照）。
const INTENT = [
	//  実装・修正の動詞（JP）
	"実装", "作って", "作成", "つくって", "直し", "修正", "改修",
	"リファクタ", "デバッグ", "バグ", "不具合", "落ちる", "動かない",
	//  テスト・仕様・契約
	"テスト", "GWT", "受け入れ条件", "機能詳細", "契約",
	//  コード成果物
	"コード", "クラス", "関数", "メソッド", "エンドポイント",
	"スキーマ", "マイグレーション", "クエリ",
	//  framework / stack
	"crow", "PHPUnit", "Laravel", "Flutter", "Swift",
	//  英語の実装系動詞・名詞（大小無視）
	"implement", "refactor", "debug", "fix", "bug", "crash",
	"exception", "failing test", "endpoint", "migration", "schema",
];

//  英語キーワードは単語境界で括り、substring 誤爆（prefix→fix 等）を防ぐ。
const EN_RE = new RegExp(
	"\\b(" +
		INTENT.filter((w) => /^[\x00-\x7F ]+$/.test(w))
			.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
			.join("|") +
		")\\b",
	"i",
);
const JP_WORDS = INTENT.filter((w) => /[^\x00-\x7F]/.test(w));

function looks_like_engineering(prompt_)
{
	if (typeof prompt_ !== "string" || prompt_.length === 0) return false;
	if (EN_RE.test(prompt_)) return true;
	for (const w of JP_WORDS)
	{
		if (prompt_.includes(w)) return true;
	}
	return false;
}

//  process.md（核）の在り処を解決する（配布形態＝copy/symlink いずれでも動くよう複数候補）。
function resolve_core()
{
	const rel = ".claude/rules/engineering/practices/process.md";
	const candidates = [];
	if (process.env.CLAUDE_PROJECT_DIR)
	{
		candidates.push(path.join(process.env.CLAUDE_PROJECT_DIR, rel));
	}
	candidates.push(path.resolve(here, "../../rules/engineering/practices/process.md"));
	for (const p of candidates)
	{
		try { if (fs.statSync(p).isFile()) return p; } catch (_e) { /* try next */ }
	}
	return null;
}

//  セッション内で既に注入済みかを判定（毎ターンの巨大注入を避ける）。
function already_injected_this_session(session_id_)
{
	if (typeof session_id_ !== "string" || session_id_.length === 0) return false;
	const safe = session_id_.replace(/[^A-Za-z0-9_-]/g, "_");
	const marker = path.join(os.tmpdir(), "claude-eng-core-" + safe);
	try
	{
		if (fs.existsSync(marker)) return true;
		fs.writeFileSync(marker, String(Date.now()));
		return false;
	}
	catch (_e)
	{
		//  マーカーを扱えない環境では dedup を諦めて注入する（fail-open）。
		return false;
	}
}

function main(raw_)
{
	let input = {};
	try { input = JSON.parse(raw_); } catch (_e) { return; }

	const prompt = input.prompt;
	if (looks_like_engineering(prompt) === false) return;
	if (already_injected_this_session(input.session_id) === true) return;

	const core_path = resolve_core();
	if (core_path === null) return;

	let core = "";
	try { core = fs.readFileSync(core_path, "utf8"); } catch (_e) { return; }

	//  provenance を明示（人間・AI がフック由来と分かるように）。
	const banner =
		"<!-- injected-by: engineering-core-hook (UserPromptSubmit) -->\n" +
		"⚙️ engineering の実装意図を検出しました。以下は開発プロセスの『核』"
		+ "(process.md) です。**実装に入る前に §1.5 実装着手ゲートを必ず通す**こと"
		+ "（features 収録・spec fixed・契約 fixed の3点。1つでも欠けたら Phase 1 へ戻る）。\n"
		+ "プラットフォーム／framework 固有ルールは `.claude/rules/index.md` を起点に"
		+ "必要な葉だけを辿ること。\n\n---\n\n";

	process.stdout.write(banner + core + "\n");
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { raw += d; });
process.stdin.on("end", () => { try { main(raw); } catch (_e) { /* fail-open */ } });
