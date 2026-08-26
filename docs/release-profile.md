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
npm ci
npm run check:release-profile
```

The Node release pinned here includes the pinned npm version. If another version of
npm is earlier on your path, select npm 11.17.0 before installing dependencies.

CI runs the complete suite on the canonical Ubuntu 24.04 x64 host. Clean installation
and packed-package fixtures also run on macOS 15 arm64 and Windows 2025 x64. GitHub's
fixed OS labels still receive runner-image updates, so release evidence records the
actual image reported by each run. Hosted-runner timings remain informative rather
than hard performance gates.

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
- Freeze the profile for a release candidate. An emergency profile change reruns all
  release evidence.

Browser-engine and documentation-publication profiles are defined separately; they
must not silently change these source and host pins.
