# Assessment of revised design sketches

## P1

The sketch explicitly chooses Application-owned readiness (`prepareStart`), retained collections/sessions, a root View, separate list/editor Regions, and CollectionView-owned rows. Saves capture the root and session before awaiting; the visible completion predicate requires the same living root and a running Application. This concretely places save authority above editor lifetime. Refresh cancellation is delegated to an omitted helper, with disposal calls shown at teardown boundaries.

Observable delivery is partly concrete: feature status is a Model, adapters are configured, and status changes call `set`. Session observation, editor input/status bindings, event forwarding, draft reconciliation, and identity-preserving filtering remain contracts in prose or helpers. The design supports focus preservation structurally, but does not demonstrate it. Pending-save status handling is named at stop; its implementation and restart reconciliation are unverified.

## P2

The sketch explicitly registers a child Application under the page, returns initial loading from `prepareStart`, and isolates editor replacement from list filtering. Retained drafts belong to the Application; stopping increments a run counter. These establish the intended feature/page and state/presentation boundaries.

However, both post-start request paths are entirely delegated to `guardedRefresh` and `guardedSave`. Their described run checks, save serialization, overlap protection, and reconciliation are requirements, not visible implementations. `ensureDraft` is promised to return an observable source, but the Map alone supplies no notification mechanism; compatible StateApi setup and scoped editor subscriptions are omitted. List replacement during refresh can preserve the separate editor, although replacement wiring, filter retention, and actual focus behavior are unverified. Interrupted-save status handling is explicit in intent and called at stop, with details hidden.

## P3

The sketch chooses child Application composition and initial preparation, with a retained store and separate presentation Regions. It exposes both save and refresh orchestration: operations capture a run object, refreshes capture a sequence, and completion checks precede store mutation. Stop invalidates the captured run before teardown. This is concrete evidence of surviving request ownership and obsolete-result exclusion under the stated lifecycle assumptions.

The store's observable implementation is unspecified. Passing a draft as an editor model establishes a borrowing boundary, but does not demonstrate input propagation or targeted status updates. Revision-aware reconciliation, duplicate-save rejection, refresh/save overlap protection, initial restart reconciliation, and filter reapplication are delegated to store methods or prose. Framework ownership is visible; full state delivery and correctness are not.

## P4

Application preparation, retained collections/drafts, independent Regions, and terminal source destruction are explicit. Initial loading failure is deliberately converted into an activation result for retry presentation. Saves visibly capture run identity and check it before reconciliation; root destruction and stop invoke invalidation. Refresh disposal is wired, while the helper itself is omitted.

Draft Models and editor `modelEvents` are specified, but notification bindings and revision handling are not shown. Collection-based list updates provide a plausible focus-preserving boundary. The text identifies pending-save reconciliation on later activation as necessary, yet no visible call performs it; that remains an implementation obligation, not a proved restart failure.

## Overall confidence

High confidence that all four sketches choose feature-owned readiness, requests/state surviving editor replacement, bounded presentation ownership, and page-owned navigation. Evidence differs in how much request guarding and observable wiring is exposed. None establishes implementation correctness, actual focus retention, complete event delivery, or concurrency behavior. The 35-line limit makes omissions expected; helpers and prose identify commitments, not executed proof. These revised sketches alone cannot establish documentation causality or comparative effectiveness.
