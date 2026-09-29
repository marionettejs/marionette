# Candidate package and documentation discovery

Historical records-slice result. See [View and Region results](view-region-results.md) for the current reference candidate.

This stage builds a local candidate from the current runtime and the new documentation. It leaves the production publisher unchanged: that pipeline still depends on deleted documentation and the former starter.

## Content delivered

- A small [documentation index](../../docs/readme.md) linked from the package README and llms.txt.
- A [quick start](../../docs/quick-start.md) that renders one View before introducing the composed records feature.
- A [core API reference](../../docs/api.md) for the example's lifecycle, ownership, Regions, state, and events.
- A [setup and data reference](../../docs/setup.md) covering Lit and the incomplete observable data layer.
- The approved records source remains the composition example. Its behavior and Application boundaries were not changed in this stage.

The core reference is task-relevant coverage, not an exhaustive API inventory. A later trial must check that its reference-only condition includes every contract required by both the build and extension tasks.

## Reproduce the candidate check

From the repository root, with Node 24 and repository/example dependencies installed:

```sh
node planning/docs-v5/probes/package-discovery.mjs
```

The probe writes full logs, hashes, and its report to `test/tmp/docs-v5-package`. It records the temporary installed-consumer location and exact tarballs. It rebuilds public runtime artifacts, packages the six new docs plus the records source, and excludes evaluator material and retired generated documentation.

The candidate removes repository-only package scripts and development metadata. This is an explicit artifact transformation for the experiment; it is not evidence that the existing release publisher produces this package. The records example is shipped as reading material, with its repository-only development commands clearly marked. The quick start is the installed-package bootstrap path.

## Recorded result

The candidate was rebuilt and all checks rerun after native destruction gained automatic incoming-listener cleanup and the example removed its manual destroy handler. See the [cleanup verification](evidence/destroy-cleanup-verification.json) for runtime regression results.

The [final evidence](evidence/package-discovery.json) records 16 successful commands on 2026-09-28: five packed packages, 41 installed relative links, **48 records browser checks**, **3 quick-start browser checks**, and both production builds. There were no retries, skipped checks, or flaky results. The quick-start bootstrap used its own installation and dependency lock; the main consumer used the frozen graph. Backbone was absent from both projects. The probe passed ESLint, and all packaged public-file hashes matched the captured working files.

The five verified tarballs are copied to `test/tmp/docs-v5-package/artifacts`. `candidate-kit.zip` in the same directory contains those tarballs under `artifacts/` and the quick-start instructions. These generated files are local artifacts, not a published release.

## What the checks establish

- The five local framework tarballs install into a separate temporary consumer from a frozen dependency lock, without workspace symlinks or ancestor/global module resolution.
- Package exports work through both ESM and CommonJS, and the advertised package.json lookup resolves the installed package.
- All six core docs are reachable by following relative links from the installed README and llms.txt. Installed bytes match the candidate hashes.
- Removing a linked API document makes discovery fail for the missing file; restoring it restores traversal.
- The packaged records source builds and passes its browser suite.
- The quick-start HTML and JavaScript are extracted from the installed Markdown and exercised as written.

These are executable packaging, discovery, and behavior checks. They do not measure whether a fresh agent chooses good architecture or benefits from the guidance.

## Review disposition

The [Claude review](evidence/reference-claude-review.json) received the new reference, setup, quick start, index, and discovery description. It flagged an ambiguous sentence about incoming listener cleanup; at that revision, the reference was corrected to require explicit stopListening(view). The subsequent v5 contract change makes native destruction release those listeners automatically and supersedes that advice. It also prompted clarification of the active-start Region conflict and removal of the duplicate installation block in setup.

Its installed-path, export, dependency, and no-Backbone questions are addressed by the package probe and source evidence. Additional contracts are backed by the [source audit](evidence/reference-contracts.md). It agreed that plain Markdown discovery is sufficient to begin a controlled trial once verified.

The [registry checks](evidence/registry-install-checks.json) found no 5.0.0-rc.2 release for marionette, @mnjs/data, or @mnjs/adapters. The quick start therefore uses the supplied candidate tarballs. Vite 8.3.0 and Lit HTML 3.3.3 were available; the probe installs those pins. No registry publication was performed.

## Strengths and remaining work

The docs now have both a short entry point and precise reference material, and the installation checks exercise the actual packaged files. This addresses the small-entrypoint and runnable-start mechanisms identified in the [peer comparison](peer-comparison.md).

Remaining work: freeze the controlled trial's task, extension, reference coverage, client/model, isolation, and budget. The production publisher and website still need a separate migration to this content before release. Broader API coverage, editing/persistence, retained refresh, and navigation remain future documentation work.
