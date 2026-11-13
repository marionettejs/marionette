# Prepare @mnjs/router 0.2.0

Router is an independently versioned pre-v1 package. This branch prepares 0.2.0
with the public `@mnjs/router/history` entry; it does not release it. See the
[consumer changelog](changelog.md). Applications using `^0.1.1` must explicitly
update their dependency range to adopt 0.2.0.

**Publication authorization:** neither this procedure nor a version bump
authorizes merging, publishing or tagging. Require the release decision and final
certification below.

Compared with published Router 0.1.1, this minor adds an independently built
History entry in ESM/CommonJS with declarations for both. Existing root named
exports, native driver selection, authored runtime source, Node floor, peer range
and Utils range are unchanged. Root and standalone History factories have distinct
identities; consumers should use one History import path consistently.

This procedure releases only `@mnjs/router@0.2.0`, publicly, with npm dist-tag
`latest` and Git tag `router-v0.2.0`. Do not reuse the existing
`router-v0.1.0`, `router-v0.1.1` or unrelated core tags. Router is independently versioned;
do not align its version with core or enroll it in the coordinated five-package
5.x publisher. The independent
[`@mnjs/test` procedure](../test/RELEASING.md) is the precedent, not evidence that
its publisher session or package-specific trust applies to Router.

The manifest omits `private` and fixes public access/the npm registry. Preparation
and verification never publish. Their `publishableManifest: true` records a
technical manifest check, not authenticated scope authority, review approval or
permission to skip final certification. The maintainer has confirmed Marionette's
MIT license; the archive preserves its exact attribution.

## Review and merge source

Rebase onto current master, open a PR, review `packages/router/src` directly and
resolve supported correctness findings. Require current-head CI and consolidated
source/docs/package review before the protected merge. Honor repository rules;
never bypass required checks or reviews. Review the core release separately from
this Router minor even when they share a preparation PR.

The public README and examples describe the package as consumers install it.
Keep `DESIGN.md`, the concise source/license reference and exact MIT notice in the
archive. Development/recovery logs, private application history, credentials and
Library identities do not belong in the consumer payload.

## Confirm publisher authority and version availability

Use the release owner's existing authorized npm session and ordinary 2FA flow:

```sh
npm whoami --registry=https://registry.npmjs.org/
npm view @mnjs/router versions dist-tags maintainers --json --registry=https://registry.npmjs.org/
npm view marionette versions dist-tags --json --registry=https://registry.npmjs.org/
```

Confirm the approved npm account can publish the existing **public** `@mnjs/router`
package. A registry 404 alone establishes neither scope membership nor publishing
authority. Trusted publishing, if used, must actually cover this package and
workflow. Do not create credentials, organization grants or trusted-publisher
settings as a workaround. Authentication/access failures block publication; stop
that operation and coordinate the supported publisher handoff.

Confirm 0.2.0 is unused and assigning `latest` is appropriate. Do not overwrite an
existing version, invent a different version or retarget another dist-tag. Keep
Marionette within `^5.0.1`. Verify both the minimum 5.0.1 and the newest available
compatible core; when they resolve to the same published bytes, record that fact.
Future compatible releases are not already browser-certified. Router's ordinary
Utils dependency is `^5.0.1`, permitting compatible deduplication independently of
the Marionette peer. Certification still installs the actual 5.0.1 minimum bytes;
the range is not a claim that future versions have already passed these checks.

## Coordinate independent releases

Router 0.2.0 and the coordinated core 5.1.1 release are separate version lines,
archives and publication decisions. The five-package publisher does not publish
Router. Its core peer and Utils dependency remain `^5.0.1`; Router does not require
5.1.1 to be published first. Certify the exact Router archive with the published
5.0.1 minimum and the newest compatible coordinated stack supported by the verifier.

