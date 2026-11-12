# Release @mnjs/router 0.1.1

**Preparation only:** the 0.1.1 patch is prepared alongside Marionette 5.1.0.
Neither this document nor the version bump authorizes merging, publishing or
tagging. Require the release decision and final certification below.

Compared with published Router 0.1.0, this patch updates the Catalog example from
Lit to optional `@mnjs/html`, documents explicit renderer preparation, and removes
the Desk example's incompatible exact Adapters 5.0.1 instruction for core 5.1.
Router runtime source, public API, Node floor, peer range and Utils range are unchanged.

This procedure releases only `@mnjs/router@0.1.1`, publicly, with npm dist-tag
`latest` and Git tag `router-v0.1.1`. Do not reuse the existing
`router-v0.1.0` or unrelated `v0.1.0` tags. Router is independently versioned;
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
this Router patch even when they share a preparation PR.

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

Confirm 0.1.1 is unused and assigning `latest` is appropriate. Do not overwrite an
existing version, invent a different version or retarget another dist-tag. Keep
Marionette within `^5.0.1`. Verify both the minimum 5.0.1 and the newest available
compatible core; when they resolve to the same published bytes, record that fact.
Future compatible releases are not already browser-certified. Router's ordinary
Utils dependency is `^5.0.1`, permitting compatible deduplication independently of
the Marionette peer. Certification still installs the actual 5.0.1 minimum bytes;
the range is not a claim that future versions have already passed these checks.

## Coordinate the 5.1.0 release order

One reviewed PR can prepare both releases, but the five-package publisher does
not publish Router. After the merged-source certification and separately
authorized coordinated release, verify all five 5.1.0 registry packages and the
Adapters `^5.0.1` peer before certifying Router against that published stack.
Then publish only the independently certified Router archive. Do not publish
Router from local-candidate evidence alone or make 0.1.1 availability a prerequisite
for the core publisher. A failure in either publication remains a separate result.

The published 0.1.0 documentation fixture and tag links remain historical evidence
until the new registry bytes are verified; do not relabel them as 0.1.1 results.

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
npm run test:router-tarball -- --artifact /absolute/path/router-release/mnjs-router-0.1.1.tgz --sha256 RECORDED_SHA256 --registry-peers --browser --output /absolute/path/router-verification
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
tree for duplicate/incompatible Marionette runtimes. After the coordinated 5.1.0
packages are published, verify the **same archive**
against the current coordinated version as well, in a separate receipt directory:

```sh
npm run test:router-tarball -- --artifact /absolute/path/router-release/mnjs-router-0.1.1.tgz --sha256 RECORDED_SHA256 --registry-peers --registry-peer-version 5.1.0 --browser --output /absolute/path/router-verification-5.1.0
```

The explicit registry version must be either the minimum 5.0.1 or the current
coordinated source version. It selects core, Utils, Radio and Adapters together;
registry locators and exact resolved versions are checked and recorded. Before
publication, the local-development lane can exercise the 5.1.0 candidates, but
it does not replace this final registry and browser certification.

The initial browser policy is **Chromium only**. The default driver requires the
Navigation API and Router requires URLPattern plus the other documented Web APIs.
The explicit History path is tested with native Navigation unavailable and the
installed URLPattern polyfill; it does not certify other missing built-ins.
Firefox and WebKit are untested.
Use the pinned browser or an installed supported Chromium via
`--chromium-executable /absolute/path/chromium`, recording its actual version.
Do not weaken browser security or bypass download restrictions. Require every
inventory case once with no failures, retries or skips. Missing checks remain
missing, not a successful certification. Use a supported cloud execution boundary
when a managed command wrapper prevents an installed browser's sandbox helper.

Without `--registry-peers`, results are labeled `local-development`; without
`--browser`, they do not establish browser coverage. The separate core release
retains its full three-engine exact inventory through
`playwright.core-release.config.mjs`. Router certification does not weaken it.

## Publish only the certified archive, then tag

Recheck publisher identity/scope authority, version availability, final source,
clean status and archive digest immediately before publication. Honor normal
2FA/trusted-publishing requirements. Publish the tarball directly:

```sh
npm publish /absolute/path/router-release/mnjs-router-0.1.1.tgz --ignore-scripts --access public --tag latest --registry=https://registry.npmjs.org/
```

Do not substitute a source directory, which would repack. If the outcome is
uncertain, query registry state before retrying. Verify public version 0.1.1,
`dist-tags.latest`, and `dist.integrity`; download the registry archive through the
ordinary supported registry route and compare its full SHA256 with the certified
archive before announcing availability.

Only after confirmed publication, create and push the package-specific tag at the
certified source revision:

```sh
git tag -a router-v0.1.1 CERTIFIED_SOURCE_SHA -m '@mnjs/router 0.1.1'
git push origin refs/tags/router-v0.1.1
```

Verify the remote tag resolves to that exact source. Publication/tagging do not
authorize deployment or a coordinated core release.
