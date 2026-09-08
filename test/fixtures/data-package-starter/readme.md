# Marionette beta starter

This starter uses plain JavaScript, function templates, native DOM, and optional
native observable data. It demonstrates editable rows, latest-selection loading,
and cleanup. It has no backend, persistence, or URL router. Selection is local;
connect `navigate(id)` to your existing router when the application needs URLs.

After the beta is published, install the matching runtime, then run the starter:

```sh
npm install marionette@5.0.0-beta.1 @mnjs/data@5.0.0-beta.1
npm test
npm run build
npm run dev
```

Before publication, install all five verified candidate tarballs in one npm install
command instead. The companion packages are not assumed to exist in the registry.
The repository fixture runner performs this installation in an empty directory
outside the checkout and verifies the locked external dependency graph.

Edit a title without opening it, then reverse the rows: the input and draft survive.
Open the first note and quickly open the second: the late first load cannot replace
it. Leaving the page or a Vite hot update destroys the workspace and cancels work.
Tests also use a loader that ignores abort and verify no late commit or retained
button handler after destruction. Browser release tests verify focus and selection.

Start with `workspace.mjs`; `main.mjs` owns browser setup and a demonstration loader.
Use the installed `marionette/dist/docs/` for matching API and migration guidance.
`npm test` uses Node and jsdom; use a real browser for focus and layout changes.
