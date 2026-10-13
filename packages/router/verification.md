# Prototype verification

This feature branch starts from canonical Marionette master
`0f2284ad4bbfe8c82ce82714471697a68c2acaeb` (Marionette 5.0.0). It adds an opt-in
prototype only. No core runtime, existing coverage gate, release workflow,
application checkout, or approval setting changes are included.

The authoring toolchain is Node 24.19.0 and npm 11.17.0, using the repository's
pinned dependency graph installed in the isolated checkout.

| Check | Result / scope |
| --- | --- |
| `npm run build` | Passed, including root types and existing declaration consumers |
| `npm --prefix packages/router run build` | Passed; ESM and declarations generated from TypeScript |
| `npm --prefix packages/router test -- --coverage` | 37 passed; all router source files at 100% lines, statements, functions and branches |
| Coverage totals | 160/160 lines, 204/204 statements, 52/52 functions, 148/148 branches |
| Targeted ESLint | Passed with zero warnings for package source and all router test helpers |
| `npm --prefix packages/router run test:types` | Passed installed tarball ESM runtime and strict generated-declaration consumer; pack includes linked docs |
| `npm --prefix packages/router run test:browser` | 54 passed: 18 cases each in Chromium, Firefox and WebKit, all headless |

The portable suite covers named URL generation/matching, malformed URLs, query
semantics, same-route intent, reflection, state/clone failures, stale success/error,
nested host notifications, disposal and signal ownership. Eleven Marionette
ownership tests cover shared preparation, retained feed restart, workspace
switching, borrowed host loss before/after initial display, retry and cleanup.

`test/router/browser.mjs` runs headless Chromium, Firefox and WebKit against local
response fixtures in fresh contexts. The bridge cases use a synthetic public
Backbone/Radio host and product return-stack fixture. They are not execution of
private application source. Native state/entry behavior, silent host writes,
redirect reentrancy, bridge-only detach and focus/scroll limits are explicit.
Equal-fragment POP suppression by Backbone is an expected limitation, not a
capability claimed by a green check.

`test/router/consumer.mjs` packs the private package locally, installs that tarball
offline with scripts disabled, and checks its public ESM runtime and generated
declarations. Packing here does not publish to npm or authorize a release.

Independent review transpiled the TypeScript conversion and differentially tested
it against the assessed prototype for navigation, reflection, refresh, redirects,
traversal, state and encoding. Results were identical. Review corrected packed-doc
links and a moved browser fixture path. The portable host fixture also required
inbound-event echo suppression before its detach check passed. No private
application source, credentials, or hardcoded workstation paths are included.

This is not full repository regression/coverage, application migration, production
E2E, browser support certification, package performance certification, or release
validation. No PR, deployment, tag or registry publication is part of this work.
