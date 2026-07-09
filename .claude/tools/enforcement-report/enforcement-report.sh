#!/usr/bin/env bash
#
#  enforcement-report — 機械チェックの「能力」と「現状」を検出してレポートする。
#
#  能力に応じて張れる最大の層（L1 hook / L2 CI / L3 branch protection）を判定し、
#  各チェック（commit/coding/test/secret/layer/spec）が今どの層で効いているか、
#  何が未強制かを Markdown で出す。**読み取り専用**（--out 指定時のみレポートを書く）。
#
#  使い方:
#    enforcement-report.sh [--out docs/enforcement.md]
#
#  依存: git（必須）, gh（あれば admin/保護を判定）。set -e は使わない（検出で非0が普通）。
#

set -u

OUT=""
while [ $# -gt 0 ]; do
	case "$1" in
		--out) OUT="$2"; shift 2 ;;
		*) echo "usage: enforcement-report.sh [--out FILE]" >&2; exit 2 ;;
	esac
done

have() { command -v "$1" >/dev/null 2>&1; }
exists() { [ -e "$1" ]; }
glob_exists() { compgen -G "$1" >/dev/null 2>&1; }
#  コマンドの成否だけを yes/no に（コマンド自身の出力は捨てる）
yn() { if "$@" >/dev/null 2>&1; then echo yes; else echo no; fi; }

#  --- 検出 ---
in_git=$(yn git rev-parse --is-inside-work-tree)
origin=$(git remote get-url origin 2>/dev/null || true)
host=""; slug=""
if [ -n "$origin" ]; then
	host=$(printf '%s' "$origin" | sed -E 's#^(git@|https://|ssh://git@)##; s#[:/].*$##')
	slug=$(printf '%s' "$origin" | sed -E 's#\.git$##; s#^.*[:/]([^/]+/[^/]+)$#\1#')
fi
is_github=no; case "$host" in github.com|github.*) is_github=yes ;; esac

gh_auth=unknown; admin=unknown; private=unknown; protected=unknown
if have gh; then
	if gh auth status >/dev/null 2>&1; then
		gh_auth=yes
		if [ "$is_github" = yes ] && [ -n "$slug" ]; then
			#  成功時のみ採用（失敗＝404 等の本文は変数に入れない）
			if out=$(gh api "repos/$slug" --jq '.permissions.admin' 2>/dev/null); then admin=$out; fi
			if out=$(gh api "repos/$slug" --jq '.private' 2>/dev/null); then private=$out; fi
			if gh api "repos/$slug/branches/main/protection" >/dev/null 2>&1; then
				protected=yes
			else
				protected=no
			fi
		fi
	else
		gh_auth=no
	fi
fi
#  gh --jq は true/false を返すので yes/no に正規化
case "$admin" in true) admin=yes;; false) admin=no;; esac
case "$private" in true) private=yes;; false) private=no;; esac

have_node=$(yn have node); have_php=$(yn have php); have_composer=$(yn have composer)

#  既存の強制アーティファクト
hooks_dir="no"
if exists .husky || exists .githooks; then hooks_dir="yes"; fi
commit_cfg=$( if exists commitlint.config.js || exists .githooks/commit-msg || exists .husky/commit-msg; then echo yes; else echo no; fi )
coding_cfg=$( if exists phpcs.xml || exists phpcs.xml.dist || exists eslint.config.js; then echo yes; else echo no; fi )
test_cfg=$( if exists phpunit.xml || exists phpunit.xml.dist || ( exists package.json && grep -q '"test"' package.json 2>/dev/null ); then echo yes; else echo no; fi )
secret_cfg=$( if exists .gitleaks.toml || grep -rqs gitleaks .husky .githooks .github/workflows 2>/dev/null; then echo yes; else echo no; fi )
layer_cfg=$( if exists deptrac.yaml || exists .dependency-cruiser.js; then echo yes; else echo no; fi )
spec_cfg=$( if grep -rqs spec-lint .husky .githooks .github/workflows package.json composer.json 2>/dev/null; then echo yes; else echo no; fi )
ci_yml=$( if glob_exists ".github/workflows/*.yml" || glob_exists ".github/workflows/*.yaml"; then echo yes; else echo no; fi )

