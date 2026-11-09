# Optional renderer in this repository

`@mnjs/html` 0.1.0 is independently versioned and remains unpublished.
Its manifest is prepared for public access; publication requires the separate
approval and checks in [RELEASE.md](./RELEASE.md). It is not part of the
coordinated Marionette core release. The core build and runtime do not import it.
Its own lockfile, TypeScript configuration, tests and upstream notices remain
authoritative; root TypeScript and ESLint jobs exclude this package.

From the repository root, install its locked development dependencies separately
and run the package checks:

```sh
npm --prefix packages/html ci --ignore-scripts
npm run test:html
npm run test:html:browser
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

This PR does not publish the resulting `mnjs-html-0.1.0.tgz`. Publication requires
a separate release decision. Runtime TypeScript originates from the November 8,
2026 renderer-only freeze, with focused compatibility fixes listed in
[PROVENANCE.md](./PROVENANCE.md). Compiler/Vite extraction and router work are excluded.
The historical alpha archive SHA-256 was
`d1089e973cf2a0c3efc06ea92f65bc1530534b5ad768b5ff323daf6590430ddb`.
Source fixes, version and package documentation changes mean the 0.1.0 archive has a different
digest; the historical digest is not an identity claim for this archive.
