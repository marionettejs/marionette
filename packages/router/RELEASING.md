# Private router preparation

This procedure prepares only `@mnjs/router@0.1.0`. It grants no authority to push,
merge, publish, tag or deploy. Keep `private: true`. The maintainer has confirmed
the Marionette MIT license, and its exact notice is included. Publication permission
remains withheld; this is separate from the settled license choice.
No command below publishes or creates persistent access.

The router has its own version and archive. Do not enroll it in the five-package
5.x publisher or bump core packages for this preparation. The independent
[`@mnjs/test` procedure](../test/RELEASING.md) is the precedent for a future
separately approved publication. The unrelated existing `v0.1.0` tag must not be
reused. If a router tag is later approved, use `router-v0.1.0`; create none now.

## Prepare one archive

Use clean committed source and the Node/npm versions in
[`config/release-profile.json`](../../config/release-profile.json). Existing
dependencies must be installed. Record exact source, tool versions and results.
Run the focused source and package checks:

```sh
npm run check:release-profile
npm run build:router
npm test -- test/unit/router
npm run test:types
npm run lint
npm run check:public-tests
npm run check:api-contracts
npm run test:router-tooling
npm run test:router-package
```

Pack once into a new directory outside the checkout:

```sh
npm run router:prepare -- --output /absolute/path/router-candidate
```

Preparation rebuilds only the router, requires clean source before and after,
verifies the exact Marionette MIT notice and private flag, and writes the archive,
SHA256 and `router-candidate.json`. Keep those files together. This is a private
candidate, not a public release certificate.

## Verify those exact bytes

Use the archive and its recorded hash, without repacking:

```sh
npm run test:router-tarball -- --artifact /absolute/path/router-candidate/mnjs-router-0.1.0.tgz --sha256 RECORDED_SHA256 --registry-peers --browser --output /absolute/path/router-verification
```

This installs the archive with published `marionette@5.0.1`, `@mnjs/utils@5.0.1`
and the transitive Radio peer, without install scripts or resolution overrides.
It verifies installed ESM/CJS runtime, both declaration entry points and CheckJS,
shipped documentation links, cancellation/retention and the desk consumer. Native
tests load the installed router and peer bytes, not checkout router output.
The receipt retains peer versions, registry locators/integrities, lockfile,
archive hash, source cleanliness and requested native results.
`verificationCommit`/`verificationDirty` describe the verifier checkout. An adjacent
`router-candidate.json` binds preparation source to the archive hash and must match
that checkout. Without it, `archiveSourceCommit` remains null: successful byte and
consumer checks do not establish archive source lineage. Keep the preparation
receipt beside the archive for final private preparation.

Initial native certification is Chromium-only, with all documented capabilities.
Standalone evidence at runtime checkpoint `4ecb97d5` used Chromium 154; the app
owner also reports Chromium 151 integration evidence. These are tested builds,
not a promise about every browser with similar APIs. Firefox/WebKit remain
uncertified initial targets; no fallback or core transpilation policy is changed.
Use an installed supported Chromium with `--chromium-executable /absolute/path/to/chromium`
when the pinned Playwright executable is unavailable. Record its actual version;
do not weaken security or bypass download restrictions. Missing native coverage
is reported as missing. The router inventory requires every declared Chromium
case once, with no failures, retries or skips.

Without `--registry-peers`, the development check packs local peers and labels
that evidence `local-development`. It does not establish published-peer
compatibility. Without `--browser`, it does not establish native coverage.
Registry failures remain pending checks; do not silently substitute local peers.

The core release uses `playwright.core-release.config.mjs`, which excludes only
router-owned specs. Its existing three-engine exact inventory remains required.
Router preparation uses its own inventory/configuration and does not dilute that
core guarantee. Regular development discovery includes the router only in its
Chromium project; all core cases retain the three original engines. The previous
573-versus-372 mismatch contained 201 router entries across three projects. The
declared initial policy has separate exact release inventories: all 372 core
entries plus the router's Chromium cases. The router inventory grows with reviewed
regressions without enrolling them in the coupled core publisher.

## Future release decision

Even a passing preparation receipt has `publicationAllowed: false`. A future
release requires explicit publication approval, an approved npm
publisher, current namespace/version checks, an intentional public-manifest and
verification-policy change, and a newly certified archive from the final approved
revision. Never remove the private guard as part of routine preparation. A 404
does not establish namespace ownership or publishing authority. No credentials,
trusted publishers or account grants are created by these tools.

The current declared/verified peer is 5.0.1. Optional inclusion in Marionette 5.1
needs verification against the actual 5.1 candidate before changing that contract;
this preparation does not publish or alter core. App layout, multipanel behavior
and feature policy remain consumer concerns.
