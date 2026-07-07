#!/usr/bin/env bash
# Cowork（Claudeサンドボックス）セッション用セットアップ
#
# 目的: 新しいCoworkセッションのLinuxサンドボックスで `npm run test:smoke` を
#       実行可能にする（Chromium導入 + 不足ライブラリのスタブ生成）。
#
# 使い方: リポジトリ直下で `bash scripts/cowork-setup.sh`
#   - サンドボックスのシェルは1回あたり約45秒でタイムアウトするため、
#     「✅ セットアップ完了」が出るまで同じコマンドを繰り返し実行する（再実行安全・途中再開可）。
#   - 前提: `npm install` 済み（node_modules が必要）。
#
# 背景（2026-07-03確認）:
#   - `npx playwright install` は45秒制限内に完了せず、バックグラウンド実行は
#     シェル終了時に殺されるため使えない。curl -C - の分割再開ダウンロードで代替する。
#   - apt/deb/conda はプロキシで遮断。不足するのは libXdamage.so.1 のみなので
#     空スタブを gcc でコンパイルして LD_LIBRARY_PATH で解決する。

set -uo pipefail

# Macでは不要（実機開発は通常のnpmフローを使う）
if [ "$(uname -s)" = "Darwin" ]; then
  echo "このスクリプトはCoworkサンドボックス(Linux)専用です。Macでは不要。"
  exit 0
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -z "$REPO_DIR" ] || ! cd "$REPO_DIR"; then
  echo "❌ リポジトリディレクトリに移動できません: ${REPO_DIR:-（解決失敗）}" >&2
  exit 1
fi

echo "== 1/4 gitロック掃除 =="
rm -f .git/HEAD.lock .git/index.lock .git/ORIG_HEAD.lock .git/objects/*/tmp_obj_* 2>/dev/null \
  || echo "  (削除不可のロックあり: Coworkのファイル削除許可を得るか、Mac側で掃除する)"

echo "== 2/4 Chromiumダウンロード =="
REV=$(node -e "console.log(require('$REPO_DIR/node_modules/playwright-core/browsers.json').browsers.find(b=>b.name==='chromium').revision)" 2>/dev/null)
if [ -z "$REV" ]; then
  echo "❌ Chromiumリビジョンを特定できません。npm install 済みか確認してください。" >&2
  exit 1
fi
ARCH=$(uname -m)
SUFFIX="linux"; [ "$ARCH" = "aarch64" ] && SUFFIX="linux-arm64"
BASE="https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/chromium/$REV"
CACHE="$HOME/.cache/ms-playwright"

fetch_and_unzip() { # $1=zipファイル名 $2=展開先ディレクトリ名
  local dir="$CACHE/$2" zip="/tmp/$1"
  if [ -f "$dir/INSTALLATION_COMPLETE" ]; then
    echo "  $2: 導入済み"
    return 0
  fi
  curl -sSL -C - -o "$zip" --max-time 30 "$BASE/$1" || true
  if ! unzip -q -t "$zip" >/dev/null 2>&1; then
    echo "  $1: ダウンロード途中（再実行で続きから再開します）"
    return 1
  fi
  mkdir -p "$dir"
  if ! unzip -q -o "$zip" -d "$dir"; then
    echo "  ❌ $2: 展開失敗（ディスク容量等を確認。zipは保持したので再実行可能）" >&2
    return 1
  fi
  touch "$dir/INSTALLATION_COMPLETE" && rm -f "$zip"
  echo "  $2: 導入完了"
}

# シェル45秒制限内に収めるため、未完了が出た時点で即終了する
# （1回の実行で試みるダウンロードは実質1本。完了表示まで再実行する）
if ! fetch_and_unzip "chromium-$SUFFIX.zip" "chromium-$REV" || \
   ! fetch_and_unzip "chromium-headless-shell-$SUFFIX.zip" "chromium_headless_shell-$REV"; then
  echo "⏳ ダウンロード未完了。このスクリプトをもう一度実行してください。"
  exit 2
fi

echo "== 3/4 不足ライブラリのスタブ生成 =="
LIBDIR="$HOME/.local/lib-extra/lib"
if [ ! -f "$LIBDIR/libXdamage.so.1" ]; then
  mkdir -p "$LIBDIR"
  echo 'void XDamageAdd(void){} void XDamageCreate(void){} void XDamageDestroy(void){} void XDamageSubtract(void){} void XDamageQueryExtension(void){} void XDamageQueryVersion(void){}' > "$LIBDIR/xdamage-stub.c"
  gcc -shared -fPIC -o "$LIBDIR/libXdamage.so.1" "$LIBDIR/xdamage-stub.c"
fi
MISSING=$(LD_LIBRARY_PATH="$LIBDIR" ldd "$CACHE/chromium_headless_shell-$REV/chrome-linux/headless_shell" 2>/dev/null | grep -c "not found" || true)
if [ "$MISSING" != "0" ]; then
  echo "⚠️ まだ未解決の依存ライブラリがあります:"
  LD_LIBRARY_PATH="$LIBDIR" ldd "$CACHE/chromium_headless_shell-$REV/chrome-linux/headless_shell" | grep "not found"
  exit 1
fi

echo "== 4/4 確認 =="
echo "✅ セットアップ完了。テストは次のコマンドで実行:"
echo "   LD_LIBRARY_PATH=\$HOME/.local/lib-extra/lib npm run test:smoke -- --reporter=line"
