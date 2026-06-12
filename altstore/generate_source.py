#!/usr/bin/env python3
"""GitHub ReleasesからAltStoreソース(apps.json)を生成して_siteに出力する"""
import glob
import json
import os
import shutil
import urllib.request

REPO = os.environ.get("GITHUB_REPOSITORY", "AichiroFunakoshi/Bridge-TTS-Codex-")
PAGES_BASE = "https://aichirofunakoshi.github.io/Bridge-TTS-Codex-"
DESCRIPTION = (
    "日本語と英語のリアルタイム音声翻訳アプリ。\n"
    "音声認識で文字起こしし、OpenAI APIで翻訳、音声で読み上げます。\n"
    "利用にはOpenAI APIキーが必要です。"
)


def fetch_releases():
    req = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/releases?per_page=30",
        headers={"Accept": "application/vnd.github+json"},
    )
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as res:
        return json.load(res)


def build_versions(releases):
    versions = []
    for release in releases:
        if release.get("draft") or release.get("prerelease"):
            continue
        asset = next(
            (a for a in release.get("assets", []) if a["name"].endswith(".ipa")),
            None,
        )
        if asset is None:
            continue
        version = release["tag_name"].lstrip("v")
        notes = (release.get("body") or "").strip()
        versions.append({
            "version": version,
            "date": release.get("published_at") or release.get("created_at"),
            "localizedDescription": notes[:3000] or f"BridgeTTS v{version}",
            "downloadURL": asset["browser_download_url"],
            "size": asset["size"],
            "minOSVersion": "16.0",
        })
    return versions


def main():
    versions = build_versions(fetch_releases())
    source = {
        "name": "BridgeTTS Source",
        "identifier": "com.a16.bridgetts.source",
        "subtitle": "日英リアルタイム音声翻訳",
        "website": f"https://github.com/{REPO}",
        "iconURL": f"{PAGES_BASE}/icon.png",
        "apps": [{
            "name": "BridgeTTS",
            "bundleIdentifier": "com.a16.bridgetts",
            "developerName": "A_1_6",
            "subtitle": "日英リアルタイム音声翻訳",
            "localizedDescription": DESCRIPTION,
            "iconURL": f"{PAGES_BASE}/icon.png",
            "tintColor": "#4292CD",
            "category": "utilities",
            "versions": versions,
        }],
    }

    os.makedirs("_site", exist_ok=True)
    with open("_site/apps.json", "w", encoding="utf-8") as f:
        json.dump(source, f, ensure_ascii=False, indent=2)
    shutil.copy("images/icons/ios-appicon-1024.png", "_site/icon.png")

    # PWA本体もPagesルートで配信する（apps.json / altstore.html と同居）
    web_files = ["index.html", "howto.html", "manifest.json", "sw.js", "style.css"]
    web_files += [p for p in sorted(glob.glob("*.js")) if p != "playwright.config.js"]
    for path in web_files:
        shutil.copy(path, os.path.join("_site", os.path.basename(path)))
    shutil.copytree("images", os.path.join("_site", "images"), dirs_exist_ok=True)

    source_url = f"{PAGES_BASE}/apps.json"
    with open("_site/altstore.html", "w", encoding="utf-8") as f:
        f.write(f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BridgeTTS - AltStoreソース</title>
<style>
body {{ font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; line-height: 1.7; }}
img {{ width: 96px; border-radius: 22px; }}
code {{ background: #f0f0f0; padding: 2px 6px; border-radius: 4px; word-break: break-all; }}
.btn {{ display: inline-block; background: #4292CD; color: #fff; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 600; }}
</style>
</head>
<body>
<img src="icon.png" alt="BridgeTTS">
<h1>BridgeTTS</h1>
<p>日英リアルタイム音声翻訳アプリのAltStoreソースです。</p>
<p><a class="btn" href="altstore://source?url={source_url}">AltStoreにソースを追加</a></p>
<p>上のボタンが動かない場合は、AltStoreの「Sources」→「＋」に次のURLを貼り付けてください：</p>
<p><code>{source_url}</code></p>
<p>インストールには各自のMac/PCでのAltServerセットアップが必要です。詳細は<a href="https://github.com/{REPO}/blob/main/docs/IOS_APP.md">手順書</a>を参照。</p>
</body>
</html>
""")
    print(f"generated _site/apps.json ({len(versions)} versions)")


if __name__ == "__main__":
    main()