#  --- 到達可能な層 ---
l1="yes"   #  git repo があれば常に可
l2=$( if [ "$is_github" = yes ]; then echo yes; else echo "no(GitHub 以外/リモート無し)"; fi )
l3="unknown"
if [ "$admin" = yes ]; then
	if [ "$private" = yes ]; then l3="要確認(private=有料プラン)"; else l3="yes"; fi
elif [ "$admin" = no ]; then l3="no(admin 権限なし)"
elif [ "$gh_auth" = yes ]; then l3="unknown(admin 判定不可)"
else l3="unknown(gh 未認証/未導入)"; fi

mark() { case "$1" in yes) echo "✅ 済";; no) echo "— 未";; *) echo "$1";; esac; }

#  --- ギャップ行を事前計算（heredoc 内で case/paren を避ける） ---
gaps=""
add_gap() { gaps="${gaps}- $1
"; }
[ "$commit_cfg" = no ] && add_gap "commit 規約が未設定 → enforcement/hooks.md"
[ "$coding_cfg" = no ] && add_gap "コーディング規約が未設定 → enforcement/coding-standards.md"
[ "$secret_cfg" = no ] && add_gap "秘密情報スキャンが未設定 → enforcement/secrets.md"
[ "$spec_cfg" = no ] && add_gap "spec-lint が未配線 → enforcement/spec-lint.md"
{ [ "$ci_yml" = no ] && [ "$is_github" = yes ]; } && add_gap "CI 未設定（L2 の裏取りが無い）→ enforcement/ci.md"
case "$l3" in
	yes) : ;;
	*) add_gap "**L3 ブランチ保護を張れない/未設定**（${l3}）: main 直 push を機械的に封じられない。L1+L2 で留め、手動運用で補う。" ;;
esac
[ -z "$gaps" ] && gaps="- （検出範囲では未強制のギャップ無し）
"

#  --- レポート生成 ---
emit() {
	cat <<MD
# 機械チェック強制レポート（enforcement）

> \`.claude/tools/enforcement-report/enforcement-report.sh\` が自動生成。
> 規約の SSOT は \`.claude/rules/engineering/conventions/enforcement/\`。

## 能力

| 項目 | 値 |
| --- | --- |
| git リポジトリ | $in_git |
| リモート | ${slug:-（無し）} @ ${host:-—} |
| GitHub | $is_github |
| gh 認証 | $gh_auth |
| repo admin | $admin |
| private | $private |
| Node / PHP / Composer | $have_node / $have_php / $have_composer |

## 張れる層（能力の上限）

- **L1 ローカルフック**: ${l1}
- **L2 CI（GitHub Actions）**: ${l2}
- **L3 ブランチ保護**: ${l3}
- 現在の main 保護: $(mark "$protected")

## チェック別の現状

| チェック | 設定 | 参照葉 |
| --- | --- | --- |
| commit 規約 | $(mark "$commit_cfg") | enforcement/hooks.md |
| コーディング規約 | $(mark "$coding_cfg") | enforcement/coding-standards.md |
| テスト | $(mark "$test_cfg") | enforcement/ci.md |
| 秘密情報 | $(mark "$secret_cfg") | enforcement/secrets.md |
| 層依存 | $(mark "$layer_cfg") | enforcement/layer-boundaries.md |
| 仕様(spec-lint) | $(mark "$spec_cfg") | enforcement/spec-lint.md |
| CI ワークフロー | $(mark "$ci_yml") | enforcement/ci.md |

## ギャップ（未強制・要対応）

${gaps}
> 機械チェック緑は前提であって完成条件ではない（process.md コア制約4）。最後は攻撃で壊しにいく。
MD
}

if [ -n "$OUT" ]; then
	mkdir -p "$(dirname "$OUT")"
	emit > "$OUT"
	echo "enforcement-report: wrote $OUT"
else
	emit
fi
