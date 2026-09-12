# Work on this Marionette application

Use `node_modules/marionette/dist/docs/docs/agents.md` for application architecture
and its task links for specific contracts. The compact reference is an optional
overview. `dist/docs/manifest.json` and this application's lockfile identify the
installed version and source; do not substitute mismatched website examples.

For skill setup or remote documentation retrieval, consult the installed
`docs/agent-tools.md` under `dist/docs`. Local Markdown is sufficient.

## Existing architecture

- `main.ts` mounts in `main`, supplies the demonstration loader, and releases the
  workspace on page exit and Vite updates. Code updates reset local state.
- `workspace.ts` creates one isolated runtime per workspace. It registers native
  `@mnjs/data` DataApi and StateApi before creating Views. Rendering uses function
  templates and native DOM. There is no Backbone dependency or URL router.
- The root Region owns the shell. Its list Region owns the CollectionView and
  rows; its detail Region owns the selected View. A separate status View borrows
  shell-owned state and renders updates without disturbing editable rows. Draft
  inputs survive ordinary collection reordering. Templates render escaped content;
  `ui` and semantic `triggers` declare controls.
- The workspace owns the note collection and pending AbortController. `navigate`
  cancels obsolete loads and checks cancellation before committing results, even
  if a loader ignores its signal. `destroy` releases the workspace.
- The loader is a local demonstration without persistence. Add real data access
  at `main.ts`'s loader boundary; connect URL handling to `navigate` if needed.

## Setup and checks

Choose commands for the task from this directory; setup is needed only for a new
installation:

- Rename the shipped `gitignore` to `.gitignore` before committing application files.
- First registry setup: `npm install`; subsequent locked installs: `npm ci`.
- Types, consumer lint, unit tests, build: `npm run validate`.
- Browser setup once: `npm run browser:install` (Linux may need Playwright's OS dependencies).
- Browser regressions: `npm run test:browser`; development server: `npm run dev`.

Extend `workspace.test.mjs` for data/loading behavior and
`workspace.browser.spec.mjs` for DOM interaction and cleanup. Use public APIs and
observable behavior; do not inspect private framework fields. Completion means the
requested behavior and its affected ownership/cancellation boundary work, with
actual check results and any untested scope reported. Keep these architecture
notes current as the app grows.
