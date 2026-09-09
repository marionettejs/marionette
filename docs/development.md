# Develop against the current candidate

Use the TypeScript starter when beginning an application trial against unreleased
Marionette changes. It includes editable rows, asynchronous selection, cancellation,
ownership cleanup, lint, tests, and Vite. It has no backend or persistence; connect
its `navigate(id)` function to your application's router when URLs are needed.

## Start from a published npm package

This npm workflow starts with beta.2; beta.1 predates these tools. For an
unpublished artifact, use the candidate instructions below. Registry installation
requires the selected version to be published.

After installing a release containing the starter, copy it into an empty app
folder outside `node_modules`:

```sh
cp -R node_modules/marionette/dist/docs/starter ../my-marionette-app
cd ../my-marionette-app
mv gitignore .gitignore
npm install
npm run validate
npm run browser:install
npm run test:browser
npm run dev
```

Use Node 24 or later. The packaged manifest pins its Marionette dependencies to
the installed package version. The first install creates the application lockfile;
commit it and use `npm ci` thereafter. No repository checkout or separate runtime
installation is needed. `AGENTS.md` records the starter's real architecture and
commands; keep it updated as the app changes. Skill and optional MCP setup are in
[Set up an agent](agent-tools.md); select matching docs before using remote results.

The included Chromium tests own a Vite server on port 4173. On Linux, browser
installation may require `npx playwright install --with-deps chromium`.

## Choose matching packages and documentation

Before stable v5, npm's **latest** tag identifies the current published prerelease.
Match the website's published reference to the version you installed. Development artifacts may have the same
version string and newer behavior: identify them by their full source commit and
tarball integrity hashes. The `next` channel is reserved for development after the
first stable v5 release.

Download `release-candidate-<full-source-commit>` from a successful run of
[Release promotion](https://github.com/marionettejs/marionette/actions/workflows/release.yml).
Pull requests build this artifact in dry-run mode; it does not publish packages.
Select the run for the commit you intend to test. Check `release-evidence.json`
for that commit and `candidate-validation.json` for completed validation. A green
unrelated job or the package version alone does not identify the candidate.
GitHub may require signing in to download workflow artifacts.

Extract the artifact into an empty directory. Keep its five tarballs beside the
`starter` directory: the starter lockfile selects those exact local files and
integrity hashes. Use the Node and npm versions recorded in the artifact's
`release-evidence.json` toolchain, then:

```sh
cd starter
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run browser:install
npm run test:browser
npm run dev
```

The artifact's `START-HERE.md` repeats these instructions. There is no repository
checkout, linking step, or separate runtime installation. To create an artifact
from source, maintainers use the [release procedure](https://github.com/marionettejs/marionette/blob/master/docs/release-promotion.md#dry-run).
Creating or testing a candidate does not publish it.

Read `node_modules/marionette/dist/docs/docs/readme.md` and its neighboring pages
for the APIs in this candidate. `node_modules/marionette/dist/docs/manifest.json`
records its source revision. Give an agent that installed documentation path;
start with [the compact reference](compact-reference.md), then the relevant API.
Do not combine an unreleased starter with registry beta.1 dependencies.

## Edit and verify a feature

Start with `workspace.ts`: its typed options describe the mount element and the
asynchronous note loader. `main.ts` supplies browser setup and a demonstration
loader. `workspace.test.mjs` uses Node and jsdom against the installed packages.
TypeScript checks options, native models, and owned state without application
casts or declarations copied from the framework.

1. Edit a row without opening it, then reverse the rows. Its draft survives.
2. Open the slow first note, then the second. The late first load cannot replace it.
3. Edit `workspace.ts` while a load is pending. Vite replaces the workspace and
   cancels the old load. Code updates deliberately reset application state; row
   reconciliation during ordinary use preserves surviving DOM and drafts.
4. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
   Add a regression for the behavior you change. Run `npm run test:browser` and
   extend `workspace.browser.spec.mjs` for focus,
   layout, keyboard interaction, and your router's history behavior.

The browser suite installs this portable kit outside the checkout, moves it, and
edits its running Vite module repeatedly. It checks that detached buttons stop
handling events and pending work cannot commit into the replacement workspace.
This evidence covers the starter's owner boundary, not arbitrary application HMR.

## Debug the authored source

The candidate's ESM and CommonJS distributions ship source maps with embedded
TypeScript. The starter's `vite.config.mjs` loads dependency maps through Vite's
plugin API and retains them through the application build. It also leaves
Marionette packages outside dependency prebundling while developing.

Enable JavaScript source maps in browser developer tools. Open a Marionette frame
or search Sources for `src/modules/view.ts`; the embedded TypeScript is available
without the library checkout. For Node consumers, use `node --enable-source-maps`.
The application build emits maps too; decide whether to distribute your own
application source maps when deploying.

For symptoms and framework error codes, use [troubleshooting](troubleshooting.md).
For a larger typed feature, see [TypeScript](typescript.md),
[application tests](testing.md), and [consumer lint](consumer-lint.md).
