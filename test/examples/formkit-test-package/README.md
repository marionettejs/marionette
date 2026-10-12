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
destruction. `independent-application-lifecycle.spec.js` is the unchanged seven-case
synthetic suite from FormKit checkpoint baab5619; it imports no test helper.
Its retained SHA-256 is
`421474b159a7cc862333e6dc1a5cc998233a7b7d083cb5bc3cc38c7523b9aa1c`.

This bounded consumer check does not reproduce the owner's complete historical
FormKit coverage. It excludes ongoing nested custom-row work, licensed Pro and
customer applications. Artifact/source identity, test counts, environment and
stage outcomes are retained in `test/tmp/formkit-test-package-consumer/report.json`.
