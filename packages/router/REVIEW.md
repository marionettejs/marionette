# Cloud router review pass

Baseline: `fd65f60e031b93ea2c1e9544601cdae11f5d6dde`, fetched from the
authorized `codex/router-narrow-grammar` handoff. Work uses the isolated cloud
branch `codex/router-review-cloud`. No application repository or laptop is needed.
Extraction/source-rights limits in [PROVENANCE.md](PROVENANCE.md) still apply.

| Review item | Change | Evidence |
| --- | --- | --- |
| T4 | Restore the full core Application child constraint; normalize the optional initializer overload in RouteApplication constructor types locally. | ESM/CJS ownership preserves feature methods, initializer options and preparation results; fake children fail static and runtime checks. |
| N9 | Cancel by registration identity on unmount/owner destruction; clear removed current without aborting newer unrelated work. | `registration-lifetime.spec.js`: held dispatch, late handler/redirect failures, same-name remount, parent removal/reactivation, unrelated recompilation. |
| N6 | `routeParent` supplies named parent mounting. | Relative feature URL, inherited params, branch entries and merged metadata. |
| T2 | `RouteCatalog` composes existing static feature tables and parent prefixes at the type level. | ESM/CJS nested feature catalog positives and expected-error negatives; runtime availability remains checked. |
| N2 | `RouteApplication.withRouter(router)` supplies explicit constructor defaults for declarative childApps. | Declarative owned tree uses one engine; ESM/CJS constructors accept omitted configured options. |
| N1 | Keep registration through UI stop/start; demonstrate an awaited application-defined `startOnRoute`. | Superseded preparation performs no child switching/rendering; parent and child instances survive child-route changes. |

Validation for this pass: 509 router tests passed; full build including ESM/CJS
declaration consumers passed; repository lint, public-test checks and the router
ESM/CJS package fixture passed. Later commits record initial dispatch and bounded
leave-guard design separately. Final revision and additional verification are
reported with the handoff.

Limits: cancellation cannot undo consumer effects or terminate ignored work;
handlers must honor the signal before effects. Unmount does not rewrite history.
Static catalogs do not prove current registration/permission. Named parents must
precede dependent entries. No splats, automatic `.extend()` route catalog inference,
runtime-family rebasing, History API driver, publication or release certification
is added. Native browser navigation/focus/scroll remains a separate evidence lane.

## P4: initial dispatch outcome

The separate P4 commit adds `getInitialDispatch()` and `InitialDispatchResult`.
The latest activation has one resolving promise for matched/unmatched/cancelled/
failed; redirects share its final Match, and retained restart retains its identity.
It does not redefine Application start or driver running. `initial-dispatch.spec.js`
covers all outcomes, synchronous/asynchronous redirect destinations, ignored work,
setup failure, session replacement and notification-time observation. ESM/CJS
consumers narrow the union; the built package fixture observes initial readiness.

## Unsaved changes: design only

[The bounded leave design](LEAVE-GUARD.md) specifies one application-owned decision
before explicit navigation, a separate cancellable request identity, no early
child teardown, and a concrete test matrix. It records the native Driver's
uncancellable traversal limit and rejects implicit history compensation. No guard
API or implementation is introduced. Chromium download failed with HTTP 403
`Domain forbidden`; native-browser verification remains unavailable here.

## Final cloud checks

Runtime/type revision: `6d2acce04613be7069a0f359768525a5d6ce97b1`, including the
T4 follow-up for configured instance compatibility, state and static context.
The final design commit changes documentation and the private package file list.
Toolchain: Node 24.19.0, npm 11.17.0 (including nested build commands).

| Check | Result |
| --- | --- |
| `npm test` | 2,643 tests passed across 161 files, including 529 router tests. |
| `npm run build` | Passed, including source checks, all package builds and ESM/CJS declaration consumers. |
| `npm run lint` | Passed with zero warnings. |
| `npm run test:router-package` | Built ESM/CJS peer, lifecycle, configured declarative injection and initial dispatch checks passed. |
| `npm run check:public-tests` | Passed. |
| `npm run check:api-contracts` | Passed after reviewing regenerated router emitter/source records; no new release-wide semantic coverage claim. |
| `node --test test/tooling/api-contracts.test.mjs` | 13 tests passed. |
| `npm run test:source`, `npm run test:dist` | Passed. |
| Native browsers | Not run: binaries absent; Chromium installation rejected by the download proxy. |

Production cost: each public mount adds a Router destruction listener and, when
specified, an owner listener. Unmount releases them and checks pending/current
registration identities against the recompiled matcher; this work scales with the
registered routes and pending attempts at retirement. Each navigation tracks a
pending reference and an abort observation until settled/cancelled. The initial
dispatch adds one promise/context per activation, shared through redirect hops.
Static catalog/type repair adds no runtime work. No performance benchmark or
release/browser certification is claimed.

## Installed tarball and focused self-review follow-up

Self-review found one N9 race after `ddb8b5e6`: a pending attempt's abort listener
could remount its parent before reconciliation inspected a completed current
descendant. The descendant's registration then appeared active again and its old
Match survived. A new public held-driver regression failed before the fix.
Reconciliation now snapshots all retired attempts and clears current authority
before invoking any abort callback. Remounted/newer attempts retain their own
authority. All 530 router tests pass after this correction.

Core `addChildApp` still requires the full `ApplicationInstance<object, unknown>`;
its runtime identity checks are unchanged. Type consumers now also mount a broad
runtime table on a known static feature catalog and confirm that known params stay
required and runtime-only names do not silently enter the static union. ESM/CJS
declaration consumers pass. The parent metadata, declarative configuration,
registration retention, same-name cancellation and initial-outcome cases remain
covered; no further contract defect was found in this focused review.

`npm run test:router-tarball -- <archive>` is a repeatable installed-consumer smoke.
Without a path, it packs the current built router. It locally packs core, utils
and Radio, then installs all four archives with `--offline --ignore-scripts` in a
temporary consumer, without symlinks to the checkout. Both ESM and CJS passed:
explicit shared-router injection through declarative children, parent branch/meta,
UI stop/start retention, owner cancellation of ignored pending work, same-name
replacement, fake-child rejection, and matched/unmatched/cancelled/failed initial
outcomes. The installed files include declarations and the private design/provenance
records. This is local package evidence, not registry or browser certification.

Tested router archive:
`/workspace/scratch/router-artifacts/self-review/mnjs-router-0.1.0.tgz`.
SHA-256: `4b913c35f0bcdd2c36958f20728bf7b449e0f17f7a47224e9a3c971deb889d66`.
The archive contains the corrected runtime; later evidence-only text is maintained
in this repository record. Build, lint, public-test checks, type consumers,
API-inventory consistency, source/distribution and the earlier built-package
fixture passed again. The browser restriction was not retried or bypassed.
Leave guards remain a design proposal only.

Corrected runtime/type revision:
`188de5dac0fcdc448f428f8b9144ae9cc4dd146b`. The complete suite passed again:
2,644 tests across 161 files, including 530 router tests. Both the supplied-archive
and default pack-then-install forms of the new tarball smoke passed. The final
follow-up commit adds only the repeatable fixture, its npm command and evidence.
