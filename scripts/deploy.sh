#!/usr/bin/env bash
#
# Build the Curator Tool front end and deploy it to the web server.
#
#   scripts/deploy.sh                      # build, upload to aws_curator_new, unpack over the live folder
#   scripts/deploy.sh -s aws_curator       # another SSH host name (as set up in your ~/.ssh/config)
#   scripts/deploy.sh --skip-build         # deploy the build already in dist/
#   scripts/deploy.sh --dry-run            # show what would happen, change nothing
#   scripts/deploy.sh -h                   # all options
#
# The SSH host can also be set once with DEPLOY_SERVER, and the folder with DEPLOY_DIR.
#
# What it does, following README.md ("Build"):
#   1. ng build --base-href=/curatortool/ (production configuration), and checks the base href in dist/index.html.
#   2. Packs dist/curator-tool-frontend into a tarball and copies it to /tmp on the server (not into the web folder,
#      where it would be downloadable).
#   3. On the server: saves a backup of the live folder to /tmp, then unpacks the build OVER the folder as the
#      folder's owner (www-data), with --strip-components=1. The folder is never deleted and re-created (that would
#      need an apache restart), and .htaccess is never touched (the build has none).
#   4. Removes top-level files the new build no longer has: the old hashed bundles (--no-prune keeps them). Only
#      files directly in the folder, never folders, and never .htaccess. The backup still has them.
#   5. Checks the deployed index.html and removes the uploaded tarball.
#
# If the folder is team-writable, it is written directly. Otherwise unpacking needs sudo on the server, so you are
# asked for your sudo password there. To make it team-writable (once, on the server; its group is reactome):
#   sudo find DIR -type d -exec chmod g+ws {} +
# Only the directories need it: replacing or deleting a file takes write permission on its directory, and GNU tar
# removes an existing file before writing the new one. g+s makes new files and folders take the reactome group.
# To roll back: the script prints the backup's path and the command to restore it.

set -euo pipefail

SERVER="${DEPLOY_SERVER:-aws_curator_new}"
TARGET_DIR="${DEPLOY_DIR:-/usr/local/reactomes/Reactome/production/GKB/website/html/curatortool}"
BASE_HREF="/curatortool/"
BUILD=1
BACKUP=1
PRUNE=1
DRY_RUN=0
ASSUME_YES=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Build the front end and deploy it over the live folder on the server.

Options:
  -s, --server HOST   SSH host name of the server (default: $SERVER; or set DEPLOY_SERVER)
  -d, --dir PATH      folder on the server (default: $TARGET_DIR; or set DEPLOY_DIR)
      --skip-build    deploy what is already in dist/curator-tool-frontend
      --no-prune      keep top-level files the new build no longer has (by default they are removed:
                      old hashed .js/.css; never folders or .htaccess)
      --no-backup     do not save a backup of the live folder first
  -n, --dry-run       show what would be done, change nothing
  -y, --yes           do not ask for confirmation
  -h, --help          show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--server) SERVER="${2:?--server needs a host name}"; shift 2 ;;
    -d|--dir) TARGET_DIR="${2:?--dir needs a path}"; shift 2 ;;
    --skip-build) BUILD=0; shift ;;
    --no-prune) PRUNE=0; shift ;;
    --prune) PRUNE=1; shift ;;   # the default; still accepted
    --no-backup) BACKUP=0; shift ;;
    -n|--dry-run) DRY_RUN=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

say() { printf '\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33mWarning: %s\033[0m\n' "$*" >&2; }
die() { printf '\033[31mError: %s\033[0m\n' "$*" >&2; exit 1; }
run() { if [[ $DRY_RUN -eq 1 ]]; then echo "[dry run] $*"; else "$@"; fi; }

# Work from the repository root, wherever the script is called from.
cd "$(dirname "$0")/.."
[[ -f angular.json ]] || die "run this from the curator-tool-frontend repository"

DIST_DIR="dist/curator-tool-frontend"
STAMP="$(date +%Y%m%d_%H%M%S)"
TARBALL="dist/curator-tool-frontend.tgz"
REMOTE_TARBALL="/tmp/curator-tool-frontend_${STAMP}.tgz"
REMOTE_BACKUP="/tmp/curatortool_backup_${STAMP}.tgz"

# --- what is being deployed ---------------------------------------------------------------------
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
say "Deploying $BRANCH @ $COMMIT to $SERVER:$TARGET_DIR"
if [[ $BUILD -eq 1 ]] && [[ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]]; then
  warn "there are uncommitted changes; they will be part of this build:"
  git status --short --untracked-files=no >&2
fi
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  AHEAD="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
  [[ "$AHEAD" != "0" ]] && warn "$AHEAD local commit(s) not pushed yet"
fi

# --- check the server before building ----------------------------------------------------------
say "Checking $SERVER"
ssh -o ConnectTimeout=15 "$SERVER" "test -d $(printf %q "$TARGET_DIR")" \
  || die "cannot reach $SERVER, or $TARGET_DIR does not exist there (use -s / -d to change them)"

# --- build ----------------------------------------------------------------------------------------
if [[ $BUILD -eq 1 ]]; then
  say "Building (ng build --base-href=$BASE_HREF)"
  run npx ng build --base-href="$BASE_HREF"
fi
if [[ $DRY_RUN -eq 0 ]] || [[ $BUILD -eq 0 ]]; then
  [[ -f "$DIST_DIR/index.html" ]] || die "$DIST_DIR/index.html not found: build first, or drop --skip-build"
  grep -q "<base href=\"$BASE_HREF\">" "$DIST_DIR/index.html" \
    || die "$DIST_DIR/index.html does not have <base href=\"$BASE_HREF\"> (a development build, or built without --base-href?)"
  # A production build has hashed bundle names (main.<hash>.js); a development one does not.
  ls "$DIST_DIR"/main.*.js >/dev/null 2>&1 || die "$DIST_DIR looks like a development build (no hashed main.*.js)"
