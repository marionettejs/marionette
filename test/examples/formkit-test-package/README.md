# Actual FormKit consumer tests

These fixtures consume a verified built `@mnjs/formkit` development tarball and
the current packed `@mnjs/test`, with published Marionette 5.0.0. They use public
FormView/FieldView APIs, native controls and existing Testing Library queries.
The test helper has no FormKit dependency.

From the framework root after building the helper:

```sh
npm run test:helpers:formkit -- \
  --formkit-tarball /absolute/path/to/formkit.tgz \
  --formkit-sha256 EXPECTED_SHA256 \
  --formkit-manifest /absolute/path/to/source-manifest.json
```

Add `--browser` for Chromium. `MNJS_TEST_CHROMIUM_EXECUTABLE` selects an existing
system Chromium when the pinned binary is unavailable; the report records its
actual version and that pass remains supplemental browser evidence.

The verifier installs both artifacts in an isolated temporary consumer, retains
its generated lockfile, repeats installation with `npm ci`, and checks ESM/CJS
value-type inference. It runs nine helper cases for rendering, input, conditions,
validation/errors, submission cancellation, reset, nested group ownership and
destruction. `independent-application-lifecycle.spec.js` is a separate seven-case
synthetic suite that imports no test helper. Its current bytes match
`test/unit/formkit-application-lifecycle.spec.js`; the verifier records the actual
SHA-256 on each run. The root copy runs with unit tests. This separate installed
helper-consumer configuration runs only when the command above is invoked.

This bounded consumer check does not reproduce the owner's complete historical
FormKit coverage. It excludes ongoing nested custom-row work, licensed Pro and
customer applications. Artifact/source identity, test counts, environment and
stage outcomes are retained in `test/tmp/formkit-test-package-consumer/report.json`.

The later [nested consumer checkpoint](NESTED-VERIFICATION.md) records the verified
source delta, frozen eight-case oracle, separate focused coverage and installed
ESM/CJS/native-browser replay. Its private scoped harness and exact artifacts are
retained separately; those results do not certify later fixture revisions.
