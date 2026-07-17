#!/usr/bin/env bash
# WebアプリのアセットをiOSアプリバンドル用（ios/App/www）にコピーし、
# アプリアイコン（1024x1024）を生成する。
# XcodeGenの実行・Xcodeビルドの前に必ず実行すること。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WWW="$ROOT/ios/App/www"

echo "==> Webアセットを $WWW にコピー"
rm -rf "$WWW"
mkdir -p "$WWW"

cp "$ROOT/index.html" "$ROOT/howto.html" "$ROOT/style.css" "$ROOT/manifest.json" "$WWW/"
cp "$ROOT"/*.js "$WWW/"
# 開発専用ファイルはバンドルに含めない
rm -f "$WWW/playwright.config.js"
cp -R "$ROOT/images" "$WWW/images"

echo "==> アプリアイコンを生成"
ICONSET="$ROOT/ios/App/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ICONSET"

cat > "$ICONSET/Contents.json" <<'JSON'
{
  "images" : [
    {
      "filename" : "AppIcon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON

if [ -f "$ROOT/images/icons/ios-appicon-1024.png" ]; then
    # iOS専用ネパール語版1024pxアイコンを最優先で使用
    cp "$ROOT/images/icons/ios-appicon-1024.png" "$ICONSET/AppIcon-1024.png"
elif command -v sips >/dev/null 2>&1; then
    # macOS: sipsで512px→1024pxにリサイズ
    sips -z 1024 1024 "$ROOT/images/icons/icon-512x512.png" \
        --out "$ICONSET/AppIcon-1024.png" >/dev/null
elif command -v magick >/dev/null 2>&1; then
    magick "$ROOT/images/icons/icon-512x512.png" -resize 1024x1024 "$ICONSET/AppIcon-1024.png"
elif command -v convert >/dev/null 2>&1; then
    convert "$ROOT/images/icons/icon-512x512.png" -resize 1024x1024 "$ICONSET/AppIcon-1024.png"
else
    echo "警告: sips/ImageMagickが見つかりません。512pxアイコンをそのまま使用します（Xcodeが警告を出す場合があります）。" >&2
    cp "$ROOT/images/icons/icon-512x512.png" "$ICONSET/AppIcon-1024.png"
fi

echo "==> 完了"
