# Executable @mnjs/test examples

See `../../../packages/test/readme.md` for APIs, commands and tool-specific limits.
These examples use real public package imports with stable Marionette 5.0.0.
The helper is installed from the local built package using npm's `--install-links`
so the consumer uses a copied distribution, not a source alias.

`fixtures.js` owns asynchronous form saving independently from Application readiness.
`form.spec.js` runs unchanged in JSDOM and Vitest Browser Mode. Playwright uses its
1.63.0 built-in gallery `mount`; same-story updates preserve the current View.
Cypress uses a supported Vue/Vite host configuration and a custom Marionette command.
Vue is only the component dev-server's host shell, not a package runtime dependency.

The examples do not test FormKit or migrate customer-forms. Broader compatibility
and Cypress E2E remain guidance. See the committed verification report for checks
actually executed and environment limitations.

When the pinned Playwright browser is unavailable, an already installed Chromium
can provide supplemental evidence without downloading a substitute binary:

```sh
MNJS_TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:helpers:consumer -- --browser
```

Run this command from the repository root after building. The consumer report
records the actual browser version, the artifact hash, whether source has working
changes, and hashes of the authored helper/fixture files. A system-browser pass
does not certify the pinned browser profile. The verifier clears inherited
checkout tool paths and global module search, and checks consumer ancestors for
`node_modules`; runtime and type checks use the isolated installed dependencies.
