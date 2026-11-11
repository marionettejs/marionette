# Provenance

## Lit HTML

- Upstream package: `lit-html@3.3.3`.
- Registry archive: https://registry.npmjs.org/lit-html/-/lit-html-3.3.3.tgz
- SHA-512 integrity: `sha512-el8M6jK2o3RXBnrSHX3ZKrsN8zEV63pSExTO1wYJz7QndGYZ8353e2a5PPX+qHe2aGayfnchQmkAojaWAREOIA==`.
- SHA-1: `a63fd02fb8c1c7b7057ee805ab6c612fdebef0b1`.
- Retrieved from the local npm cache and verified against the installed package lock on 2026-11-07 UTC.
- Repository: https://github.com/lit/lit/tree/lit-html%403.3.3/packages/lit-html

Authoritative TypeScript inputs were recovered from the archive's `development/*.js.map` and `development/directives/*.js.map` `sourcesContent`. Pristine test fixtures, package metadata, and the exact package license are retained under `vendor/lit-html-3.3.3/`. Its `sources.json` records exact map selectors and SHA-256 hashes for 28 unused implementation copies removed from the checkout. `UPSTREAM.md` describes verified recovery from the pinned archive. The selected implementations were copied to `src/` and modified there. The archive has no `gitHead`, so its verified package digest, rather than an inferred commit, identifies the source.

The archive's full license names **Copyright (c) 2017 Google LLC**. Individual file headers include 2017, 2018, 2020, 2021, 2022 and 2024 Google LLC notices and are retained verbatim. No later upstream copyright text is substituted for this exact release's actual notice.

Fork changes: remove event Part; reject @event/inline on* attributes/native handler bindings and foreign-engine values; namespace template/directive/root-Part brands and sentinels; remove ShadyDOM wrappers/polyfill hooks/version globals; remove production sanitizer hooks while preserving default escaping/Trusted Types; add guarded same-parent native moves; preserve useful browser directives and opt-in static APIs; add integrated adapter, build/test/package tooling and documentation. Parser logic and standard update/diff/lifecycle algorithms otherwise remain upstream-derived.

## Marionette adapter

- Upstream repository: https://github.com/marionettejs/marionette
- File: `packages/adapters/src/dom/lit-html.ts`.
- Verified GitHub content blob: `8898079743dc3f19afae81594783175858325fbf`, fetched 2026-11-07 UTC.
- Integration target: published `marionette@5.0.1` (MIT).
- Tested core tarball integrity: `sha512-fBH50sZOjTp1xIybsdKrhjVmNtvUVN1pGDu6yMq5LWMroSDgMfDbu/7EKHHdij7ZK5NAl+JL7dQ4sFIxeWOvNw==`.

The adapter retains the end-marker, WeakMap contents, and WeakSet notification semantics. The first-class DOM API uses the same-package ChildPart directly instead of invoking public render twice at initialization and once per update; it preserves the bounded range and notification/failure ordering. It exports the API object and its exact named methods. No Marionette core code is modified. The exact Marionette license, **Copyright (c) 2020 Paul Falgout**, is included in THIRD_PARTY_NOTICES.md.

## Distribution

The npm file allowlist includes full licenses, this provenance, compatibility documentation, sources and compiled output. Generated declaration/source maps have their corresponding sources in the archive. `@types/trusted-types` is a production type dependency because the public declarations refer to it. Test/browser/build dependencies are development-only. The package is unpublished; the manifest is prepared for an explicitly approved public release.

## Upstream regression tests

Ten pristine test source files from the `lit-html@3.3.3` repository tag are retained under `vendor/lit-html-3.3.3/test/`, with URLs and Git blob hashes in `manifest.json`. Their BSD headers remain unchanged. The local harness adapts only imports, TypeScript erasure, test-runner setup and assertion helpers. It runs the same assertions against both Lit and this package. One styleMap test deliberately skips because it introspects a private directive brand rather than observable public behavior. The selected suite includes 290 passing cases, including nested synchronous directives and the full upstream async-directive suite; three additional Symbol cases remain disabled exactly as upstream. The complete source is retained while the runner selects supported core suites. Marker-stripping utilities are the exact upstream testing implementation, also retained with their blob hash and license. This is an explicit subset, not a claim of running the complete upstream suite.

