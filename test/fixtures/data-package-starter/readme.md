# Candidate validation fixture

This TypeScript application exercises native observable data, editable rows,
selection loading, and cleanup. It has no backend, persistence, or URL router.
Its code and tests support package validation; the framework learning path is in
`node_modules/marionette/docs/readme.md`, starting with `docs/quick-start.md`.

## Run from a release candidate artifact

Follow the artifact's `START-HERE.md`. Keep its five tarballs beside the `starter`
directory. The generated lockfile pins those exact files and integrity hashes.
Use the Node/npm profile recorded in the artifact, rename `gitignore` to
`.gitignore`, and run:

```sh
npm ci
npm run validate
npm run browser:install
npm run test:browser
npm run dev
```

`validate` checks types, lint, unit tests, and the production build. Browser tests
exercise selection, draft retention, and page-exit cleanup separately. The browser
suite manages its Vite server on port 4173. A passing build alone is not browser
verification.

The repository fixture is consumed by release and package validation. Candidate
construction adds the selected package tarball dependencies; this directory is not
shipped as an application starter in the npm package.
