# Release checklist

A release is complete when the published packages, GitHub release, website,
playground, and documentation MCP identify the intended version and verified
source. Copy this checklist into the release's tracking issue or PR and attach
evidence as each step finishes. A green build alone does not complete a step.

The [package promotion procedure](../release-promotion.md) owns npm and GitHub
publication. The [website runbook](https://github.com/marionettejs/marionettejs.com/blob/main/mcp/DEPLOYMENT.md)
owns website and MCP deployment commands. Use their current procedures rather than
copying credentials or provider configuration into this checklist.

## Record the release

| Record | Value to capture |
| --- | --- |
| Target | Version, Git tag, npm dist-tag, GitHub prerelease/stable status |
| Library | Clean source commit, PR, CI run, exact artifact and validation report |
| Packages | `marionette`, `@mnjs/utils`, `@mnjs/radio`, `@mnjs/data`, `@mnjs/adapters`; versions and integrity |
| Website | Import PR, merged source commit, documentation manifest/hash, runtime version/integrity |
| Deployments | Website deployment ID, MCP deployment/version ID, catalog provenance and corpus hash |
| Recovery | Previous verified npm tag targets, website deployment, MCP deployment, and known limitations |
| Approval | Exact publication/deployment scope and maintainer authorization |

## 1. Prepare and certify the library

- [ ] Review the changelog, migration guidance, beta limitations, and resolved
  issues. Separate shipped behavior from unmeasured agent-effectiveness claims.
- [ ] Align all five package versions, internal requirements, locks, README install
  commands, release policy, and generated contract inventory. Before stable v5,
  publish the current prerelease on `latest`; reserve `next` for later prereleases
  after stable v5. Record the actual tag effects from the policy.
- [ ] Write a fresh, lightly snarky opening about what this release actually changes.
  Put it as a single-line blockquote immediately below that version's heading in
  `changelog.md`. Review it with the changes; do not reuse a generic slogan or claim
  unmeasured improvements. The release generator reads that version's opener from
  the verified source commit, and the dry run reports it and rejects a missing one.
  Keep exact-commit changelog/migration links, install instructions, prerelease
  status, known limits, and artifact evidence below it. Verify the staged and live
  notes as well; generation does not overwrite an existing matching release.
- [ ] Complete PR checks and review, merge normally, then certify the clean final
  source commit. A new commit requires new evidence, even for documentation edits.
- [ ] Run `release:artifact` and `release:validate` according to the promotion
  procedure, or the manual workflow with `publish` false. Retain the exact tarballs
  and successful validation report. Never rebuild between certification and publish.
- [ ] Verify supported Linux, macOS, and Windows package checks and the required
  browser/fixture evidence. A platform skipped on PRs still needs its release check.
- [ ] Inspect npm/tag/release target occupancy, publisher access, all five trusted
  publishers, and protected environment settings. Record prior recovery targets.

## 2. Publish and verify packages and GitHub

- [ ] Obtain authorization for the exact version/tag, all five packages, dist-tag
  effects, and GitHub release. Checklist preparation does not authorize publication.
- [ ] Run the protected manual publication workflow from the certified source and
  approve its environment. Use the verified artifacts and normal recovery path.
- [ ] Verify all five registry versions, integrity, dist-tags, and provenance;
  verify the Git tag resolves to the certified commit and GitHub assets match.
- [ ] In a clean directory outside the checkout, install the exact published
  versions from npm without local tarballs, links, overrides, or checkout resolution.
  Run `npm audit signatures` and the installed starter's validation and browser
  tests. Check packaged agent docs/skill discovery, consumer lint, and source maps
  from the actual installed distribution. Record commands and results.
- [ ] Read the public release page: opening line first, working links, correct
  install command/status, matching assets, and no unsupported readiness claims.

## 3. Prepare the matching website and MCP

- [ ] Export documentation from the clean released library commit using
  `npm run docs:export`; import it into `marionettejs/marionettejs.com` using
  `npm run docs:import -- /absolute/path/to/.docs-export`. See the
  [documentation publication guide](../../docs-site/README.md).
- [ ] Update website package/lockfile pins and the vendor builder's explicit
  version checks; run `npm run vendor:build`. Verify playground/recipe runtime
  provenance, licenses, integrity, and bundle hash against the published packages.
  Importing documentation alone does not update the runtime.
- [ ] Review publication overlays and supplemental guides against the new snapshot.
  Remove obsolete overrides now covered by canonical docs; preserve immutable
  packaged Markdown. Update homepage/footer labels, install commands, release
  links, README, MCP setup examples, and version-specific tests. Preserve intentional
  historical references rather than globally replacing every old version string.
- [ ] Rebuild HTML, Markdown, search, `llms.txt`, agent briefs, and the MCP corpus
  from the reviewed snapshot. Verify exact version/source agreement and check that
  adding support for the new version does not silently substitute it for old requests.
- [ ] Run website checks, agent-resource checks, real browser/workshop tests, and
  local HTTP/stdio MCP parity against the complete new corpus. Review desktop/mobile
  layout and copyable commands, including the Markdown controls above headings.
- [ ] Review and merge the website PR normally. Test the final merged source and
  record complete artifact hashes, previous deployment IDs, and deployment approval.

## 4. Deploy and verify the public surfaces

- [ ] Manually deploy the MCP snapshot and the complete website artifact using the
  website runbook. npm publication does not deploy either surface. During any gap,
  keep the old snapshot labeled accurately and direct new-version users to bundled
  docs; do not announce matching hosted support before verification.
- [ ] Through a real MCP client, verify initialization, tool discovery, catalog
  version/source, search, every complete document and example through pagination,
  unsupported-version rejection, and parity with the tested local corpus.
- [ ] Measure deployed MCP CPU/errors with a bounded sample. Record provider limits,
  measured tail behavior, and accepted limitations; successful requests alone do not
  prove reliable operation within the free budget. Reassess after corpus changes.
- [ ] Verify public HTML and Markdown against the artifact; check provenance,
  search results, `llms.txt`, agent/skill instructions, install commands, release
  links, diagnostics, canonical hostname, redirects, and indexing policy. Check for
  stale CDN content or transformations that corrupt commands.
- [ ] Exercise the live playground and WebMCP where supported, including draft/focus
  retention, selection, cancellation, and cleanup. Use a returning browser as well
  as a fresh one to check cached assets/service-worker behavior. Record the runtime
  version actually exercised; MCP retrieval alone does not establish app behavior.

## 5. Close the release or recover

- [ ] Attach package, GitHub, website, and MCP verification evidence to the release
  record, including exact deployment IDs and any remaining accepted limitations.
  Mark publication, deployment, and verification separately so a partial release
  cannot look complete. Only then describe the coordinated release as ready.
- [ ] If a stage fails, record its state and follow that surface's recovery procedure.
  Preserve immutable npm versions and GitHub assets. Restore a verified website or
  MCP deployment when appropriate; do not silently change npm tags as part of a
  website rollback. Record any temporary version mismatch and consumer guidance.
- [ ] After the release tag exists, review Context7's source configuration. Our
  `context7.json` selects `master`, which can contain unreleased work; a refresh of
  that branch is not an exact release snapshot. Add the published tag through the
  reviewed `previousVersions` configuration or owner version settings before
  claiming version-specific support. See [Context7 configuration](https://context7.com/docs/library-owners).
- [ ] Trigger an authorized refresh of `/marionettejs/marionette` through its
  signed-in library page or authenticated refresh API after configuration lands.
  Record completion and test representative version-specific queries against the
  released docs. Archive the exact library/version ID, queries, returned results,
  retrieval time, and indexed commit/tag when exposed. If source metadata is absent,
  record that limitation rather than claiming exact-revision verification.
  Distinguish queued indexing from verified retrieval. See
  [Context7 refreshes](https://context7.com/docs/library-updates).
- [ ] Record Context7 indexing lag or unsupported version selection as an optional
  distribution gap. Keep first-party versioned docs available independently; do not
  block their publication on a third-party index. Publish announcements only when
  separately authorized.
