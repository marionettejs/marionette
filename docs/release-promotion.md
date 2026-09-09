# Immutable release promotion

Marionette promotes verified npm tarballs from one source commit. The release
workflow never rebuilds the package after those tarballs are created. The npm version,
Git tag, GitHub release, package manifest, evidence manifest, and source commit must
all agree.

Use the [release checklist](./maintainers/release-checklist.md) to coordinate npm,
GitHub, the website, and MCP. This page owns package promotion and recovery; a
successful package workflow is only one stage of the complete release.

The machine-readable publication gate is
[`config/release-promotion.json`](../config/release-promotion.json). Stable publication is
disabled; prerelease authorization is restricted to `5.0.0-beta.2`. Schema 2 separates `publication.stable`
(a boolean) from `publication.prerelease` (one exact version string, or `null`).
A beta authorization never authorizes stable or a later prerelease. Both channels
use the same protected workflow and exact-artifact checks. Pull requests and manual
dry runs exercise validation without creating an npm version, tag, or release.
Stable authorization still requires the final evidence in
[issue #147](https://github.com/marionettejs/marionette/issues/147).
Pull-request output cannot activate the write-capable jobs: those jobs also require a
manual dispatch from `master` in this repository with the `publish` input enabled,
followed by approval of the protected `stable-release` environment.

Generated `dist/` files and `src/version.js` are ignored by Git. `npm ci` runs the
root `prepare` lifecycle to build all five packages and test the core distributions.
Artifact construction performs a final clean build and distribution check from the
verified source commit, then runs `npm pack --ignore-scripts` so packing cannot
rebuild those tested outputs. This final build also replaces stale local ignored files. Package fixtures validate the exact tarballs before any
publication. TypeScript declarations are generated from each package's source. The packages
are built and published in dependency order: utils, radio, core, data, adapters.

## v5 distribution policy

Every v5 stable artifact retains the ESM, CommonJS, unminified UMD, and minified UMD
outputs and their existing package entrypoints. ESM is canonical for new
applications; CommonJS and UMD are compatibility distributions. Source,
distribution, package, and release-artifact validation continue to verify all four.

The v5.0.0 release notes must ask UMD and AMD consumers to identify their usage in
the public issue tracker. Six months after v5.0.0 is published, maintainers review
support reports, public-code usage, package-size impact, and maintenance cost. UMD
is the first removal candidate for v6, followed by CommonJS. The review collects
evidence for a separate major-version decision and does not itself remove, deprecate,
or promise removal of either format.

## Evidence artifact

The canonical Ubuntu release job stores these files together as the immutable
`release-candidate-<commit>` workflow artifact for 90 days:

- the exact tarballs: `mnjs-utils-<version>.tgz`,
  `mnjs-radio-<version>.tgz`, `marionette-<version>.tgz`,
  `mnjs-data-<version>.tgz`, and `mnjs-adapters-<version>.tgz`;
- `release-evidence.json` and its SHA-512 checksum;
- the complete `npm pack --json` manifest for each package;
- the Brotli-11 bundle report;
- the portable `starter/`, `START-HERE.md`, and checksummed development-starter report;
  `development-starter.tar.gz` carries the same starter and instructions as a GitHub
  release asset. Extract it beside the five tarballs before verifying a downloaded
  GitHub release or running the starter;
- `candidate-validation.json`, its checksum, check logs, browser results and artifact
  identities, and every locked consumer fixture result.

The evidence records the tarball SHA-256, SHA-512, npm integrity and shasum, package
manifest, source repository and commit, expected npm dist-tag and Git tag, Node/npm
versions, release-profile Git blob and SHA-512 revisions, runner image, and workflow
run identifiers. Every later job downloads and re-verifies those bytes. Package
fixtures consume the tarball directly on Ubuntu 24.04 x64, macOS 15 arm64, and
Windows 2025 x64.

## Dry run

The `Release promotion` workflow runs automatically when a pull request changes the
release contract. A maintainer can also dispatch it with `publish` left false. The
dry run:

1. verifies the pinned release profile and clean source commit;
2. performs the final artifact build and packs without lifecycle scripts;
3. runs `release:validate` against those exact tarballs: public boundaries, workflow
   lint, source/types, tooling tests, coverage, executable documentation checks,
   distribution validation, all three browser engines, and every locked fixture;
4. verifies the successful candidate report and exact tarballs on all supported
   release hosts;
5. inspects npm, Git tag, and GitHub release target occupancy;
6. runs `npm publish <tarball> --dry-run --ignore-scripts` and validates the GitHub
   release plan.

The candidate version is `5.0.0-beta.2`; the registry alpha belongs to an older
implementation. Inspect all five candidate versions and their Git tag before
publication. A real publication request refuses any target that conflicts with the
verified artifact before requesting write permissions; exact matching targets enter
the documented recovery path.

## Beta publication authorization

The [beta contract and readiness checklist](./beta.md) define the candidate scope.
Use matching `5.0.0-beta.2` versions across all five packages and their internal
requirements. `publication.stable` remains `false`; `publication.prerelease`
authorizes only `5.0.0-beta.2`. This policy does not initiate publication: verify npm
access, certify the exact candidate, and obtain release approval before manually
dispatching the protected workflow. Changing this policy changes the source commit
and invalidates prior certification; rebuild and certify the authorization commit
before publication.

Until the first stable v5 release, the current v5 prerelease uses npm `latest`
and remains a GitHub prerelease. Preparing or validating beta.2 does not change
registry tags. Authorized publication moves `latest` from beta.1 to beta.2 for all
five packages and leaves `next` untouched. Once stable v5 ships, change
`npm.prereleaseTag` to `next` before authorizing subsequent prereleases so `latest`
continues to identify stable v5. Verification checks the policy-selected dist-tag
for every package. Tag changes require an authorized release operation;
verification never repairs registry state.
A missing or stale tag fails with the affected package and expected version.
After correcting publication or propagation, rerun verification against the same
certified artifacts. A later beta
needs a new explicit version authorization. Do not bypass the workflow with an
ad hoc core-only publish. The existing environment name `stable-release` is also
used for prereleases so npm trusted-publisher identities remain exact.

All five package names need a verified publisher. If a scoped package does not yet
exist, resolve organization ownership and npm's first-publication procedure before
dispatch. First publication is a separate authorized operation using the tested
package; never publish an empty placeholder to reserve the name. Record its exact
integrity and configure its trusted publisher before continuing the same-artifact
recovery path. A dry run does not prove account or scope permission.

## Website and MCP snapshot handoff

Package publication does not deploy the website or its documentation MCP. After an
authorized release, import the documentation artifact from that exact source into
the [website repository](https://github.com/marionettejs/marionettejs.com) and follow its
manual publication procedure. Keep the previous snapshot identified by its actual
version until the replacement is verified; do not relabel it as the new release.

Before announcing hosted documentation support for the release, verify the live
website provenance and `marionette://catalog` at `https://mcp.marionettejs.com/mcp`
against the released package's version and source revision. Exercise initialization,
tool discovery, search, complete document/example pagination, and version rejection
through an MCP client. The website's MCP runbook owns deployment and hosted-runtime
checks. Until the snapshot matches, direct new-version consumers to their bundled
Markdown. See [MCP setup](https://marionettejs.com/docs/mcp/) for client instructions.

## Stable publication authorization

Final release authorization requires one reviewed commit that changes
`publication.stable` to `true` after every gate in issue #147 passes. Before merging
that authorization:

1. Create the protected GitHub environment named `stable-release` and require the
   maintainer approval appropriate for the release.
2. Configure each Marionette npm package's trusted publisher for the
   `marionettejs/marionette` repository, `release.yml` workflow, and
   `stable-release` environment. Allow `npm publish` only.
3. Confirm the workflow still uses a GitHub-hosted runner, npm 11.5.1 or newer, and
   `id-token: write` only on the gated publish job.
4. Revoke obsolete automation tokens after trusted publishing succeeds. No npm token
   is stored in GitHub.
5. Dispatch the workflow from `master` with `publish` true and approve the protected
   environment only after reviewing the source commit and evidence artifact.

Documentation exports derive their channel from the candidate version and this
policy, independently of whether publication is currently authorized. Both stable
and pre-stable v5 metadata currently use `latest`; the post-stable prerelease
channel becomes `next` through the policy change described above.

An initial publication requires unused npm, tag, and release targets. A recovery
rerun may continue when npm integrity and the Git tag already match the verified
artifact; an existing draft or public release must have the same source commit, asset
manifest, and asset bytes. A matching public release is treated as an already-completed
GitHub publication after those assets are downloaded and reverified; if its matching
tag was deleted, recovery recreates that tag at the verified source commit.

The write-enabled job first stages a draft GitHub release with the verified assets,
then publishes the exact tarball through npm OIDC trusted publishing, verifies the
registry integrity with bounded propagation retries, reverifies the local and staged
asset bytes, and finally publishes the draft release and matching tag. npm automatically
creates provenance for a public package published from this public GitHub repository
through trusted publishing.

## Recovery and rollback

Published npm versions are immutable. Never delete and recreate a version or rebuild
its release asset.

- Before npm publication, delete an incomplete draft GitHub release and rerun the
  failed job from the same workflow run.
- If npm succeeds but final GitHub publication fails, keep the draft and its assets.
  Rerunning the failed job verifies the existing npm integrity and the downloaded
  draft assets before publishing the release.
- If npm contains the version with different integrity, or the tag points to another
  commit, stop. Publish a corrected new version after review.
- If a released version is bad, move the npm dist-tag to the prior verified version,
  deprecate the bad version with a reason, and publish a new corrected version. Do not
  overwrite the immutable package.
- Record any environment bypass, interrupted publication, dist-tag move,
  deprecation, or recovery in a public issue linked to the workflow run and release.

The GitHub draft or published release retains the exact assets needed to finish
recovery even after the temporary workflow artifact expires. Website and MCP
publication are separate manual stages of the release checklist, outside this
package workflow.

## Publication trust configuration

`config/release-environment.json` records the GitHub environment settings for
`stable-release`. On 2026-09-08, the live environment was verified to require
`paulfalgout` approval and allow deployments from the `master` branch only. Self
review and administrator bypass remain allowed; this is a maintainer approval
gate, not independent two-person approval. Recheck the live settings before
publication; a checked-in configuration does not prove a remote policy is current.

Each of the five npm packages must separately trust GitHub Actions for owner
`marionettejs`, repository `marionette`, workflow `release.yml`, and environment
`stable-release`. The package access/settings UI requires a signed-in npm
maintainer. This audit could not verify those settings; do not infer npm trust
from the GitHub environment or the successful publication dry run. Follow npm's
[trusted publisher setup](https://docs.npmjs.com/trusted-publishers/) and retain
verification evidence for each package before enabling publication. No publication
token or credential belongs in the repository.

## Published provenance evidence

`verify-npm` requires each of the five exact package versions to expose npm SLSA
provenance metadata, in addition to matching integrity and the configured channel.
It retries delayed metadata propagation before the GitHub release becomes public.
This confirms registry metadata availability; it is not cryptographic verification
of the attestation. For an installed release, run `npm audit signatures` to verify
registry signatures and the available provenance, as described in
[npm's verification guide](https://docs.npmjs.com/viewing-package-provenance/).
A passing signature audit alone does not prove all five packages have provenance;
the explicit presence check covers that gap.

On 2026-09-09, beta.1's core package exposed SLSA provenance while the four
companion packages did not. That historical publication is not an all-package
provenance success. Existing tarballs are immutable and are not republished by
these checks. The next authorized version must establish the five-package result;
missing provenance requires diagnosing its publication path before a new version,
not silently waiving the requirement or changing `latest`.
