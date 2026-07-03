# AGENT_PLAYBOOK.md — Operating Procedures for Claude (BridgeTTS)

This is Claude's own handover-to-self: the concrete procedures for working in this
repository. Read it at session start together with `CLAUDE.md` (rules/principles)
and `docs/HANDOFF.md` (current project state). Where CLAUDE.md says *what* the
rules are, this file says *how* to execute them, tuned for token economy.

The user (Tetsuo) annotates this file directly — treat the "User notes" section
at the bottom as authoritative corrections and fold them into behavior.

---

## 1. Session start protocol

1. Work ONLY in the local clone: `~/Bridge-TTS(Codex)` (never the iCloud copy).
2. Clean stale git locks (this environment leaves them):
   `rm -f .git/HEAD.lock .git/index.lock .git/objects/*/tmp_obj_* 2>/dev/null`
3. `git checkout main && git pull --ff-only`
4. Read, in order and nothing more:
   - `CLAUDE.md` (rules — usually already in context via Cowork/Claude Code)
   - `docs/HANDOFF.md` → section "現在の最新状態" only
   - `CHANGELOG.md` → `[Unreleased]` block + latest release heading only
5. Confirm a clean tree (`git status -sb`) before touching anything.

## 2. Change workflow (branch → PR → merge)

- One feature/fix = one branch: `fix/...`, `feature/...`, `docs/...`, `release/...`.
- Bundle related small changes into ONE PR (CodeRabbit has a review rate limit;
  a stream of tiny PRs exhausts it and merges go unreviewed).
- Sequence:
  ```bash
  git checkout -b <branch>
  # edit → verify (see §4)
  git add -A && git commit -m "<type>: <summary in Japanese>"
  git push -u origin <branch>
  gh pr create --fill
  # wait ~60-80s, then:
  gh pr checks <N>            # expect: smoke pass (CodeRabbit may lag)
  gh pr merge <N> --squash --delete-branch
  git checkout main && git pull --ff-only
  ```
- Never push to main directly (protected: PR required, no force-push, no deletion).
- Keep the remote branch list = `main` only. `--delete-branch` on merge handles it;
  if strays accumulate: `git push origin --delete <branch>` after confirming merged.

## 3. CodeRabbit handling (token discipline)

- The user reads full CodeRabbit reviews manually in the browser. Do NOT pull the
  whole review into context.
- When Claude needs the verdict, read only the tail via CLI, e.g.:
  `gh pr view <N> --comments | tail -n 40`
  or the last comment only:
  `gh api repos/AichiroFunakoshi/Bridge-TTS-Codex-/issues/<N>/comments --jq '.[-1].body' | head -c 2000`
- CodeRabbit "pending" does NOT block merging when smoke is green and the change
  is low-risk; the user decides whether to wait.

## 4. Pre-PR verification (minimum set)

Per CLAUDE.md checklist; execute the cheap ones always:
- `node --check` every changed `.js`.
- `npx playwright test` locally (7+ smoke tests; CI repeats it anyway — do not run twice).
- If any cached asset changed (`index.html`, `style.css`, `*.js`, icons, `howto.html`):
  bump `CACHE_VERSION` in `sw.js`.
- Read the diff once (`git diff`) for unintended changes.
- NEVER gate a commit on a piped test command (`npx playwright test | grep ...` returns
  grep's exit code, not the tests'). Run tests to a log file, check `$?` explicitly,
  then grep the log: `npx playwright test > /tmp/pw.log 2>&1; echo exit=$?`.
- High-risk changes only: adversarial review by a fresh-context subagent.

## 5. Release procedure

1. Version sync in one PR: `ios/project.yml` (MARKETING_VERSION), `index.html`
   (title + footer), `tests/smoke.test.js` (expected strings), `package.json` (version).
2. CHANGELOG: move `[Unreleased]` content into a new `## [X.Y.Z] - date` section.
3. Merge the release PR, then tag **the exact commit that represents the release**
   (not necessarily HEAD if docs landed after):
   `git tag vX.Y.Z <sha> && git push origin vX.Y.Z`
4. Automation takes over: IPA build → GitHub Release (IPA attached) → AltStore
   source (apps.json) redeployed to Pages. Only `v*` tags fire this.
5. Verify with two cheap calls (ipa build ≈ 1-2 min, Pages CDN adds ~1 min):
   ```bash
   gh release view vX.Y.Z --json tagName,assets --jq '{tag:.tagName,assets:[.assets[].name]}'
   curl -s https://aichirofunakoshi.github.io/Bridge-TTS-Codex-/apps.json | python3 -c "import json,sys; print([v['version'] for v in json.load(sys.stdin)['apps'][0]['versions']])"
   ```
6. Rollback anchor: tag `stable-fable5-v2.3.0`. Procedure in HANDOFF.md.

## 6. Token economy (applies to every step)

- Read fragments, not files: `sed -n 'A,Bp'`, `grep -n -C3`, `--jq`, `head`/`tail`.
- Batch independent tool calls into one message; chain dependent shell steps with `&&`.
- Do not re-read a file just edited; do not re-verify what CI already verifies.
- Prefer `gh ... --jq` filters over dumping raw JSON.
- Quote gh api URLs containing `?` (zsh glob breaks otherwise).
- Long waits: NEVER put `sleep` inside a Desktop Commander call. The MCP client
  times out around ~90s (error -32001), wasting a round-trip even though the
  command itself completes on the Mac. Fire the command immediately and check
  the result in the NEXT tool call; for long jobs use `nohup ... &` + poll.
  Keep timeout_ms ≤ 45000 per call.
- Reports to the user: outcome first, no play-by-play.

## 7. Known pitfalls (learned the hard way)

- **iCloud copy is dead**: stale `.git` locks, cloud-evicted files, hour-old state.
  Never read or write it.
- Release created by GITHUB_TOKEN does not fire `release:` events → the AltStore
  source workflow triggers on `workflow_run` of the IPA build instead. Keep it so.
- Playwright on CI: Chromium can SEGV → `--disable-gpu` + `retries: CI?1:0` are
  already in `playwright.config.js`; keep them.
- Pages deploy returns 404 for ~1 min after "success" (CDN propagation). Re-check
  before diagnosing.
- `dashboard.html` is Pages-only; it is NOT part of the app bundle (prepare-www.sh
  copies an explicit file list) — no sw.js bump needed for it.
- TTS language: pass the SOURCE language to `TtsService.speak`; it inverts
  internally. Never invert at the call site.
- The in-app error-report token lives only in the Actions secret
  `ERROR_REPORT_TOKEN` (never in the repo; PAT expires 2026-09-10).

## 8. Handover discipline

- At every milestone: create `docs/handover-YYYY-MM-DD[-topic].md` AND update
  the "現在の最新状態" + list in `docs/HANDOFF.md`, then merge via PR so other
  Macs/sessions see it.
- Record durable lessons here (§7) or in HANDOFF; update instead of duplicating;
  delete what proves wrong.

---

## User notes (Tetsuo's additions — Claude: read and obey)

<!-- ここから下にユーザーが自由に書き込みます。Claudeはセッション開始時に必ず読むこと。 -->

