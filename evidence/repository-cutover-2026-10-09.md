# Repository cutover record — 2026-10-09

This checklist prepares the approved repository transition. It does not authorize
publication, deployments, security changes, archival, branch deletion or RC3.
Status: preparation snapshot for [PR #626](https://github.com/marionettejs/marionette-develop/pull/626).
The release maintainer, Paul Falgout, must authorize its merge through the
coordinating task; record that approval on the PR before execution. This dated
record is not standing repository guidance. Re-read live state at each gate.
After destination import and exact `5.0.0` certification, mark this record
completed with the actual IDs and remove the temporary cutover link from the
shipped changelog. Retain this file as historical evidence, not an active runbook.

## Identity and acceptance

Read-only preflight on 2026-10-09 UTC confirmed:

| Role | Repository before cutover | Immutable repository ID | `master` |
| --- | --- | --- | --- |
| v5 development history | `marionettejs/marionette` | `306411262` | `5170d87568e050cb4ad0bd08b5ba48d3ee6d605c` ([PR #625](https://github.com/marionettejs/marionette-develop/pull/625)) |
| Canonical destination / v4 history | `marionettejs/backbone.marionette` | `2965621` | `a8ca523cfd1ffb8dc4a2095c34d590aa7701110a` |

The source manifests are `5.0.0-rc.2`. Paul accepted the bounded evidence in
[issue #574, comment 6083583403](https://github.com/marionettejs/marionette-develop/issues/574#issuecomment-6083583403).
Retain the dates, package revisions, integrities, applicability limits and gaps;
acceptance does not assert continuous seven-day coverage or turn local artifacts
into public evidence. The independent agent study remains deferred. Final exact
`5.0.0` artifact certification happens later in the destination. No RC3 is planned.

## Preparation and preservation gates

- [ ] Record release-maintainer authorization on preparation PR #626 and satisfy
  its current checks and review requirements without bypass. Merge it with a
  **merge commit**, retaining all reviewed preparation commits and their pinned
  evidence links as ancestors. Do not squash/rebase or delete its branch.
  Allow its automatic website sync to finish and record the resulting website PR before renaming: the sync
  clones the current canonical name, which must still identify v5 at that point.
  Do not merge the website PR or enable its auto-merge. Prospective development
  links in both reading copies become live when the first rename completes.
- [ ] Coordinate a freeze on merges to both source and destination master during
  the rename/import window; do not change protection to implement this freeze.
  Drain all pre-rename source docs-sync runs before the first rename. The workflow
  now requires the canonical repository name, so events in `marionette-develop`
  cannot dispatch another sync after the source rename. The intentional import
  merge into destination master does match that guard and triggers a new sync
  against the now-imported v5 tree. Before that merge, verify destination dispatch
  configuration; the preflight did not find its dispatch credential there. Stop
  for separate credential/configuration approval if it is still absent. Do not
  copy credentials or disable workflows under the repository-rename approval.
  Keep the freeze through import and its sync verification; do not manually
  dispatch website sync during the window.
- [ ] Re-read both repository IDs, heads, open PRs and competing local work before
  acting. Neither repository had an open PR at preflight; that observation is
  not a lock or proof of current inactivity. Ask the coordinating maintainer to
  confirm that no other operator is executing cutover work. Preserve dirty local
  work and use an isolated checkout.
- [ ] Save fresh `git ls-remote --heads --tags` snapshots from both repositories.
  Preflight counted 10 v5 branches / 9 tags and 13 legacy branches / 153 tags,
  with no conflicting tag targets. Include annotated tag object IDs and peeled
  commit IDs. Retain all existing branches and tags in their original repository.
- [ ] Preserve v4 at a new destination `v4` branch pointing to the exact legacy
  head above. If `v4` already exists, compare it and stop on a mismatch. Inspect
  matching workflows and rules before creating this ref; do not trigger a deploy.
- [ ] Record the accepted post-preparation v5 commit as `V5` and fresh legacy
  `master` as `V4`. Stop if either changed unexpectedly. Never rewrite old hashes.

## Rename sequence and history import

1. Report the exact revisions, ref plan and outstanding gates before external
   renames. Confirm `marionettejs/marionette-develop` is available.
2. Rename repository ID `306411262` to `marionette-develop`. Verify the ID at its
   new name before proceeding. Keep it unarchived through stable verification.
3. Rename repository ID `2965621` to `marionette`. Verify its ID, default branch,
   all legacy refs and unchanged protection. Do not assume an old URL redirect
   identifies the intended repository after the canonical name is reused.
4. Update only the isolated checkout's remotes. Keep separate remotes for
   development and destination; do not change other active checkouts.
5. On an isolated import branch based on accepted `V5`, merge the destination's
   legacy `V4` with `git merge --no-ff -s ours --allow-unrelated-histories V4`.
   This is the **ours strategy**, not the conflict-resolution `-X ours` option.
   Verify the merge's two parents are exactly `V5` then `V4`; verify its tree ID
   equals `V5^{tree}`; verify both tips are ancestors. Record all full IDs.
6. Push only that non-default import branch and open a ready destination PR into
   `master`. Legacy protection currently requires one approving review, forbids
   force pushes and deletions, and does not require linear history. Merge commits
   are enabled. Re-read those rules at action time. Obtain the required eligible
   review and satisfy checks; never use admin bypass or push directly to master.
   Use a **merge commit**, not squash or rebase, so both histories remain reachable.
   Before merging, satisfy the destination dispatch-configuration gate above.
   After merging, wait for the triggered source and website sync workflows to
   finish, inspect the resulting reading-copy PR and confirm its auto-merge
   remains off. Verify the sync uses the imported v5 revision and its diff does
   not introduce legacy v4 reading copies or unrelated content; an unchanged
   publication file is also a valid no-op. Do not merge that website PR.
7. Import the 9 existing v5 tags with explicit, individually checked refspecs only
   after checking destination tag-triggered workflows/rules and comparing target
   IDs. Do not recreate tags, overwrite collisions, push a wildcard or publish a
   release. Stop for exact tag approval if any tag can trigger release/deployment.
8. Verify destination `master` contains both histories and its tree equals the
   accepted v5 tree (unless separately reviewed changes intervene). Compare every
   legacy branch/tag with its snapshot, except the intentional master advance;
   verify `v4` still equals `V4`, and all imported v5 tags match their original
   object IDs. Verify every original development branch/tag remains present.

If a rename fails halfway, stop and report actual IDs/names. Do not repeat a
mutation against a redirected URL or improvise a rollback. A security/protection
change, new deploy consequence or changed ref requires its own action-time review.

## Local history rehearsal

A local-only rehearsal from the preflight heads produced
`92d5afa8ba6a43d3a0ea0fde6043f0921b383fb0`, with parents
`5170d87568e050cb4ad0bd08b5ba48d3ee6d605c` and
`a8ca523cfd1ffb8dc4a2095c34d590aa7701110a`, in that order. Its tree and the v5
source tree both equal `96667ba68139d2146383077a0fb427abe5c93e25`.
Both ancestry checks passed. This rehearsal was not pushed and is not the final
import commit: repeat it from the approved post-preparation v5 revision.

## Historical links and immutable evidence

Numbered v5 issue/PR links resolve through `marionette-develop`. Pinned v5 source
commits remain canonical because the import preserves their exact objects and
ancestry, consistent with generated documentation links. Generic issue tracker/new-issue links, current-source links,
package repository identity and publication guards remain
`marionettejs/marionette`. Existing legacy numbered links follow the legacy
repository's rename. The legacy changelog is pinned to the original v4 commit,
so it cannot accidentally display the replacement v5 master.

Old commit messages are immutable: bare `#N` in pre-cutover v5 commits refers to
the development repository, even if GitHub auto-links it to a legacy issue in the
new canonical repository. Do not rewrite commit subjects or hashes to fix this.

The ten `evidence/performance-budget-amendments/BA*/prototype-contract.json`
artifacts retain their exact bytes and old issue #127 URL. The explicit
[relocation map](repository-relocation.json) identifies each artifact,
its SHA-256 and its relocated historical issue. This is a location map, not a new
benchmark run, changed budget or renewed certification.

## Settings follow-up: separate action-time approval

No live security settings or credentials are changed by this preparation. Keep
read-only configuration snapshots in the maintainer's local evidence store and
present exact proposed mutations privately at action time. Re-read live values;
do not copy secret values or infer that settings follow Git history.

- Preserve destination branch protection and reviews. Propose any additional v5
  required checks separately after verifying they run in the destination.
- Review Actions restrictions, `stable-release` environment reviewers and branch
  policy for separate approval before release use. Do not copy bypass settings.
- Review destination documentation dispatch credentials and Pages configuration
  separately. The renamed development workflow is stopped by its repository-name
  guard; decide whether to remove its now-unused dispatch credential only through
  a separate action-time approval. Do not remove credentials as part of cutover.
- Verify npm trusted-publisher bindings for all five packages after the swap.
  Obtain approval for any changes rather than assuming identity follows the name.

Repository identities, environments and settings stay with each renamed
repository; importing Git history does not transfer those settings.

## Automatic documentation-sync effect

Merging this preparation PR changes paths watched by the source
[`docs-sync.yml`](../.github/workflows/docs-sync.yml). It dispatches
`library-docs-changed` to `marionettejs/marionettejs.com` using the existing
`WEBSITE_DOCS_DISPATCH_TOKEN`.

At website main `18bf823896bb095a3d893c24d70a500a694add1d`:

- The [receiving workflow](https://github.com/marionettejs/marionettejs.com/blob/18bf823896bb095a3d893c24d70a500a694add1d/.github/workflows/docs-sync.yml)
  clones current library master, prepares reading-copy changes, builds and checks
  them locally, validates the resulting publication file and uploads that artifact.
- Its [publisher](https://github.com/marionettejs/marionettejs.com/blob/18bf823896bb095a3d893c24d70a500a694add1d/scripts/docs-sync/publish.mjs)
  writes only `content/docs-publication-edits.json` on
  `automation/library-docs-sync` and creates or updates one ready PR into `main`.
  It does not update `main`, merge a PR, enable auto-merge or deploy. If the content
  is unchanged it performs no publication write; failed validation stops before
  the publish job. The existing target is [website PR #73](https://github.com/marionettejs/marionettejs.com/pull/73),
  whose auto-merge was disabled at inspection. Recheck that state before merging
  preparation, since the publisher itself does not reject a pre-enabled auto-merge.
- The [deployment workflow](https://github.com/marionettejs/marionettejs.com/blob/18bf823896bb095a3d893c24d70a500a694add1d/.github/workflows/deploy.yml)
  runs only on a push to `main` or a manual workflow dispatch, with a `main` job
  condition. It publishes the full Cloudflare Pages website and documentation MCP,
  verifies them, and refreshes Context7 when documentation changed. Neither the
  sync dispatch nor its branch/PR update triggers that workflow.

The preparation merge therefore needs the release-maintainer approval recorded on PR #626 with
this automatic PR update understood; it does not itself require deployment
approval. A later merge of the website sync PR (or manual website deployment)
requires separate explicit publication approval. Leave its auto-merge disabled.
Re-read website merge requirements before any separately authorized publication.
No website merge or manual dispatch is part of this cutover preparation. Destination documentation
credentials and security settings remain separate action-time approvals.

## Later stable certification

After import and separately approved configuration, prepare exact `5.0.0` source
and certify its tarballs with `release:artifact` and `release:validate`, following
[the release guide](../test/README.md#exact-release-candidates). Record the actual
destination source and all artifact integrities. Existing RC2 evidence and the
accepted gaps remain historical; this cutover does not certify stable bytes.
Publication, release tags, registry/hosted verification and deployment require
separate authorization. Keep development history available and unarchived.

## Live issue tracking after import

Existing development issues preserve the accepted pre-cutover evidence. New
work belongs in the canonical repository. Transferring open development issues,
including #574, is a separate maintainer decision; do not transfer or duplicate
issues under this Git-history cutover approval. If transfers are later approved,
verify GitHub redirects and update live workflow references to the destination
issue numbers. Keep historical evidence links and their original dates intact.
