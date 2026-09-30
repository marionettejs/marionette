# Quick-start acquisition

2026-09-30. Checklist step 7 separates candidate preparation from the consumer's
first UI. The framework-wide structure, rendering lesson and optional-data boundary
remain the same.

## Change

- `docs/quick-start.md` begins with supplied, matching rc.2 tarballs in a workspace.
  Its project commands create a sibling application without a framework checkout.
- `CONTRIBUTING.md#prepare-candidate-packages` owns installation, build and packing
  of all five packages. Core is packed from `.package`, including consumer docs.
  The contributor guide stays outside the installed consumer corpus.
- Setup describes the optional data tarball as supplied with the candidate.
  Local artifact installation remains explicit; a registry path is unverified.
- `test/docs/quick-start.mjs` executes the actual setup fence and builds the actual
  HTML/JavaScript fences. The installed-doc check now includes it. Optional browser
  checks use an external harness rather than adding test dependencies to the app.

## Verification

Node 24.19.0, npm 11.17.0, macOS arm64. Existing compiled package builds were used;
no runtime source changed and no dependency versions were changed. The five-package
pack command produced the matching filenames referenced by the guide. This run did
not reinstall or rebuild the framework from a clean checkout.

- Seven export tests passed; site build and 1,104 internal links passed.
- The existing `docs-quick-start` installed fixture passed rendering, replacement,
  destruction and optional-data absence.
- Fresh installed-doc verification passed: 38 pages, 26 assets, 48 executable
  reference fences, 20 declaration fixtures, 15 TypeScript examples, discovery and
  the new quick-start command/build check.
- The isolated quick start passed in Chromium, Firefox and WebKit, with the expected
  heading and no page errors. Dev-server host and ephemeral port arguments are
  harness additions to the documented `npm run dev` command.
- Targeted lint and `git diff --check` passed.

The consumer workspace is outside the repository, with no ancestor `node_modules`.
Empty npm user/global configs and a controlled npm executable avoid borrowing the
checkout's configuration. Each installed Marionette package resolves to a supplied
file tarball with matching version and SHA-512 integrity; optional data is absent.
The installed quick-start bytes match the page used to execute the commands.

Evidence: [installed delivery](evidence/acquisition-installed-20260930.json),
[three browsers](evidence/acquisition-browser-20260930.json), and
[existing fixture](evidence/acquisition-fixture-20260930.json).
Corpus SHA-256: `c91c223e4cf4956bc34450c48fd83ef6a59c44d903eceae81c1e69640e7e154a`.
Source revision is `b1a2b39e6bde6ce5605b0cfff00f9408652f4b39` with working changes.

## Review and limits

The [Claude review](/Users/paulfalgout/.ai-reviews/20260930T093907Z-review-with-claude.md)
received the three-page acquisition diff, planned verifier and available checks.
It supported contributor-only preparation and accurate publication wording, while
requiring actual command-path evidence. Its useful refinements—isolated npm configs
and explicit local lockfile resolution—were implemented and tested. The installed
pipeline already required registry access for third-party dependencies; that
requirement is now stated in the test guide.

**Strength:** consumers can reach a working UI from supplied artifacts, and a durable
check exercises the instructions rather than reconstructing their installation.
**Weakness:** this is still a maintainer handoff, without a verified public registry
acquisition path. Current-host success does not establish other npm versions,
operating systems, independent reader outcomes, or production deployment.

The three reserved reader tasks were not read or changed. Their freeze-file hash
remains `07228243b5d15bea762bc72d9e2f4d6b36bc7a5c790688f321b6715726ddddc6`.
Step 8 is the next boundary: freeze the authoring corpus, align exact delivery, and
declare a small matched fresh-reader comparison before running it. These checks
establish recipe/delivery correctness, not improved documentation effectiveness.
