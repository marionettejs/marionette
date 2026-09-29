# Application contract evidence

Scope: implementation and direct unit specifications at the initial contract audit. This audit predates automatic incoming-listener cleanup on native destruction; its destroy description and source line anchors are historical. No existing documentation, generated documentation, documentation fixtures, or reference application was inspected. Paths below are relative to the repository root; anchors refer to the audited source revision. Tests listed here were inspected, not executed by this worker. Parent coordinates verification.

The tests and probes below establish API behavior only. Their application setup, helper functions, and arrangement of classes are not recommended architecture. Teaching suggestions require a separate assessment of the complete consumer feature.

## Guarantees and application responsibilities

| Decision | Framework evidence | Application responsibility |
| --- | --- | --- |
| Register children for ownership; start them explicitly. | `src/modules/application.ts:745-759` registers without starting. Owner stop traverses children (`:326-339`), destroy destroys them (`:301-305`, `:723-725`). `test/unit/application-child-lifecycle.spec.js:22-78` exercises optional and required startup. | Choose required/optional features, ordering, start options, and whether readiness awaits a child. A required child's `start()` resolving `false` needs a policy; example test at `:143-160` explicitly rejects. |
| Use preparation for asynchronous readiness. | `src/modules/application.ts:538-554` awaits `prepareStart(options, { signal })`, then delivers its result to `onStart(app, options, result)`. `test/unit/application-preparation.spec.js:22-73` proves ordering and that promises from notification hooks are ignored. | Return/await work that must precede activation from preparation. Do not hide awaited dependencies in `onBeforeStart` or `onStart`. |
| Stale lifecycle completion is suppressed; arbitrary work is not canceled automatically. | `src/modules/application.ts:480-481` aborts superseded pending readiness; `:544-545` prevents stale startup activation. `test/unit/application-lifecycle.spec.js:126-164` and `:239-272` exercise invalidation and late completion. | Forward the signal to a cooperating transport and prevent obsolete application-state writes. The framework does not roll back mutations already made by callback code. |
| Stop releases the active UI but retains the application and state. | `src/modules/application.ts:582-595` deactivates, empties the selected root, then notifies stop. `:678-697` restart performs stop/start. `test/unit/application-root-view.spec.js:227-254` checks child stop before root destruction before owner stop. `test/unit/application-state.spec.js:5-40` verifies state retention and ownership. | Keep retained selection/filter/navigation state in an appropriate surviving owner. Choose what is retained and what startup resets. Refresh that must preserve the root should update its state rather than call restart. |
| Distinguish prepared roots, displayed roots, and borrowed hosts. | `src/modules/application.ts:812-861` prepares a root and transfers display ownership to its Region. `:368-375` tears down the selected root without reclaiming unrelated content in a borrowed Region. `test/unit/application-root-view.spec.js:86-145`, `:392-407`; `test/unit/application-prepared-view.spec.js:36-78`. | Let the Application/Region handle the root relationship. Use a child View's Regions to provide child hosts; do not create independent DOM replacement/cleanup paths. |
| State event activation is narrower than general effect lifetime. | Constructor binds configured state events with the running predicate (`src/modules/application.ts:200-205`). `test/unit/application-state-events.spec.js:40-71` checks delivery while active, including pending stop permission; `:116-135` checks no replay of preparation writes. `:318-357` proves generic `listenTo` continues while stopped and is removed by destroy. | Establish initial UI explicitly from current state. Handle active-run subscriptions and effects explicitly when using generic listeners; do not assume `stop()` unsubscribes everything. |

## Proposed teaching decisions requiring application-design review

1. Introduce Application as the owner of a feature's activity, effects, state lifetime, and child Applications. Do not prescribe one Application per View; separation needs a lifecycle or coordination reason.
2. Teach one normal composition path: parent owns children, parent supplies a Region, child owns its feature root. Registration and activation are separate decisions.
3. Separate startup from refresh. Startup preparation may block activation; refreshing a running feature should preserve the required root/state and have a stated latest-result policy.
4. Make lifecycle boundaries visible in the first async example: preparation can be canceled, stop removes the active UI, destroy ends retained ownership. Test leave-during-load with a deterministic deferred request.
5. Use supplied state and explicit child events/options for local collaboration. Explain which owner decides an action; avoid using global Radio as the default sibling coordination example.

## Important limits to keep out of the introductory narrative

- **Readiness signal scope:** completed preparation deletes its readiness controller (`src/modules/application.ts:409-410`, `:547`), while later operations abort only pending readiness (`:480-481`). Therefore a completed-start signal is not an active-run cancellation signal. No direct existing unit test for that precise sequence was found. The parent subsequently verified it against current source with `../probes/readiness-probe.mjs`; see `verification-results.txt`. `test/unit/application-lifecycle.spec.js:75-111` checks only that the completed-start signal is not aborted at completion. The probe also checks the contrasting pending-start cancellation path and asserts that stale startup cannot activate.
- **No implicit startup transaction:** if a required child fails after another child starts, the completed child can remain running until owner stop/destroy; `test/unit/application-child-lifecycle.spec.js:103-121` proves this. State mutations are likewise not rolled back. Do not promise automatic startup rollback.
- **Stop is not destroy:** state and generic listeners persist across stop. Destroy disposes factory-created state through the state adapter, releases configured subscriptions/Radio replies, and calls `stopListening()` (`src/modules/application.ts:738-742`; `src/mixins/state.ts:68-83`). Supplied state is borrowed and is not disposed by this owner (`test/unit/application-state.spec.js:5-22`).
- **Radio requests are dispatch, not network lifetime management:** `packages/radio/src/requests.ts:147-179` invokes the registered handler and returns its result. This does not provide fetch cancellation or latest-response protection.
- Completion-hook exceptions can reject the lifecycle promise after the state transition occurred (`test/unit/application-lifecycle.spec.js:286-295`). Keep the full failure matrix in reference material; do not imply every rejection means inactive.

## Narrow checks

Core facts are covered by these source-backed Vitest specs (aliases in `vitest.config.js:47-76` point to source; no docs build is required):

```sh
npm run test:unit -- test/unit/application-preparation.spec.js test/unit/application-lifecycle.spec.js test/unit/application-child-lifecycle.spec.js test/unit/application-root-view.spec.js test/unit/application-ownership.spec.js test/unit/application-state.spec.js test/unit/application-state-events.spec.js
```

If the initial brief introduces prepared composition or host rebinding, add:

```sh
npm run test:unit -- test/unit/application-prepared-view.spec.js test/unit/application-start-region.spec.js
```

These checks establish library contracts. They cannot establish whether fresh agents discover, understand, or apply the planned documentation.
