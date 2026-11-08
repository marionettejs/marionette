# Provenance

## Lit HTML

- Upstream package: `lit-html@3.3.3`.
- Registry archive: https://registry.npmjs.org/lit-html/-/lit-html-3.3.3.tgz
- SHA-512 integrity: `sha512-el8M6jK2o3RXBnrSHX3ZKrsN8zEV63pSExTO1wYJz7QndGYZ8353e2a5PPX+qHe2aGayfnchQmkAojaWAREOIA==`.
- SHA-1: `a63fd02fb8c1c7b7057ee805ab6c612fdebef0b1`.
- Retrieved from the local npm cache and verified against the installed package lock on 2026-11-07 UTC.
- Repository: https://github.com/lit/lit/tree/lit-html%403.3.3/packages/lit-html

Authoritative TypeScript inputs were recovered from the archive's `development/*.js.map` and `development/directives/*.js.map` `sourcesContent`. Pristine copies of all inspected source files, package metadata, and the exact package license are retained under `vendor/lit-html-3.3.3/`. The selected implementations were copied to `src/` and modified there. The archive has no `gitHead`, so its verified package digest, rather than an inferred commit, identifies the source.

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

The npm file allowlist includes full licenses, this provenance, compatibility documentation, sources and compiled output. Generated declaration/source maps have their corresponding sources in the archive. `@types/trusted-types` is a production type dependency because the public declarations refer to it. Test/browser/build dependencies are development-only. The package is unpublished and marked private.

## Upstream regression tests

Ten pristine test source files from the `lit-html@3.3.3` repository tag are retained under `vendor/lit-html-3.3.3/test/`, with URLs and Git blob hashes in `manifest.json`. Their BSD headers remain unchanged. The local harness adapts only imports, TypeScript erasure, test-runner setup and assertion helpers. It runs the same assertions against both Lit and this package. One styleMap test deliberately skips because it introspects a private directive brand rather than observable public behavior. The selected suite includes 290 passing cases, including nested synchronous directives and the full upstream async-directive suite; three additional Symbol cases remain disabled exactly as upstream. The complete source is retained while the runner selects supported core suites. Marker-stripping utilities are the exact upstream testing implementation, also retained with their blob hash and license. This is an explicit subset, not a claim of running the complete upstream suite.

The static-template and browser is-server implementations are recovered from the same verified npm archive's `development/static.js.map` and `development/is-server.js.map` sourcesContent. Its pristine source is retained beside the other vendored source files.

## Internal source organization (2026-11-08)

The core is named `src/renderer.ts` for clarity; it remains derived from the
pristine `vendor/lit-html-3.3.3/lit-html.ts` source. `src/template.ts` contains
its runtime scanner/preparation. The public package exports have not been
renamed. Original copyright headers and complete notices remain intact.

The experimental compiler, Vite integration, compiled-only runtime and their
validation work were extracted before this initial runtime-only package. A
verified full working-tree backup and extracted files are preserved separately;
the separate archive records recovery details. No compiler runtime protocol is shipped here.
