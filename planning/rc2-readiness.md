# RC2 preparation and stable v5 acceptance

Started 2026-10-01. This checklist implements the
[candidate and stabilization policy](../ROADMAP.md#release-candidate-entry-and-stabilization).
It records preparation; it does not authorize publication or claim stable readiness.

## RC2

- [x] Align core, utils, Radio, data, adapters and plugin versions to `5.0.0-rc.2`.
- [x] Verify rebuilt documentation delivery and executable consumer recipes.
  [Current checks](docs-v5/efficiency-results.md#routing-and-coverage-follow-up).
- [x] Preserve the [bounded reader pilot](docs-v5/reader-comparison-v3-results.md)
  and its failures/limits. Consistent efficiency remains unestablished.
- [x] Disposition the limited build and ownership concern without tuning docs to
  private tasks. Stop preparation only for an established critical supported-workflow
  defect or general documentation blocker.
  [Independent closeout](docs-v5/reader-comparison-rc2-closeout.md) found no such blocker. The limited build included retrieval,
  consumer wiring and test-editing churn; all final behavioral checks passed, but
  its explanation was missing. The ownership concern remains a moderate
  maintainability concern without a demonstrated workflow failure.
- [x] Commit the complete docs/tooling work and reconcile the cleanup overlap with
  master once. Retain [terminal cleanup contracts](docs-v5/evidence/runtime-integration-scope.md).
- [x] Prepare the exact prerelease policy and release notes; stable publication stays disabled.
- [ ] Build clean, immutable five-package artifacts. Run `release:validate`, then
  `release:verify --require-validation`. Record exact source, artifacts and results.
  Complete the canonical Linux and macOS/Windows host checks in the release workflow.
- [ ] Import the exact clean docs artifact into the website integration branch.
- [ ] Verify website rendering, links, search, MCP transport/provenance and actual
  installed client use. Prepare the coordinated runtime/vendor/workshop upgrade.
  The published rc.1 consumer remains active until rc.2 exists on npm; this is
  deployment ordering, not a permanent alternate runtime path.
- [ ] Obtain explicit approval for exact RC2 publication and website deployment.
- [ ] Publish certified artifacts; verify registry integrity/provenance. Complete
  matching runtime pins and vendor bundles from that registry artifact, set verified
  publication metadata, deploy through the normal website workflow, and verify live surfaces.

## Stable v5 work after RC2

These remain separate from the docs comparison and RC artifact certification.

- [ ] Select a substantial public workflow and representative migration boundaries.
  Record baseline behavior and classify framework defects versus consumer debt.
  Anonymous public reproductions must support findings originating in private apps.
- [ ] Install the published RC2 in selected consumer workflows; record exact app
  revisions, lockfile integrities and the stabilization start. Do not start the
  clock from publication alone.
- [ ] Complete seven consecutive days of recorded workflow checks: startup/error UI,
  navigation/load/save races, supported rejected-stop preservation, restart/teardown,
  collection updates, drafts/focus/selection and overlay cleanup. Record failures
  and interventions. Contract changes require a new RC and restart the period.
- [ ] Freeze a separate release usability policy covering feature addition,
  successive changes, lifecycle repair and fresh-agent handoff. Declare task coverage,
  acceptance, artifacts, model/tools, repetitions, assistance rules, spend/time and
  analysis before collecting results. Obtain the exact execution authorization.
  Existing doc pilots inform this policy but are not scored release attempts.
- [ ] Qualify public task controls and run the authorized evaluation; publish complete
  outcomes, limitations and the maintainer's decision. Reliability and maintenance
  success are the acceptance objective; comparative superiority is not required.
- [ ] Review matched bundle/runtime timing, retention and identity/focus preservation.
  Investigate meaningful regressions and verify fixes on the final candidate.
- [ ] Close or explicitly disposition supported critical defects and consumer gaps.
- [ ] Certify the distinct clean `5.0.0` commit and all five final artifacts, then
  obtain separate stable publication approval. RC certificates cannot certify new bytes.

## Evidence records

For each consumer stabilization entry, record: date, app revision, installed version
and integrity, exercised workflows, unit/browser/live-service/retention evidence,
defects and severity, intervention, and result. A missed or failing workflow remains
visible. Record an explicit evidence-refresh decision for fixes without contract changes.

For certification, record the source commit, release directory, immutable package
hashes, all required check statuses, host/browser identities and any limitation.
Local checks do not establish remote CI, registry or deployed state.
