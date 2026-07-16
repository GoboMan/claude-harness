#!/usr/bin/env bash
#
# init.sh — claude-harness を対象プロジェクトへ導入 / 更新する
#
# 使い方:
#   導入:  ./init.sh [install] /path/to/your-project [--mode submodule|symlink|copy] [--tag vX.Y.Z] [--force]
#   更新:  ./init.sh update [/path/to/your-project] [--tag vX.Y.Z] [--no-commit]
#
# install が行うこと:
#   1. 対象プロジェクトに .claude/（rules・skills）を配置する
#      （routing はネイティブの .claude/rules 自動ロード＋skill で行うため、
#       ルーター用の CLAUDE.md は設置しない。プロジェクト固有の事実が要るなら
#       各プロジェクトが自分で CLAUDE.md を用意する）
#
# 配置方式（--mode）:
#   submodule  (既定) harness を対象リポジトリの submodule として取り込み、
#                     .claude をその中へ相対リンクする。.claude が対象 repo に
#                     付いて回るので、チーム・別マシン・CI でも共有できる。
#                     （対象が git リポジトリで、harness に origin リモートが必要）
#   symlink           このリポジトリの .claude を対象へシンボリックリンク。
#                     harness を pull すれば全プロジェクトに即反映されるが、実体は
#                     harness 1 箇所にあり対象 repo には含まれない（個人・同一マシン向け）。
#   copy              .claude を実体コピー。スナップショット。更新は伝播しない。
#
# バージョン固定（submodule）:
#   submodule 配置は harness の「リリースタグ（v* 形式）」に固定する。main の
#   作業途中を拾わないため、整合性が最も高い。install / update とも、既定では
#   最新の v* タグへ固定する。--tag で特定リリースへの固定・巻き戻しもできる。
#   ※ harness 側でリリースタグを切ること（例: git tag v0.1.0 && git push --tags）。
#
# update が行うこと（submodule 配置の SSOT を取り込む）:
#   対象の .claude-harness を最新（または --tag 指定）のリリースへ固定し、その版を
#   コミットでピン留めする。対象を省略するとカレントの git リポジトリを対象にする。
#   --no-commit は更新のみでコミットしない。
#   ※ symlink は harness 側で git pull するだけ、copy は install --force で更新する。

set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBMODULE_PATH=".claude-harness"

ACTION="install"
MODE="submodule"
FORCE="false"
NO_COMMIT="false"
TARGET_DIR=""
TAG=""

log()  { echo "[claude-harness] $*"; }
warn() { echo "[claude-harness] warning: $*" >&2; }
die()  { echo "[claude-harness] error: $*" >&2; exit 1; }

usage()
{
  cat >&2 <<'EOF'
usage:
  install: ./init.sh [install] /path/to/your-project [--mode submodule|symlink|copy] [--tag vX.Y.Z] [--force]
  update:  ./init.sh update [/path/to/your-project] [--tag vX.Y.Z] [--no-commit]

  --mode <m>    配置方式（既定: submodule）。submodule / symlink / copy。install のみ。
  --tag <t>     固定するリリースタグ（既定: 最新の v* タグ）。submodule 配置のみ。
  --force       対象の既存 .claude/ を置き換える（既定は中断）。install のみ。
  --no-commit   更新のみ行いコミットしない。update のみ。
  -h, --help    このヘルプを表示。

注: update は submodule 配置に対してのみ有効。
    harness にはリリースタグ（例: v0.1.0）が必要。
EOF
}

# submodule ディレクトリから最新のリリースタグ（v*）を取り出す（無ければ空）
latest_release_tag()
{
  git -C "$1" tag -l 'v*' --sort=-v:refname | head -n1
}

# 指定 submodule を指定タグへ固定する（gitlink はまだコミットしない）
#   $1 = submodule dir, $2 = tag
checkout_tag()
{
  git -C "$1" checkout --quiet "refs/tags/$2"
}

# --- アクション判定（先頭の位置引数が install/update ならそれを採用） ---
if [[ $# -gt 0 ]]; then
  case "$1" in
    install|update) ACTION="$1"; shift ;;
  esac
fi

# --- 引数パース ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)      MODE="${2:-}"; shift 2 ;;
    --mode=*)    MODE="${1#*=}"; shift ;;
    --tag)       TAG="${2:-}"; shift 2 ;;
    --tag=*)     TAG="${1#*=}"; shift ;;
    --force)     FORCE="true"; shift ;;
    --no-commit) NO_COMMIT="true"; shift ;;
    -h|--help)   usage; exit 0 ;;
    --) shift; break ;;
    -*) usage; die "unknown option: $1" ;;
    *)
      if [[ -n "${TARGET_DIR}" ]]; then
        usage; die "target directory specified more than once"
      fi
      TARGET_DIR="$1"; shift
      ;;
  esac
done

