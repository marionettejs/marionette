# Upstream maintenance

The base is `lit-html@3.3.3`, identified by the npm archive integrity in
[PROVENANCE.md](./PROVENANCE.md). This is a browser-runtime fork, not an automatic
mirror of Lit. Review upstream changes against our documented public subset.

## Check the retained fixtures

The commands and paths in this guide require the repository checkout, not the
installed npm package. Run `npm run check:upstream` in this package. The dependency-free check also runs
inside `npm run check` in CI. It verifies the 11 pristine fixture/support files
against their pre-existing Git blob IDs in `vendor/lit-html-3.3.3/test/manifest.json`,
including the Git blob byte-length header. It rejects missing or extra vendored
files, changed license/package metadata, and drift in the local marker helper.
Do not regenerate expected hashes to make a changed fixture pass. Deliberate
upstream updates require separately verified source identity and review.

`test/upstream-markers.mjs` is the testing-utils.ts fixture with only `: string`
type annotations removed. The checker verifies that exact derivation. Its string
replacements normalize marker strings for assertions; they are not sanitizers,
and their results are not inserted into a DOM sink. The test harness adapts
imports, runner setup and the explicitly recorded subset, not fixture assertions.
Neither test nor vendor files are included in the npm archive.

## Recover the original implementation for comparison

The 28 duplicate implementation files were not imported by runtime, builds or the
test runner. They were removed to keep only exercised fixtures in the checkout.
Their exact SHA-256 digests, source-map filenames and source selectors remain in
`vendor/lit-html-3.3.3/sources.json`, alongside the pinned archive URL/SRI.

Obtain `lit-html-3.3.3.tgz` from that registry URL or a verified local npm cache,
then run from this package:

```sh
node scripts/recover-upstream.mjs /path/to/lit-html-3.3.3.tgz /path/to/new-comparison-directory
```

The offline script verifies the full archive SHA-512 before reading any source
map with `tar`, requires exactly one matching sourcesContent entry per file,
checks every recovered SHA-256, and preserves the original LICENSE and package
metadata. It refuses an existing destination. It never downloads files or writes
into the authored source tree. Recovery needs Node and `tar`; fixture checks need
only Node. Test fixtures instead come from the exact Git blob IDs/URLs in their
manifest, not the npm source maps. Recovery does not restore removed files into
vendor or change the expected fixture set.

## Local change inventory

- Base renderer/directives/static helpers derive from the pinned source maps.
  [LIT_DIFFERENCES.md](./LIT_DIFFERENCES.md) records deliberate API removals,
  namespacing, production/debug separation and native-move behavior. Unchanged
  upstream algorithms are not claimed as new implementations.
- The Marionette DOM adapter, package build/test harness and integration docs are
  local work; adapter lineage is separately recorded in PROVENANCE.md.
- `asyncAppend` typing follows merged upstream commit `16507ef656417c9c53a55a02a44a563bbbf2c484`.
- Child cleanup in `keyed` follows open PR #5413 at `022c3dad`; escaped CSS names
  in `styleMap` follow open PR #5396 at `5a85c133`. These are independently tested
  adoptions, not claims that either PR shipped upstream.
- Nested synchronous-wrapper async disposal and `--!>` comment recognition are
  local public-regression fixes. The former preserves detach/reconnect and
  synchronous error semantics; the latter matches browser comment parsing.
- The Rollup lock repair changes no dependency versions. The synthetic sanitizer
  hook fixture tests callback observation/rejection, not built-in URL security.

See [PROVENANCE.md](./PROVENANCE.md) for upstream links and detailed rationale,
and `test/public-regressions.mjs` for shared Node/browser behavioral proofs.
No upstream change should be adopted solely because it is newer or resolves a
scanner warning. Preserve licensing and validate the actual supported behavior.