fi

# --- pack -------------------------------------------------------------------------------------------
say "Packing $DIST_DIR"
# COPYFILE_DISABLE keeps macOS tar from adding ._* metadata files.
run env COPYFILE_DISABLE=1 tar czf "$TARBALL" -C dist curator-tool-frontend
if [[ $DRY_RUN -eq 0 ]]; then
  echo "    $(du -h "$TARBALL" | cut -f1)  $TARBALL"
fi

if [[ $ASSUME_YES -eq 0 ]] && [[ $DRY_RUN -eq 0 ]]; then
  read -r -p "Deploy to $SERVER:$TARGET_DIR now? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Nothing deployed."; exit 0; }
fi

# --- upload -----------------------------------------------------------------------------------------
# The server-side steps go up as a script of their own and run with bash, whatever the login shell is there.
REMOTE_SCRIPT_FILE="$(mktemp "${TMPDIR:-/tmp}/curatortool_deploy.XXXXXX")"
trap 'rm -f "$REMOTE_SCRIPT_FILE"' EXIT
cat > "$REMOTE_SCRIPT_FILE" <<'REMOTE'
set -euo pipefail
target="$1"; tarball="$2"; backup="$3"; do_backup="$4"; do_prune="$5"; base_href="$6"
trap 'rm -f "$tarball" "$0"' EXIT
owner="$(stat -c %U "$target")"
[ -f "$target/.htaccess" ] || echo "Warning: $target/.htaccess is missing (see README.md); the app will not route without it." >&2
# A team-writable folder (and assets/ in it) is written directly; otherwise as the folder's owner, through sudo.
if [ -w "$target" ] && { [ ! -e "$target/assets" ] || [ -w "$target/assets" ]; }; then
  direct=1
  echo "    folder is writable by you: no sudo needed"
  as_owner() { "$@"; }
else
  direct=0
  echo "    folder owner: $owner (writing through sudo)"
  sudo -v
  as_owner() { sudo -u "$owner" "$@"; }
fi
if [ "$do_backup" = 1 ]; then
  if [ "$direct" = 1 ]; then tar czf "$backup" -C "$target" .; else sudo tar czf "$backup" -C "$target" .; sudo chmod 644 "$backup"; fi
  echo "    backup: $backup"
fi
# Over the existing folder: never delete and re-create it, and leave .htaccess alone. --no-overwrite-dir leaves the
# existing folders as they are: without it tar resets their mode and time from the archive, which a teammate who
# does not own them may not do (tar then fails), and which would drop the folders' g+ws (team-writable) setting.
as_owner tar --strip-components=1 --no-same-owner --no-overwrite-dir -xzf "$tarball" -C "$target"
if [ "$direct" = 1 ]; then
  # What was just unpacked belongs to you. The directories' g+w is what lets a teammate replace it; making your
  # own files and any folder the build added group-writable too keeps it working where tar would overwrite in place.
  find "$target" -user "$(id -un)" -exec chmod g+w {} + 2>/dev/null || true
fi
if [ "$do_prune" = 1 ]; then
  # Top-level files only (never folders, never .htaccess) that the new build does not have: old hashed bundles.
  keep="$(tar tzf "$tarball" | sed -e 's#^[^/]*/##' -e '/\//d' -e '/^$/d')"
  for f in "$target"/* ; do
    name="$(basename "$f")"
    [ -f "$f" ] || continue
    [ "$name" = ".htaccess" ] && continue
    if ! printf '%s\n' "$keep" | grep -qxF "$name"; then
      echo "    removing old $name"
      as_owner rm -f -- "$f"
    fi
  done
fi
grep -q "<base href=\"$base_href\">" "$target/index.html" \
  || { echo "Error: the deployed index.html lacks <base href=\"$base_href\">" >&2; exit 1; }
echo "    deployed: $(ls "$target" | wc -l) entries in $target"
REMOTE
REMOTE_SCRIPT="/tmp/curatortool_deploy_${STAMP}.sh"

say "Uploading to $SERVER:/tmp"
run scp -q "$TARBALL" "$SERVER:$REMOTE_TARBALL"
run scp -q "$REMOTE_SCRIPT_FILE" "$SERVER:$REMOTE_SCRIPT"

# --- unpack on the server ----------------------------------------------------------------------------
# -t gives sudo a terminal to ask for the password.
say "Unpacking over $TARGET_DIR on $SERVER (asks for your sudo password unless the folder is team-writable)"
run ssh -t "$SERVER" "bash $(printf %q "$REMOTE_SCRIPT") $(printf %q "$TARGET_DIR") $(printf %q "$REMOTE_TARBALL") \
$(printf %q "$REMOTE_BACKUP") $BACKUP $PRUNE $(printf %q "$BASE_HREF")"

if [[ $DRY_RUN -eq 1 ]]; then say "Dry run finished: nothing was changed"; exit 0; fi
say "Done: $BRANCH @ $COMMIT is live on $SERVER"
if [[ $BACKUP -eq 1 ]]; then
  echo "To roll back:"
  echo "  ssh -t $SERVER 'tar -xzf $REMOTE_BACKUP -C $TARGET_DIR'    (prefix tar with: sudo -u <folder owner>, if the folder is not team-writable)"
fi
echo "Reload the page in the browser (a hard reload if the old version still shows)."
