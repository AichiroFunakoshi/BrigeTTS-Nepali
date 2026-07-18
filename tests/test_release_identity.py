import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "generate_source", ROOT / "altstore" / "generate_source.py"
)
GENERATE_SOURCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GENERATE_SOURCE)


class IndependentReleaseIdentityTests(unittest.TestCase):
    """日英版とネパール版の配布識別子が再び混同されないことを検証する。"""

    def test_nepali_app_has_independent_identifiers(self):
        """Bundle IDとAltStoreソースIDがネパール版固有であることを確認する。"""
        self.assertEqual(
            GENERATE_SOURCE.APP_BUNDLE_IDENTIFIER,
            "com.a16.bridgetts.nepali",
        )
        self.assertEqual(
            GENERATE_SOURCE.SOURCE_IDENTIFIER,
            "com.a16.bridgetts.nepali.source",
        )

        project = (ROOT / "ios" / "project.yml").read_text(encoding="utf-8")
        info_plist = (ROOT / "ios" / "App" / "Info.plist").read_text(
            encoding="utf-8"
        )
        self.assertIn(
            "PRODUCT_BUNDLE_IDENTIFIER: com.a16.bridgetts.nepali",
            project,
        )
        self.assertIn("PRODUCT_NAME: BrigeTTSNepali", project)
        self.assertIn("<string>BrigeTTS(Nepali)</string>", info_plist)
        self.assertNotIn(
            "PRODUCT_BUNDLE_IDENTIFIER: com.a16.bridgetts\n",
            project,
        )

        source = GENERATE_SOURCE.build_source([])
        self.assertEqual(source["identifier"], GENERATE_SOURCE.SOURCE_IDENTIFIER)
        self.assertEqual(
            source["apps"][0]["bundleIdentifier"],
            GENERATE_SOURCE.APP_BUNDLE_IDENTIFIER,
        )
        self.assertEqual(
            source["website"],
            "https://github.com/AichiroFunakoshi/BrigeTTS-Nepali",
        )
        self.assertEqual(
            source["iconURL"],
            "https://aichirofunakoshi.github.io/BrigeTTS-Nepali/icon.png",
        )

    def test_current_release_version_and_artifact_names_are_consistent(self):
        """現行版数と固有IPA名がビルド設定全体で一致することを確認する。"""
        project = (ROOT / "ios" / "project.yml").read_text(encoding="utf-8")
        package = (ROOT / "package.json").read_text(encoding="utf-8")
        package_lock = (ROOT / "package-lock.json").read_text(encoding="utf-8")
        index = (ROOT / "index.html").read_text(encoding="utf-8")
        smoke = (ROOT / "tests" / "smoke.test.js").read_text(encoding="utf-8")
        service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
        workflow = (
            ROOT / ".github" / "workflows" / "ios-build.yml"
        ).read_text(encoding="utf-8")

        self.assertIn('MARKETING_VERSION: "1.0.1"', project)
        self.assertIn('"version": "1.0.1"', package)
        self.assertIn('"version": "1.0.1"', package_lock)
        self.assertIn("BrigeTTS(Nepali) v1.0.1", index)
        self.assertIn("BrigeTTS(Nepali) v1.0.1", smoke)
        self.assertIn("brige-tts-nepali-v2", service_worker)
        self.assertIn("BrigeTTSNepali.app", workflow)
        self.assertIn(GENERATE_SOURCE.IPA_FILENAME, workflow)
        self.assertIn("BrigeTTS-Nepali-unsigned-ipa", workflow)
        self.assertNotIn("BridgeTTS.app", workflow)
        self.assertNotIn("BridgeTTS-unsigned.ipa", workflow)
        self.assertNotIn("BridgeTTS-unsigned-ipa", workflow)

    def test_only_nepali_ipa_is_published(self):
        """英語版IPAを無視し、ネパール版IPAだけを配布対象にすることを確認する。"""
        releases = [{
            "tag_name": "v1.0.1",
            "published_at": "2026-07-18T00:00:00Z",
            "body": "Initial release",
            "assets": [
                {
                    "name": "BridgeTTS-unsigned.ipa",
                    "browser_download_url": "https://example.invalid/english.ipa",
                    "size": 1,
                },
                {
                    "name": GENERATE_SOURCE.IPA_FILENAME,
                    "browser_download_url": "https://example.invalid/nepali.ipa",
                    "size": 2,
                },
            ],
        }]

        versions = GENERATE_SOURCE.build_versions(releases)

        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]["version"], "1.0.1")
        self.assertEqual(
            versions[0]["downloadURL"],
            "https://example.invalid/nepali.ipa",
        )


if __name__ == "__main__":
    unittest.main()