[Core change #3845](https://github.com/marionettejs/marionette/pull/3845) records
the 5.1.1 compatibility guidance. Retain its Router browser-coverage and
published-package documentation corrections. Do not replace the historical
published Router 0.1.1 companion evidence with an unpublished 0.2.0 candidate.
Update registry-backed companion checks only after verifying published 0.2.0 bytes.

A core candidate companion check using local archives is additional development
evidence, not registry or publication certification. Use the Router verifier's
local-development lane for the compatible source checkout. The core release's
browser inventory excludes Router, so it does not replace Router's independent
certification. Neither release authorizes the other; honor separate approval and
merged-source certification gates.

Review the [known native WebKit differences](readme.md#known-native-webkit-differences)
alongside any passing receipt. The tests assert observed engine-specific results;
they do not establish identical native semantics.

## Build and check the final merged revision

Final publication evidence must come from clean committed `master`, after the
reviewed merge, using the Node/npm versions in
[`config/release-profile.json`](../../config/release-profile.json). Record the full
source SHA and check results outside the checkout. A PR-head receipt does not
certify a later merge. Any source edit or merge requires fresh final certification.
Coordinate a short release freeze with other writers before packing.

```sh
git rev-parse HEAD
git status --porcelain --untracked-files=all
npm run check:release-profile
npm ci --ignore-scripts
npm run build
npm test
npm run test:types
npm run lint
npm run check:public-tests
npm run check:api-contracts
npm run test:router-tooling
npm run test:router-package
npm run test:source
npm run test:dist
```

Require empty Git status before and after. Then prepare **one** archive into a new
empty directory outside the checkout:

```sh
npm run router:prepare -- --output /absolute/path/router-release
```

On a clean checkout, use the full `npm run build` above first. The narrower
`build:router`/`router:prepare` steps consume core's generated declarations at
`dist/types/esm/index.d.ts`; they do not generate those core declarations.

This rebuilds only the router, verifies the public manifest, peer/dependency
contract and exact MIT notice, then writes the archive, SHA256 and
`router-candidate.json`. Keep those files together. After this pack, do not edit
source, rebuild or repack the bytes selected for publication.

## Certify those exact bytes

Prepare the example renderer with `npm run docs:prepare-html` before verification,
or provide an existing archive through `MNJS_HTML_TARBALL`. The verifier consumes
that archive without implicitly fetching a renderer.

```sh
npm run test:router-tarball -- --artifact /absolute/path/router-release/mnjs-router-0.2.0.tgz --sha256 RECORDED_SHA256 --registry-peers --browser --output /absolute/path/router-verification
```

Require `passed-public-candidate`, clean verifier source, and identical
`archiveSourceCommit`, `verificationCommit` and final merged HEAD. Keep the adjacent
preparation receipt: without it the verifier leaves archive source null. The
complete archive SHA256 must match across all receipts and the eventual publish.

This consumer installs the exact archive with published minimum
`marionette@5.0.1`, Utils/Radio 5.0.1, and optional example dependencies
`@mnjs/adapters@5.0.1`, `lit-html@3.3.3` and `urlpattern-polyfill@10.1.0`, without
install scripts or overrides.
It records registry locators/integrities and verifies ESM/CJS runtime and
declarations, CheckJS, namespaced routeTable inference, mounted lifecycle dispatch,
shipped documentation links, cancellation/retention,
capability checks, actual executable examples and optimized ESM consumers that
remove unused drivers. History ESM/CJS consumers exercise state, Back/Forward
and retained lifecycle using a real Window implementation. Controlled breaks prove missing
rendering and unsafe interpolation are detected. Inspect the resolved dependency
tree for duplicate/incompatible Marionette runtimes. Check the source checkout's
coordinated core version after that stack is published:

```sh
router_core_version=$(node -p "require('./package.json').version")
npm run test:router-tarball -- --artifact /absolute/path/router-release/mnjs-router-0.2.0.tgz --sha256 RECORDED_SHA256 --registry-peers --registry-peer-version "$router_core_version" --browser --output /absolute/path/router-verification-current
```

The explicit registry version must be either the minimum 5.0.1 or the current
coordinated source version. It selects core, Utils, Radio and Adapters together;
registry locators and exact resolved versions are checked and recorded. Older
coordinated versions other than the minimum are not selectable from this checkout.
Select the current coordinated version only after all of its registry packages
exist. Do not rebase solely to choose a registry lane. Preserve exact
preparation/verifier source identity. Local core candidate checks remain
development evidence.

### Standalone History entry certification

The installed verifier checks both root and standalone History ESM/CommonJS
state, Back/Forward and retained lifecycle with JSDOM, plus a production Vite graph
that keeps History out of the native static closure and removes unused memory.
With `--browser`, the same exact-archive consumer additionally runs the standalone
production matrix on Chromium, Firefox and WebKit. Each engine checks Navigation
available, undefined and exposed by a throwing getter, for nine required cases.
The matrix uses the complete Router inventory's launch policy, including
`chromiumSandbox: true`, and records actual executable versions and requests.

Require all nine cases to pass alongside the complete root-entry inventory.
These are separate results: the root inventory alone does not certify the
separately compiled standalone entry. The CI aggregate requires both. Preserve
all emitted chunks, maps, manifest, per-engine JSON and `historyExclusiveAssets`
as evidence of the verifier consumer's split. Applications must derive preload
and service-worker precache exclusions from their own final production graph and
manifest; do not copy the verifier's asset names or closures into an application.
Its chunk layout and exclusive dependencies can differ. A blocked engine cannot
be reported as a passing target.
For a diagnostic rerun against an installed consumer, use
`node test/router/lazy-history.mjs CONSUMER --browser`; `--engine firefox` selects
a subset and does not satisfy the three-engine gate.

The browser policy is **Chromium, Firefox and Playwright WebKit**. Both the
source-checkout suite and exact-installed-archive suite run the complete Router
inventory on every engine. The default driver exercises the actual Navigation API;
Router also requires URLPattern and the other documented Web APIs. The explicit
History path makes Navigation access throw and installs the actual URLPattern
polyfill on each engine; it does not certify other missing built-ins.

Use the Playwright engines pinned in the release profile. Source-checkout CI uses
the matching official container described in
[the test guide](../../test/README.md#browser-ci-environment).
The installed-archive workflow prepares the tarball on canonical Ubuntu Linux,
then transfers those same bytes and their adjacent `router-candidate.json` to
GitHub-hosted `macos-15` arm64 for browser verification with registry peers.
The producer's source commit must equal both archiveSourceCommit and
verificationCommit; the SHA-256 must match the producer output, preparation
receipt and archive. This workflow requires the preparation receipt and clean
verifier source before/after, including `verificationDirty: false`.
The verifier explicitly uses `--artifact` and `--sha256`; it must not repack Router
on macOS. Existing renderer identity and published-peer integrity checks remain.
Browser results on this lane are macOS evidence, not Linux archive certification.
The earlier Linux container/stock-host sandbox failures remain missing Linux
archive coverage; no helper or host-security changes are made to bypass them.
Require actual passing launches and inventory receipts before claiming validation.
The verifier keeps one installed archive/consumer and executes each engine in a
separate process, retaining raw JSON, blobs and traces per engine. It merges the
available blobs using Playwright, then requires the full three-engine inventory
and successful engine processes. A blocked engine is recorded as never run, not
skipped; partial Firefox/WebKit evidence cannot pass certification or the required
CI aggregate. Receipts record host platform/architecture as well as browser versions.
An existing supported Chromium can still be selected with
`--chromium-executable /absolute/path/chromium`; it changes only the Chromium lane.
The receipt records each actual browser version. Require every inventory case
once on each engine with no failures, retries or skips, including native
capability failures. Missing checks remain missing, not successful certification.
Playwright WebKit coverage does not certify every shipping Safari or iOS version.
Do not weaken browser security or bypass download restrictions. Use a supported
cloud execution boundary when a managed command wrapper prevents an installed
browser's sandbox helper. Earlier Chromium-only receipts remain evidence only
for their original archive, verifier policy and executable; they do not establish
the expanded coverage.

Without `--registry-peers`, results are labeled `local-development`; without
`--browser`, they do not establish browser coverage. The separate core release
retains its full three-engine exact inventory through
`playwright.core-release.config.mjs`. Router certification does not weaken it.

## Publish only the certified archive, then tag

Recheck publisher identity/scope authority, version availability, final source,
clean status and archive digest immediately before publication. Honor normal
2FA/trusted-publishing requirements. Publish the tarball directly:

```sh
npm publish /absolute/path/router-release/mnjs-router-0.2.0.tgz --ignore-scripts --access public --tag latest --registry=https://registry.npmjs.org/
```

Do not substitute a source directory, which would repack. If the outcome is
uncertain, query registry state before retrying. Verify public version 0.2.0,
`dist-tags.latest`, and `dist.integrity`; download the registry archive through the
ordinary supported registry route and compare its full SHA256 with the certified
archive before announcing availability.

Only after confirmed publication, create and push the package-specific tag at the
certified source revision:

```sh
git tag -a router-v0.2.0 CERTIFIED_SOURCE_SHA -m '@mnjs/router 0.2.0'
git push origin refs/tags/router-v0.2.0
```

Verify the remote tag resolves to that exact source. Publication/tagging do not
authorize deployment or a coordinated core release.
