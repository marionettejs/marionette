# Marionette development starter

This TypeScript starter uses function templates, native DOM, and optional native
observable data. It demonstrates editable rows, latest-selection loading, and
cleanup. It has no backend, persistence, or URL router. Connect `navigate(id)` to
your existing router when the application needs URLs.

Use the portable `starter` directory in a verified development artifact. Keep its
five tarballs beside this directory; its generated lockfile selects those exact
files. From this directory, using the artifact's Node/npm toolchain:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

The repository copy is the template for that artifact. Its runtime dependencies
are filled from the selected tarballs during artifact construction. Do not combine
this unreleased starter with the registry beta.1 packages. Published beta.1 has its
own matching starter and documentation.

Start with `workspace.ts`; `main.ts` owns browser setup and a demonstration loader.
Edit a title without opening it, then reverse the rows: the input and draft survive.
Open the first note and quickly open the second: the late first load cannot replace
it. Leaving the page or a Vite code update destroys the workspace and cancels work.
Code updates start a fresh workspace and reset its local state.

`npm test` also uses a loader that ignores abort and verifies no late commit or
retained button handler after destruction. Browser release tests exercise actual
Vite edits, focus, and selection. Use a real browser for your focus/layout changes.

`vite.config.mjs` preserves the installed packages' embedded TypeScript source maps
through development and application builds. Open authored sources in browser
developer tools. `eslint.config.mjs` enables the public Marionette consumer rules.

Use `node_modules/marionette/dist/docs/docs/development.md` for the complete workflow
and matching troubleshooting and API guidance. The adjacent manifest records the
source revision. A package version alone cannot identify an unpublished build.
