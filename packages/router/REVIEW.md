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
