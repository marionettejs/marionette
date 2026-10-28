# Release @mnjs/test

This procedure releases only `@mnjs/test@0.1.0`, publicly, with dist-tag `latest`.
The release owner is Paul Falgout or a publisher he explicitly authorizes. Record
that person's approved npm username with the release receipt; a GitHub identity is
not evidence of npm access. This document prepares the release and grants no
permission to merge, publish, create tags or change account settings.

The root `release:*` commands and `.github/workflows/release.yml` coordinate
`@mnjs/utils`, `@mnjs/radio`, `marionette`, `@mnjs/data` and `@mnjs/adapters`.
They do **not** certify or publish this helper. Do not dispatch that workflow for
an independent helper release or add the helper to its package inventory.

## Confirm the publishing account and version

After publication is separately approved, use the publisher's existing authorized
npm session and the public registry. Do not create credentials, trusted publishers,
organization grants or other persistent access as part of this procedure.

```sh
npm whoami --registry=https://registry.npmjs.org/
npm view @mnjs/test versions dist-tags maintainers --json --registry=https://registry.npmjs.org/
```

Compare `whoami` with the specifically approved npm account. Confirm in authenticated
npm settings that it can create a **public** package in the `@mnjs` scope (first
publication), or has write permission to the existing package. A public 404 alone
proves neither namespace ownership nor publish permission. For an existing package,
`npm owner ls @mnjs/test --registry=https://registry.npmjs.org/` is additional
read-only evidence; honor organization/team permissions and normal 2FA requirements.
Authentication, permission or network failures are blockers, not reasons to change
credentials or registry settings silently.

Confirm that `0.1.0` is available and that assigning `latest` is still appropriate.
Stop for a maintainer decision if the version exists, the package belongs to an
unexpected owner, or `latest` already targets a newer release. Never overwrite an
existing version, silently bump the version or retarget another dist-tag.
The manifest fixes public access and the public registry; the eventual publication
command below also makes both explicit.

## Verify consumer documentation destinations

The npm README is consumer onboarding. The canonical `guide.md` is shipped with
the helper itself and linked from the README; it must remain available at
`node_modules/@mnjs/test/guide.md`, independently of the installed core version.
Keep release operations and repository verification commands in this file,
`test/README.md` and `examples/README.md`, outside the shipped consumer surface.

Repository-example links use `master`, consistent with the package homepage.
They are mutable repository examples, not a frozen dependency/version contract;
the shipped guide's compatibility table records tested versions. Do not pin these
links to a PR commit that a squash merge need not preserve, or advertise a tag
before it exists. Before publication, verify every repository-example destination
against the actual merged `master` and check its content. PR-head path verification
does not make new destinations live on `master` before merge. Verify the packed
README, guide, relative links and section anchors as well as the runtime payload.

## Build and certify one archive from final source

Use the canonical repository, a clean committed checkout, and Node/npm from
`config/release-profile.json`. Record the full source SHA, tool versions, registry
preflight, archive SHA256 and check results outside Git. Require current-head CI
and review completion. The final publication source must be the reviewed **merged**
revision on `master`, with no uncommitted or untracked source changes.

A PR-head run is pre-merge evidence only. After merging, repeat this section on the
actual merged revision, even if the helper files appear unchanged. Any subsequent
source edit or merge requires fresh final-revision certification. Do not publish
this PR's archive as though it certified a future merge commit.

```sh
git rev-parse HEAD
git status --porcelain --untracked-files=all
node --version
npm --version
npm run check:release-profile
npm ci --ignore-scripts
npm run build
npm run lint
npm run check:api-contracts
npm run check:public-tests
npm run test:helpers
npm run docs:check
```

Require an empty Git status before and after those checks. In a new empty directory
outside the checkout, pack the helper **once**, after all content changes:

```sh
mkdir -p /absolute/path/to/mnjs-test-release
npm pack ./packages/test --ignore-scripts --json --pack-destination /absolute/path/to/mnjs-test-release
```

Record the archive's SHA256 with a portable Node command:

```sh
node --input-type=module -e "import{readFileSync}from'node:fs';import{createHash}from'node:crypto';console.log(createHash('sha256').update(readFileSync(process.argv[1])).digest('hex'))" /absolute/path/to/mnjs-test-release/mnjs-test-0.1.0.tgz
```

On a provisioned cloud runner with Chromium, Cypress 16.1.1 and its display
requirements installed, pass the same archive and its recorded hash to the verifier:

```sh
npm run test:helpers:consumer -- --artifact /absolute/path/to/mnjs-test-release/mnjs-test-0.1.0.tgz --sha256 RECORDED_SHA256 --browser --cypress --output /absolute/path/to/mnjs-test-release/verification
```

`--artifact` and `--sha256` are required together. This mode verifies the digest,
checks package identity/version and allowed files, and installs that archive without
packing or rebuilding it. The temporary consumer changes only the helper locator
and its archive integrity in the committed lock; external dependency pins stay
unchanged. The report records both original and adapted lock hashes. All requested
stages must pass. If runners are separate,
transfer the original archive and compare SHA256, use the same clean source revision
and locked examples, and retain each report with its flags; do not repack on the
second runner. Preserve the tarball and reports together. `sourceDirty` must be
false, `sourceRevision` must match the final merged SHA, and `sha256` must match the
archive. The report does not prove its own source/archive lineage: retain the pack
receipt and source SHA from the clean build as well.

The browser checks exercise the Vitest and Playwright examples. Real Cypress checks
include normal component cases, four exact command-error/fresh-mount probes and the
separate automatic-afterEach error/native-skip probe. Missing binaries, skipped
runtime checks or earlier-revision results do not complete final certification.
The isolated consumer uses registry Marionette 5.0.0 with committed external pins;
it does not certify unrelated unreleased changes to the five framework packages.

## Publish only the certified bytes, after explicit approval

Recheck the approved npm account, version availability, final source SHA, clean
status and recorded SHA256 immediately before publication. Inspect the archive's
manifest/README and verify its report. npm supports publishing a tarball directly;
do not substitute `npm publish ./packages/test`, which would repack current files.

Only after the release owner authorizes this exact archive, account, version and
dist-tag, run:

```sh
npm publish /absolute/path/to/mnjs-test-release/mnjs-test-0.1.0.tgz --ignore-scripts --access public --tag latest --registry=https://registry.npmjs.org/
```

Honor npm's normal authentication/2FA flow. If the outcome is uncertain, inspect
registry state before retrying. After a confirmed publication, read back the package
version, `dist-tags.latest`, public visibility and `dist.integrity`, and compare the
registry archive's SHA256 with the certified local archive. Retain that evidence
before announcing availability. A dry run, green PR or local pack is not publication.
No Git tag, coordinated v5 release or deployment is required by this procedure.

References: [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/),
[scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/),
[npm owner](https://docs.npmjs.com/cli/v11/commands/npm-owner/).
