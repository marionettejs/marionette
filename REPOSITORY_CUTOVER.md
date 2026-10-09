# Repository cutover checklist

This checklist prepares the approved repository transition. It does not authorize
publication, deployments, security changes, archival, branch deletion or RC3.
The preparation PR must remain unmerged until the coordinating parent receives
approval. Complete that gate before renaming either repository, so historical
links and this checklist are present in the accepted v5 source.

## Identity and acceptance

Read-only preflight on 2026-10-09 UTC confirmed:

| Role | Repository before cutover | Immutable repository ID | `master` |
| --- | --- | --- | --- |
| v5 development history | `marionettejs/marionette` | `306411262` | `5170d87568e050cb4ad0bd08b5ba48d3ee6d605c` (PR #625) |
| Canonical destination / v4 history | `marionettejs/backbone.marionette` | `2965621` | `a8ca523cfd1ffb8dc4a2095c34d590aa7701110a` |

The source manifests are `5.0.0-rc.2`. Paul accepted the bounded evidence in
[issue #574, comment 6083583403](https://github.com/marionettejs/marionette-develop/issues/574#issuecomment-6083583403).
Retain the dates, package revisions, integrities, applicability limits and gaps;
acceptance does not assert continuous seven-day coverage or turn local artifacts
into public evidence. The independent agent study remains deferred. Final exact
`5.0.0` artifact certification happens later in the destination. No RC3 is planned.

## Preparation and preservation gates

- [ ] Obtain parent approval to merge the preparation PR; satisfy all current
  checks and review requirements without bypass. Its prospective development
  links become live when the first rename completes.
- [ ] Re-read both repository IDs, heads, open PRs and competing local work before
  acting. Claude's inspected cutover conversation proposed a plan but reported no
  changes; neither repository had an open PR at preflight. Preserve dirty local
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

Numbered v5 issue/PR links and pinned v5 source references resolve through
`marionette-develop`. Generic issue tracker/new-issue links, current-source links,
package repository identity and publication guards remain
`marionettejs/marionette`. Existing legacy numbered links follow the legacy
repository's rename. The legacy changelog is pinned to the original v4 commit,
so it cannot accidentally display the replacement v5 master.

Old commit messages are immutable: bare `#N` in pre-cutover v5 commits refers to
the development repository, even if GitHub auto-links it to a legacy issue in the
new canonical repository. Do not rewrite commit subjects or hashes to fix this.

The ten `evidence/performance-budget-amendments/BA*/prototype-contract.json`
artifacts retain their exact bytes and old issue #127 URL. The explicit
[relocation map](evidence/repository-relocation.json) identifies each artifact,
its SHA-256 and its relocated historical issue. This is a location map, not a new
benchmark run, changed budget or renewed certification.

## Settings inventory: separate action-time approval

No settings are changed by this preparation. Re-read live values before proposing
an exact mutation; credentials must never appear in evidence or review output.

| Area | Observed source / destination | Required follow-up |
| --- | --- | --- |
| Actions allowlist | Source selects GitHub-owned actions, disables verified third-party actions, and has an existing explicit pattern list; destination allows all | Propose exact destination restrictions for approval; do not loosen source guards for testing |
| Master protection | Source ruleset requires six checks and resolved review threads; destination classic protection requires one approval, with no named checks | Retain existing destination approval rule; propose additional v5 check requirements separately, never bypass protection |
| Required v5 checks | `Node 24`, `Package smoke (macOS arm64)`, `Package smoke (Windows x64)`, `Bundle size`, `Build and validate`, `Analyze (javascript-typescript)` | Verify those checks actually run in destination before configuring an approved requirement |
| `stable-release` | Source requires reviewer `paulfalgout`; self-review prevention is false, admin bypass is true, custom branch policy is `master`; destination has no environments | Propose environment creation and exact reviewer/branch policy for approval before release use; do not implicitly copy bypass settings |
| Secrets | Source lists `WEBSITE_DOCS_DISPATCH_TOKEN`; destination lists `COVERALLS_REPO_TOKEN` | Obtain separate approval for any destination credential setup; do not copy values or delete legacy credentials |
| Documentation | Neither repository lists Actions variables; both Pages API reads returned 404 | `DOCS_PAGES_ENABLED` is unset. Do not enable Pages or dispatch a website sync; investigate 404 before claiming a Pages configuration |
| npm trusted publishing | Not inspected through authenticated npm settings | Verify all five packages' repository/workflow/environment bindings after the swap; obtain separate approval for any changes, do not assume identity follows a renamed repository |

The source's inherited organization ruleset `21709790` currently has an empty
rules list; its repository ruleset is `21649624`. Destination currently lists no
rulesets. Repository IDs, existing environments and settings stay with the
repository being renamed; they are not transferred by importing Git history.

The preparation PR changes paths that trigger `docs-sync.yml` when merged to the
source master. That workflow dispatches `library-docs-changed` to the website
using `WEBSITE_DOCS_DISPATCH_TOKEN`. The parent merge decision must account for
this external side effect under the separate no-deployment boundary. Do not merge
or dispatch it as a side effect of preparing this PR. Destination documentation
and security configuration are separate approvals; the import PR can remain open
until those boundaries and its required review are satisfied.

## Later stable certification

After import and separately approved configuration, prepare exact `5.0.0` source
and certify its tarballs with `release:artifact` and `release:validate`, following
[the release guide](test/README.md#exact-release-candidates). Record the actual
destination source and all artifact integrities. Existing RC2 evidence and the
accepted gaps remain historical; this cutover does not certify stable bytes.
Publication, release tags, registry/hosted verification and deployment require
separate authorization. Keep development history available and unarchived.