# =============================== update ===============================
do_update()
{
  # 対象未指定ならカレントの git リポジトリルートを使う
  if [[ -z "${TARGET_DIR}" ]]; then
    TARGET_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
    [[ -n "${TARGET_DIR}" ]] \
      || die "no target given and current directory is not a git repository"
  fi
  [[ -d "${TARGET_DIR}" ]] || die "target directory not found: ${TARGET_DIR}"
  TARGET_DIR="$(cd "${TARGET_DIR}" && pwd)"

  git -C "${TARGET_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || die "target is not a git repository: ${TARGET_DIR}"
  [[ -e "${TARGET_DIR}/${SUBMODULE_PATH}" ]] \
    || die "no ${SUBMODULE_PATH} submodule at target; update is for submodule installs"

  local sub="${TARGET_DIR}/${SUBMODULE_PATH}"
  log "target: ${TARGET_DIR}"
  log "fetching harness release tags ..."
  git -C "${sub}" fetch --tags --prune --quiet origin

  # 取り込むタグを決定（--tag 指定 or 最新 v*）
  local tag="${TAG}"
  if [[ -z "${tag}" ]]; then
    tag="$(latest_release_tag "${sub}")"
    [[ -n "${tag}" ]] \
      || die "no release tags (v*) found on harness; tag a release first (git tag v0.1.0 && git push --tags)"
  else
    git -C "${sub}" rev-parse -q --verify "refs/tags/${tag}^{commit}" >/dev/null 2>&1 \
      || die "tag not found on harness: ${tag}"
  fi

  local old_sha new_sha
  old_sha="$(git -C "${sub}" rev-parse HEAD)"
  new_sha="$(git -C "${sub}" rev-parse "refs/tags/${tag}^{commit}")"

  if [[ "${old_sha}" == "${new_sha}" ]]; then
    log "already at ${tag}; nothing to do."
    exit 0
  fi

  checkout_tag "${sub}" "${tag}"
  git -C "${TARGET_DIR}" add "${SUBMODULE_PATH}"

  if [[ "${NO_COMMIT}" == "true" ]]; then
    log "set claude-harness to ${tag}; staged but not committed (--no-commit)."
    exit 0
  fi

  git -C "${TARGET_DIR}" commit -m "chore: set claude-harness to ${tag}"
  log "committed: claude-harness -> ${tag}."
  exit 0
}

# =============================== install ==============================
do_install()
{
  if [[ -z "${TARGET_DIR}" ]]; then
    usage; exit 1
  fi
  [[ -d "${TARGET_DIR}" ]] || die "target directory not found: ${TARGET_DIR}"
  TARGET_DIR="$(cd "${TARGET_DIR}" && pwd)"

  case "${MODE}" in
    symlink|copy|submodule) ;;
    *) die "invalid --mode: ${MODE} (submodule|symlink|copy)" ;;
  esac

  [[ -d "${SRC_DIR}/.claude" ]] || die "source .claude not found: ${SRC_DIR}/.claude"

  if [[ "${TARGET_DIR}" == "${SRC_DIR}" ]]; then
    die "target is the harness repository itself; choose a different project"
  fi

  log "source: ${SRC_DIR}"
  log "target: ${TARGET_DIR}"
  log "mode:   ${MODE}"

  local dest_claude="${TARGET_DIR}/.claude"

  # --- 既存 .claude/ の扱い ---
  if [[ -e "${dest_claude}" || -L "${dest_claude}" ]]; then
    if [[ "${FORCE}" == "true" ]]; then
      log "removing existing ${dest_claude} (--force)"
      rm -rf "${dest_claude}"
    else
      die "${dest_claude} already exists. Re-run with --force to replace it."
    fi
  fi

  # --- .claude/ の配置 ---
  case "${MODE}" in
    symlink)
      ln -s "${SRC_DIR}/.claude" "${dest_claude}"
      log "linked .claude -> ${SRC_DIR}/.claude"
      ;;

    copy)
      cp -R "${SRC_DIR}/.claude" "${dest_claude}"
      log "copied .claude into ${dest_claude}"
      ;;

    submodule)
      git -C "${TARGET_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
        || die "submodule mode requires the target to be a git repository"

      local remote_url
      remote_url="$(git -C "${SRC_DIR}" remote get-url origin 2>/dev/null || true)"
      [[ -n "${remote_url}" ]] \
        || die "harness has no 'origin' remote; submodule mode needs one (use symlink/copy instead)"

      if [[ ! -e "${TARGET_DIR}/${SUBMODULE_PATH}" ]]; then
        git -C "${TARGET_DIR}" submodule add "${remote_url}" "${SUBMODULE_PATH}"
      else
        log "${SUBMODULE_PATH} submodule already present; reusing"
      fi

      # リリースタグへ固定（main の作業途中を拾わない）
      local sub="${TARGET_DIR}/${SUBMODULE_PATH}"
      git -C "${sub}" fetch --tags --prune --quiet origin || true
      local tag="${TAG}"
      if [[ -z "${tag}" ]]; then
        tag="$(latest_release_tag "${sub}")"
      else
        git -C "${sub}" rev-parse -q --verify "refs/tags/${tag}^{commit}" >/dev/null 2>&1 \
          || die "tag not found on harness: ${tag}"
      fi
      if [[ -n "${tag}" ]]; then
        checkout_tag "${sub}" "${tag}"
        git -C "${TARGET_DIR}" add "${SUBMODULE_PATH}"
        log "pinned ${SUBMODULE_PATH} to ${tag}"
      else
        warn "no release tags (v*) found on harness; left at default branch tip"
        warn "  tag a release for stable pinning: git tag v0.1.0 && git push --tags"
      fi

      # リポジトリ内で完結する相対リンク（clone 後も解決できる）
      ln -s "${SUBMODULE_PATH}/.claude" "${dest_claude}"
      log "linked .claude -> ${SUBMODULE_PATH}/.claude"
      ;;
  esac

  log "done."
  log "next: open the project; the AI routes via skills (/develop など). rules load on-demand (常駐なし)."
  log "      start development with the 'develop' skill (/develop)."
  if [[ "${MODE}" == "submodule" ]]; then
    log "      commit the placement, then pull updates later with: ./init.sh update ${TARGET_DIR}"
  fi
}

case "${ACTION}" in
  update)  do_update ;;
  install) do_install ;;
esac
