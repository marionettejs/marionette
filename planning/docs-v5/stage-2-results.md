# Records lesson: revised architecture

Revision 2, 2026-09-28. The maintainer rejected the initial example's Application design. Its passing tests and favorable reviews did not establish that it taught the intended architecture.

Historical evidence below predates automatic incoming-listener cleanup on native destruction. The current example removes its manual list-destroy handler. Earlier verification and Claude records describe their recorded revisions; they do not verify this framework change.

## What changed

- RecordsApplication imports its API module directly; the constructor service option was removed.
- MainApplication owns PageView and the registered Records child. Its onStart attaches the page, wires controls and failure recovery, and starts the child. main.js only starts the root.
- Replaced the custom loadRecords/run/controller machinery with the actual startup lifecycle: loading View in onBeforeStart, a Collection prepared in prepareStart, and ready UI composed from that same collection with setView → showChildView → showView.
- Retry uses restart; Open uses start. Restart rebuilds the feature-owned layout while retaining the page. It is not an in-place list refresh.
- Loading, errors, and ready records are mutually exclusive Views in the content Region. The parent handles failure; the child tracks the displayed ErrorView so its lifecycle releases it. PageView attaches to existing index.html markup without rendering.
- The Application chooses EmptyDetailView or DetailView; each has a single template.
- List destruction releases its intent subscriptions. The Application keeps the prepared Collection for selection lookup and passes it to the layout and list. A successful new start replaces that reference; there is no deletion-only stop hook. Local records need no explicit destruction. The retained Application can start again; final destruction releases owned state.

The revised design was checked against concrete production migration implementations, then against current Marionette source. No private implementation names or dependencies are required by the example.

## Responsibility check

| Owner | Concrete job |
| --- | --- |
| RecordsApplication | Prepare the required records, own observable data and selection, coordinate list/detail, release feature resources. |
| RecordsList and rows | Render supplied records/state and emit selection intent. |
| EmptyDetailView / DetailView | Render the presentation selected by the Application. |
| LoadingView / ErrorView | Display startup state; ErrorView emits Retry intent. |
| MainApplication | Own the page and registered child; connect page controls and recover child startup failures. |
| PageView | Bind existing controls and content Region; forward Retry. |
| main.js | Start MainApplication with the existing page element. |
| Records service | Fetch DTOs with the provided preparation signal. |

The parent has a concrete page/child ownership and failure-handling role; it does not need its own asynchronous preparation. Parent readiness means the page is available, while the child waits for required records. Initial preparation relies on framework cancellation/admission; in-place refresh is a separate future design.

## Verification

**48 browser checks passed** (16 cases in three engines, no retries) before the final showList extraction. After moving list composition and its event-map subscription into showList, the nine affected startup, selection, and cleanup checks passed again across all three engines. Commands and results for that revision are recorded in [the verification manifest](evidence/records-verification.json). Browser checks cover 16 cases across Chromium, Firefox, and WebKit, including pending readiness, Retry, cancellation with an uncooperative service, partial startup failure, selection, repeated starts, disposal, old intent listeners, parent teardown, and preservation of original page markup.

The historical [deliberate-defect checks](evidence/records-counterexamples.json) targeted waiting for preparation and releasing stopped intent listeners. Native destruction now handles listener cleanup, so the manual-cleanup mutation has been removed from the probe. The current probe retains both baseline checks and only the startup mutation. Its negative evidence covers startup readiness, not cleanup-test sensitivity or teaching effectiveness.

The first readiness mutation initially failed in the test's setup, where that test assumed a completed initial load. The test was changed to hold the first real API response and assert startup remains pending. This makes its failure specifically demonstrate premature readiness.

## Review

The earlier Claude approvals are retained as historical records with an `initial-` prefix. They were insufficient: the reviews accepted a design that bypassed the intended initial-readiness pattern and gave a wrapper Application too little scrutiny.

The revised review supplied the maintainer's objections, source, lifecycle contracts, and browser evidence. Its first pass found no blocking failure, but challenged blanket listener removal and unnecessary Model disposal. Those were replaced by targeted cleanup when the list is destroyed and one Collection per activation. Source inspection confirmed inactive stateEvents during onBeforeStart and stop before final destruction. The suggestion to let rows mutate shared selection directly was declined because the Application owns that decision. Repeated-retry and real-fetch cancellation coverage were added. The last review raised a conditional concern that cancelled starts might reject into the error presenter. Current source (`supersedeOperation` in src/modules/application.ts) resolves superseded operations as false. The browser tests assert false for cancelled starts, no obsolete alert after close/reopen, and an empty region after actual fetch cancellation. The proposed extra request-token/AbortError wrapper was therefore not added. Other conditional questions about stop emptying the Region and stopped ErrorView ownership are covered by the lifecycle source and close/retry tests.

The [final parent/static-page review](evidence/static-page-claude-review.json) received the current source, lifecycle excerpts, docs, and 48 passing browser checks. It found no blocking ownership or lifecycle bug. Its concrete suggestions were accepted: clarify that restarting the same parent also needs page markup, and explicitly assert that loading is gone when error recovery displays. Its conditional concern about a future asynchronous stop policy does not justify an extra request mechanism in this example. The maintainer's subsequent event-map simplification and removal of the same-lifetime PageView cleanup callback were verified with the browser suite. The final simplification puts loading, error, and ready UI in one Region and removes the separate clearError operation. That change followed the Claude review and was checked with the browser suite. At that revision the Records list needed a targeted cleanup callback because its listener Application survives feature stop. Automatic native destruction cleanup supersedes that callback. Explicit Collection destruction was also removed: these local records have no independent resources or external owners. The records field remains for selection lookup, while its deletion-only stop hook was removed. Checks assert owned View teardown rather than requiring data-field bookkeeping.

Earlier supporting reviews remain available: [initial redesign review](evidence/redesign-claude-review.json), [follow-up review](evidence/redesign-claude-final.json). A reviewer verdict is supporting evidence, not proof of architectural quality.

## Strengths and limits

- The Application's lifecycle now directly expresses its job; required loading completes before onStart.
- The example has one feature owner and no independent request/run mechanism for initial loading.
- UI composition uses Views and Regions throughout; data access remains an explicit service boundary with @mnjs/data as an incomplete observable layer.
- The page demonstrates attaching a View to existing HTML. Parent stop removes the owned element; reconstructing that parent requires supplying markup again. Child stop/restart retains the page.
- Published-package discovery, in-place refresh, and controlled build/extension effectiveness remain unverified. The previous small reader exercise is superseded, not evidence for this revision.

Next documentation work remains core task-relevant API reference, then packaged installation/discovery, then the controlled comparison. Further example expansion should not precede agreement on this ownership and readiness pattern.
