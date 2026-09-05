# Immutable release promotion

Marionette promotes one verified npm tarball from one source commit. The release
workflow never rebuilds the package after that tarball is created. The npm version,
Git tag, GitHub release, package manifest, evidence manifest, and source commit must
all agree.

The machine-readable publication gate is
[`config/release-promotion.json`](../config/release-promotion.json). Publication is
currently disabled. Pull requests and manual dry runs exercise the complete build,
cross-platform package verification, npm dry run, and GitHub release plan without
creating an npm version, tag, or release. Stable publication remains disabled until
the final evidence in [issue #147](https://github.com/marionettejs/marionette/issues/147)
authorizes changing `publicationEnabled` to `true` in a reviewed commit.
Pull-request output cannot activate the write-capable jobs: those jobs also require a
manual dispatch from `master` in this repository with the `publish` input enabled,
followed by approval of the protected `stable-release` environment.

Generated `dist/` files and `src/version.js` are ignored by Git. `npm ci` runs the
root `prepare` lifecycle to build all three packages and test the core distributions.
Artifact construction performs a final clean build and distribution check from the
verified source commit, then runs `npm pack --ignore-scripts` so packing cannot
rebuild those tested outputs. This final build also replaces stale local ignored files. Package fixtures validate the exact tarballs before any
publication. Handwritten declaration sources live in `packages/*/types/` and are
copied into each package distribution during its build.

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

- the exact `marionette-<version>.tgz` tarball;
- `release-evidence.json` and its SHA-512 checksum;
- the complete `npm pack --json` package manifest;
- the Brotli-11 bundle report.

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
2. runs source, lint, coverage, browser-profile, diagnostic, distribution, and
   package checks;
3. performs the final artifact build and packs without lifecycle scripts;
4. verifies the exact tarball on all supported release hosts;
5. inspects npm, Git tag, and GitHub release target occupancy;
6. runs `npm publish <tarball> --dry-run --ignore-scripts` and validates the GitHub
   release plan.

The current `5.0.0-alpha.2` npm version and tag already exist from an older commit.
Dry-run target inspection reports that collision as expected. A real publication
request refuses any target that conflicts with the verified artifact before requesting
write permissions; exact matching targets enter the documented recovery path.

## Stable publication authorization

Final release authorization requires one reviewed commit that changes
`publicationEnabled` to `true` after every gate in issue #147 passes. Before merging
that authorization:

1. Create the protected GitHub environment named `stable-release` and require the
   maintainer approval appropriate for the release.
2. Configure the `marionette` npm package trusted publisher for the
   `marionettejs/marionette` repository, `release.yml` workflow, and
   `stable-release` environment. Allow `npm publish` only.
3. Confirm the workflow still uses a GitHub-hosted runner, npm 11.5.1 or newer, and
   `id-token: write` only on the gated publish job.
4. Revoke obsolete automation tokens after trusted publishing succeeds. No npm token
   is stored in GitHub.
5. Dispatch the workflow from `master` with `publish` true and approve the protected
   environment only after reviewing the source commit and evidence artifact.

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
recovery even after the temporary workflow artifact expires. Website publication is a
separate post-v5 task and is not part of this workflow.
