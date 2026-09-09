# Work on this Marionette application

Read the installed contract in
`node_modules/marionette/dist/docs/docs/agents.md`, then its compact reference
and the page relevant to the task. `dist/docs/manifest.json` records the package
version and source. Use this application's lockfile; do not substitute current
website examples for a different installed version.

Optional skill setup: `node_modules/marionette/dist/docs/docs/agent-tools.md`.
That guide also describes documentation retrieval. The website's MCP setup is
at https://marionettejs.com/docs/mcp/. Read `marionette://catalog` and use remote
docs only when version and source match this installation. Pass the exact installed
`version` to each tool; follow `nextOffset` until it is `null`. Local Markdown
remains sufficient. Website WebMCP operates its
workshop, not this application.

## Existing architecture

- `main.ts` mounts in `main`, supplies the demonstration loader, and releases the
  workspace on page exit and Vite updates. Code updates reset local state.
- `workspace.ts` creates one isolated runtime per workspace. It registers native
  `@mnjs/data` DataApi and StateApi before creating Views. Rendering uses function
  templates and native DOM. There is no Backbone dependency or URL router.
- The root Region owns the shell. Its list Region owns the CollectionView and
  rows; its detail Region owns the selected View. Draft inputs survive ordinary
  collection reordering. Shell-created status state is owned by the shell.
- The workspace owns the note collection and pending AbortController. `navigate`
  cancels obsolete loads and checks cancellation before committing results, even
  if a loader ignores its signal. `destroy` releases the workspace.
- The loader is a local demonstration without persistence. Add real data access
  at `main.ts`'s loader boundary; connect URL handling to `navigate` if needed.

## Verify changes

Run commands from this directory:

- Rename the shipped `gitignore` to `.gitignore` before committing application files.
- First registry setup: `npm install`; subsequent locked installs: `npm ci`.
- Types, consumer lint, unit tests, build: `npm run validate`.
- Browser setup once: `npm run browser:install` (Linux may need Playwright's OS dependencies).
- Browser regressions: `npm run test:browser`; development server: `npm run dev`.

Extend `workspace.test.mjs` for data/loading behavior and
`workspace.browser.spec.mjs` for DOM interaction and cleanup. Use public APIs and
observable behavior; do not inspect private framework fields. Run relevant checks
and report actual results. Keep these architecture notes current as the app grows.