The static-template and browser is-server implementations are recovered from the same verified npm archive's `development/static.js.map` and `development/is-server.js.map` sourcesContent. Their source-map selectors and digests are retained in `vendor/lit-html-3.3.3/sources.json`.

## Internal source organization (2026-11-08)

The core is named `src/renderer.ts` for clarity; it remains derived from the
pristine upstream `lit-html.ts` source identified in the recovery manifest. `src/template.ts` contains
its runtime scanner/preparation. The public package exports have not been
renamed. Original copyright headers and complete notices remain intact.

The experimental compiler, Vite integration, compiled-only runtime and their
validation work were extracted before this initial runtime-only package. A
verified full working-tree backup and extracted files are preserved separately;
the separate archive records recovery details. No compiler runtime protocol is shipped here.

## Package-only 1.0.0 addition

The 1.0.0 package addition imports the reviewed runtime-only source with the focused
upstream-derived fixes described below. Its source originates from the November 8, 2026
0.1.0-alpha.0 freeze, whose historical archive SHA-256 is
`d1089e973cf2a0c3efc06ea92f65bc1530534b5ad768b5ff323daf6590430ddb`.
The version and package documentation changed, so that digest does not identify
the 1.0.0 archive. The package remains unpublished; version metadata
is not a registry-publication claim. Core skills and renderer defaults are outside
this package-only change.


### Post-freeze compatibility fixes

- `asyncAppend` mapper inference follows merged Lit commit
  [16507ef656417c9c53a55a02a44a563bbbf2c484](https://github.com/lit/lit/commit/16507ef656417c9c53a55a02a44a563bbbf2c484).
  This changes declarations only, not runtime behavior.
- `keyed` disposes previous child content before replacement, based on open
  [Lit PR #5413](https://github.com/lit/lit/pull/5413), head `022c3dad`.
- `styleMap` decodes escaped CSS property names for CSSOM updates and removal,
  based on open [Lit PR #5396](https://github.com/lit/lit/pull/5396), head `5a85c133`.

The two pull requests are not represented as upstream releases or merged fixes.
Local public-API regression tests exercise the adopted behavior. Pristine vendored
Lit 3.3.3 fixtures remain unchanged; implementation sources are recoverable with verified hashes for comparison.

### Nested synchronous directive disposal

Public regressions discovered that replacing a synchronous wrapper such as
`guard` could leave its nested async directive connected, allowing a stale `until`
promise to replace current content. This also occurs without `keyed` and is not
fixed by PR #5413 alone. The local fix lazily installs a disposal hook on synchronous
directive ancestors already tracked in the sparse async ownership tree. Permanent
replacement disconnects their descendants and removes their ownership branch;
ordinary detach/reconnect keeps the existing recursive lifecycle. Existing
`AsyncDirective` hooks and synchronous failure propagation are unchanged. No hook
is installed and no additional render-path work occurs for trees without async
directives. Public tests cover duplicate same-version directive classes, detached
replacement, repeated lists, cached DOM, and multi-expression attributes.

### Browser-recognized comment endings

The authored template scanner also recognizes `--!>` as an HTML comment ending.
Browsers already recognize that ending; treating the following bindings as comment
text left internal markers visible and skipped the unsupported-event diagnostic.
Public tests cover attribute/text values and updates, expressions inside comments,
escaping, and event-binding rejection. This is a local binding-correctness fix,
not a claim of an untrusted-value injection exploit. The pristine upstream scanner is recoverable from the pinned archive; the test
utilities remain unchanged in the checkout.

### Cross-platform tool lock repair

The imported lock contained versionless optional Rollup platform entries. Complete
Rollup 4.63.5 records were restored from this repository's ancestor
`39e3833f59d77874aa98ce1c6804723e6fc43cb6`, preserving exact versions, registry URLs
and integrity hashes. A dependency-free preinstall check rejects incomplete
optional entries. No runtime or development dependency version was upgraded.

### Property-boundary corrections

Property names retain JavaScript casing, so declared camelCase callback setters
are not mistaken for native lowercase event handlers. Single-expression property
slots may pass foreign template objects opaquely by identity; foreign directives
and wrong-engine render positions retain their diagnostics. Public regressions
exercise both build conditions, custom setters and security negative controls.
