# Optional renderer in this repository

This private, independently versioned package is the runtime-only `@mnjs/html`
prototype. It is not part of the coordinated Marionette core release, and adding
its source here does not publish it to npm. The core build and runtime do not
import it. Its own lockfile, TypeScript configuration, tests and upstream notices
remain authoritative; the root TypeScript and ESLint jobs exclude this package.

From the repository root, install its locked development dependencies separately
with `npm --prefix packages/html ci --ignore-scripts`. Then run:

```sh
npm run test:html
npm run test:html:browser
```

`test:html` builds both production and development outputs, runs their tests,
checks declarations and verifies the packed file surface. Browser checks cover
DOM/lifecycle and security contracts. Use `npm run build:html` for a build alone.
Neither command changes core's build or release package list.

Documentation examples use an explicit local renderer archive, never an implicit
registry substitute. After building and testing, create a local archive and pass
it to the documentation checks:

```sh
mkdir -p packages/html/artifacts
npm pack ./packages/html --ignore-scripts --pack-destination packages/html/artifacts
MNJS_HTML_TARBALL="$PWD/packages/html/artifacts/mnjs-html-0.1.0-alpha.0.tgz" npm run docs:check
```

The imported runtime source is the November 8, 2026 renderer-only freeze. Its
reference archive SHA-256 is
`d1089e973cf2a0c3efc06ea92f65bc1530534b5ad768b5ff323daf6590430ddb`.
The compiler/Vite extraction and optional router are not included. Historical
validation notes describe that freeze; verify the current checkout with the
commands above rather than treating those notes as a fresh test result.
