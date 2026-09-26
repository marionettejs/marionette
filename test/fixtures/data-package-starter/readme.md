# Marionette development starter

This TypeScript starter uses function templates, native DOM, and optional native
observable data. It demonstrates editable rows, latest-selection loading, and
cleanup. It has no backend, persistence, or URL router. Connect `navigate(id)` to
your existing router when the application needs URLs.

## Start from an npm release

Copy this entire directory from `node_modules/marionette/starter` into
an empty application directory outside `node_modules`. The packaged manifest
selects matching versions of `marionette` and `@mnjs/data`. Use Node 24 or later:

```sh
mv gitignore .gitignore
npm install
npm run validate
npm run browser:install
npm run test:browser
npm run dev
```

Commit the generated `package-lock.json`; use `npm ci` for subsequent installs.
`npm run validate` checks types, consumer lint, unit tests, and the production build.
The browser suite starts and stops its own Vite server on port 4173, so leave that
port available. On Linux, install Playwright's required OS libraries with
`npx playwright install --with-deps chromium` if needed.

The package version must be published before registry installation can work.
Unreleased checkouts can retain an already published version string; use the
candidate workflow below to test their actual code.

## Start from an unreleased candidate

Use the portable `starter` in a verified development artifact. Keep its five
tarballs beside the starter; its generated lockfile selects those exact local
files. Rename `gitignore` to `.gitignore` and run `npm ci` instead of the initial
`npm install`, then the same checks
above using the artifact's Node/npm profile. Do not replace those file dependencies
with registry packages: identical version strings can describe different sources.

The repository directory is the development template. Packaging generates its
runtime dependencies; candidate construction supplies a complete tarball lock.

Start with `workspace.ts` for Application readiness and child ownership, and
`workspace-views.ts` for presentation and child events. `setup.ts` configures the
shared runtime once. `main.ts` owns browser setup; `notes.ts` provides the data client
imported by both Applications. Both use `Application.extend`; options configure the
mounting Region. Tests mock the data client directly.
Edit a title without opening it, then reverse the rows: the input and draft survive.
Open the first note and quickly open the second: the late first load cannot replace
it. Leaving the page or a Vite code update destroys the workspace and cancels work.
Code updates start a fresh workspace and reset its local state.

`npm test` also uses a loader that ignores abort and verifies no late commit or
retained button handler after destruction. The included browser tests exercise draft retention, latest selection, and page-exit
cleanup. Library release tests additionally edit Vite modules repeatedly. Extend
these tests for your application; a passing build is not a browser check.

`vite.config.mjs` preserves the installed packages' embedded TypeScript source maps
through development and application builds. Open authored sources in browser
developer tools. `eslint.config.mjs` enables the public Marionette consumer rules.

Use `node_modules/marionette/docs/development.md` for the complete workflow
and matching troubleshooting and API guidance. The adjacent manifest records the
source revision. A package version alone cannot identify an unpublished build.

Initial records and selected details use `prepareStart` with cancellation signals.
Selection replaces only the detail feature. List drafts survive selection/reordering;
restarting the workspace reloads records and resets drafts. Clean rows observe external
title changes; dirty drafts win until Open commits them. Region replacement and parent
Application teardown release the same owners as direct destruction.
