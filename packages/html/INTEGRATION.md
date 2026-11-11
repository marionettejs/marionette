# Optional renderer in this repository

`@mnjs/html` 1.0.0 is independently versioned and remains unpublished.
Its manifest is prepared for public access; publication requires the separate
approval and checks in [RELEASE.md](./RELEASE.md). It is not part of the
coordinated Marionette core release. The core build and runtime do not import it.
Its own lockfile, TypeScript configuration, tests and upstream notices remain
authoritative; root TypeScript and ESLint jobs exclude this package.

From the repository root, install its locked development dependencies separately
and run the package checks:

```sh
npm ci --ignore-scripts
npm --prefix packages/html ci --ignore-scripts
npm run test:html
npm run test:html:browser
npm run lint:html
npm run coverage:html
npm run test:html:current-core
```

`test:html` builds production and development outputs, runs their tests, checks
declarations and verifies the packed file surface. Browser checks cover
DOM/lifecycle and security contracts. Use `npm run build:html` for a build alone.
These commands do not change the core build or release package list. The HTML
workflow checks this package separately; core documentation and consumer skills
retain their existing renderer choices.

To inspect the local package archive after verification:

```sh
mkdir -p packages/html/artifacts
npm pack ./packages/html --ignore-scripts --pack-destination packages/html/artifacts
```

This PR does not publish the resulting `mnjs-html-1.0.0.tgz`. Publication requires
a separate release decision. Runtime TypeScript originates from the November 8,
2026 renderer-only freeze, with focused compatibility fixes listed in
[PROVENANCE.md](./PROVENANCE.md). Compiler/Vite extraction and router work are excluded.
The historical alpha archive SHA-256 was
`d1089e973cf2a0c3efc06ea92f65bc1530534b5ad768b5ff323daf6590430ddb`.
Source fixes, version and package documentation changes mean the 1.0.0 archive has a different
digest; the historical digest is not an identity claim for this archive.

The released compatibility lane keeps its pinned `marionette@5.0.1`. The separate
current-core lane builds and packs the checkout core, utils and radio, extracts
those archives with the HTML archive into an isolated consumer, verifies import
resolution, and repeats public lifecycle tests under both conditions. It neither
uses a workspace link nor changes the package's released compatibility baseline.

## Lint and coverage policy

The root lock supplies the pinned ESLint/TypeScript parser and c8 versions. Run
`npm ci --ignore-scripts` at the root before these checks. HTML lint checks authored
source, scripts and test helpers without reformatting pristine upstream fixtures.
TypeScript checks declarations and duplicate definitions; legal value/type names
and a few documented upstream lint allowances are preserved.

Coverage runs the development public Node suite serially and remaps V8 execution
to every `src/**/*.ts` file, including unexecuted sources. It writes HTML, LCOV and
JSON under `coverage/runtime/`. `coverage-baseline.json` caps uncovered counts per
file for lines, statements, functions and branches; new files or increased gaps
fail. Lower limits when public tests improve coverage. A baseline increase needs
explicit review, not an automatic regeneration command. This is not the core's
100% policy, and it does not include browser-only execution (for example escaped
CSS parsing), tooling execution or prove all supported behaviors are correct.
Pristine fixture and generated distribution files do not inflate the source score.

## CollectionView empty contents

An `emptyView` without `childViewContainer` uses the CollectionView root and
clears all of that root's existing contents. Use a dedicated child container
when the template has a persistent header or other surrounding markup. The HTML
adapter disconnects and retires its cached template part when contents are
cleared; a later template render creates a fresh part rather than reusing
removed markers. Clearing contents does not detach the root element itself.
