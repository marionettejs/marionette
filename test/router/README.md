# Router integration checks

The optional private router is integrated onto upstream
`2828aebdc928a2e8121ee5f601a2d5012412068e` (Marionette 5.0.1).
Its runtime is byte-identical to the verified reconstructed candidate
`c29ca486786659595dbe7d35791537c6b07ac475`, retaining all eight correctness fixes.
The source integration commit is `67823a47891ea868b24034368e7657a9a609b31b`.
Neither missing original repair commit was recovered. Historical failing-before
logs remain with the preserved d45 candidate; they are not fresh upstream checks.

The transplant preserves upstream core, `@mnjs/test`, workflow configuration,
dependency versions and security overrides. Shared changes wire the router into
the existing build, workspace, declaration consumers and Vitest projects. Router
remains private 0.1.0; its exact peer/Utils pins follow upstream 5.0.1. There is no
new product API, leave guard, release or deployment.

## Fresh cloud verification — 2026-11-05

Node 24.19.0, npm 11.17.0 (including nested commands), Playwright 1.64.1.

| Command | Result |
| --- | --- |
| `npm run check:release-profile` | Passed. |
| `npm test` | 2,889 passed and one intentional `test.fails` cleanup case, 173 files; all 547 router tests passed. |
| `npm run build` | Passed, including all package builds, source types and ESM/CJS declaration consumers. |
| `npm run lint` | Passed, zero warnings. |
| `npm run check:public-tests` | Passed. |
| `npm run check:api-contracts` | Passed after reviewing additive router source hashes and emitter records. |
| `node --test test/tooling/api-contracts.test.mjs` | 14 passed. |
| `npm run test:source` and `npm run test:dist` | Passed. |
| `npm run test:router-package` | Built ESM/CJS checks passed. |
| `node test/router/correctness-probes.mjs` | Four abandoned-redirect cases: no unhandled rejection; 0/256 vetoed payloads retained after stop. |
| `npm run test:router-tarball` | Isolated offline installed ESM/CJS consumers and all five probes passed. |
| Native `router-native.spec.mjs` | 37 passed, zero failures/skips, installed Chromium 154.0.8037.57. |

The native suite checks real Back/Forward URL, entry key/index, route state and
viewport restoration, operational AbortError, refresh rejection, cancellation,
focus/scroll, child preparation and registration lifetime.

The cloud run extended `playwright.config.mjs` in ignored
`test/tmp/native-cloud.config.mjs`, retaining its setup/reporters and selecting
`launchOptions: { executablePath: '/usr/bin/chromium' }` for its sole Chromium
project. Command:

```sh
npm run test:browser -- --config test/tmp/native-cloud.config.mjs router-native.spec.mjs
```

Firefox/WebKit and the exact profile Chromium binary were unavailable. No browser
security settings were changed and no download restrictions were bypassed. These
checks do not certify all release-wide fixtures, other engines, minimum browser
versions, registry artifacts or any consuming application.

A separate read-only integration review found no blocking issues. It checked
runtime identity with the preserved candidate, absence of old-core drift,
manifest/lock pins, retained upstream build/test changes and API inventory
additions. The reviewer made no edits and ran no tests.
