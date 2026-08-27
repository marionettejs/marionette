# Source and release profile

Marionette keeps its contributor and release toolchain reproducible without narrowing
the runtime contract for package consumers. The machine-readable authority is
[`config/release-profile.json`](../config/release-profile.json).

The current source profile uses Node 24.19.0 and npm 11.17.0. `.nvmrc`, the
`packageManager` declaration, CI, and `npm run check:release-profile` must agree with
that file. The public package continues to support the Node range declared in
`engines`; the exact source profile identifies the environment used to build and
verify a release.

## Contributor setup

With `nvm` installed:

```sh
nvm install
nvm use
npm run check:release-profile
npm ci
npm run check:browser-profile
```

The Node release pinned here includes the pinned npm version. If another version of
npm is earlier on your path, select npm 11.17.0 before installing dependencies.

npm 11.17 records reviewed dependency installers in each package's top-level
`allowScripts` map. The repository enables `strict-allow-scripts` in `.npmrc`, so
installing a package whose scripts have not been reviewed fails instead of silently
executing them. Use `npm approve-scripts --allow-scripts-pending` to inspect pending
packages, review the exact package and version, and then use
`npm approve-scripts <package>` to add a version-pinned approval. Isolated fixture
packages keep their own approvals.

CI runs the complete suite on the canonical Ubuntu 24.04 x64 host. Clean installation
and packed-package fixtures also run on macOS 15 arm64 and Windows 2025 x64. GitHub's
fixed OS labels still receive runner-image updates, so release evidence records the
actual image reported by each run. Hosted-runner timings remain informative rather
than hard performance gates.

## Browser profiles

Browser behavior and transpilation use separate pinned profiles. The future
real-browser contract lane uses `@playwright/test` 1.62.1 with Chromium
151.0.7922.34 revision 1234, Firefox 153.0 revision 1538, and WebKit 26.5 revision
2336. These are the builds published for the [Playwright 1.62
release](https://playwright.dev/docs/release-notes#version-162). Playwright WebKit is
the compatibility engine; it is not evidence that branded Safari ran in CI.

The dependency is installed now so its exact browser manifest can be checked, but
browser binaries are not downloaded and browser tests are not enabled until the
real-browser contract work begins. `npm run check:browser-profile` compares the
installed Playwright manifest with `config/release-profile.json`.

The locked Browserslist database currently resolves the package query to Chrome and
Edge 148-149, Firefox 150-151, and Safari 26.3-26.4. The same browser-profile check
compares the complete ordered result with the checked-in snapshot, so a lockfile or
query update cannot silently change transpilation output.

## Advancing the profile

Profile changes use a dedicated pull request that updates every pin together and
passes clean installation, artifact validation, package fixtures, and the complete
test suite before merge.

- Review Node and npm patches monthly. Allow a seven-day upstream soak unless a
  security fix requires immediate adoption.
- Exercise a new Node major as a nonblocking lane while it is Current. Make it
  blocking only after it becomes LTS and completes a 30-day project soak. Raising
  Marionette's minimum supported Node major is a separate major-release decision.
- Introduce a replacement host image in parallel before making it canonical. Never
  use a moving `*-latest` label for release evidence.
- Review Playwright browser builds and transpilation targets monthly. Update the
  dependency, lockfile, browser-build manifest, and complete target snapshot in one
  reviewed pull request; browser tests remain a separate contract lane.
- Freeze the profile for a release candidate. An emergency profile change reruns all
  release evidence.

Documentation publication is defined separately and must not silently change the
source, host, or browser pins.

Package publication uses the separate
[immutable release-promotion contract](release-promotion.md). That workflow records
this profile's Git blob revision and SHA-512 in the verified artifact. Changing the
profile after a candidate is built requires rebuilding and rerunning the complete
release evidence; publication jobs reject an artifact whose recorded profile differs
from the checked-out source commit.
