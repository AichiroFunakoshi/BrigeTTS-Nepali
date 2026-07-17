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
    def test_nepali_app_has_independent_identifiers(self):
        self.assertEqual(
            GENERATE_SOURCE.APP_BUNDLE_IDENTIFIER,
            "com.a16.bridgetts.nepali",
        )
        self.assertEqual(
            GENERATE_SOURCE.SOURCE_IDENTIFIER,
            "com.a16.bridgetts.nepali.source",
        )

        project = (ROOT / "ios" / "project.yml").read_text(encoding="utf-8")
        self.assertIn(
            "PRODUCT_BUNDLE_IDENTIFIER: com.a16.bridgetts.nepali",
            project,
        )
        self.assertNotIn(
            "PRODUCT_BUNDLE_IDENTIFIER: com.a16.bridgetts\n",
            project,
        )

    def test_first_release_version_and_artifact_names_are_consistent(self):
        project = (ROOT / "ios" / "project.yml").read_text(encoding="utf-8")
        package = (ROOT / "package.json").read_text(encoding="utf-8")
        index = (ROOT / "index.html").read_text(encoding="utf-8")
        workflow = (
            ROOT / ".github" / "workflows" / "ios-build.yml"
        ).read_text(encoding="utf-8")

        self.assertIn('MARKETING_VERSION: "1.0.0"', project)
        self.assertIn('"version": "1.0.0"', package)
        self.assertIn("BrigeTTS(Nepali) v1.0.0", index)
        self.assertIn(GENERATE_SOURCE.IPA_FILENAME, workflow)
        self.assertNotIn("BridgeTTS-unsigned.ipa", workflow)

    def test_only_nepali_ipa_is_published(self):
        releases = [{
            "tag_name": "v1.0.0",
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
        self.assertEqual(versions[0]["version"], "1.0.0")
        self.assertEqual(
            versions[0]["downloadURL"],
            "https://example.invalid/nepali.ipa",
        )


if __name__ == "__main__":
    unittest.main()
