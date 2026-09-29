# Retained refresh guide audit

## Scope and architecture

`docs/guides/retained-refresh.md` is an independent dashboard guide. Initial data
readiness belongs to `prepareStart`; the Application owns later summary requests
and updates owned observable state. SummaryView borrows that source. PageView and
the working-notes editor retain their identity across refresh. The guide states
the endpoint response shape and uses a direct transport function; the optional
data package supplies observability, without assuming a persistence API.

Source checks: `src/modules/application.ts` keeps an ordinary pending stop active,
empties root UI before the stop notification, and deactivates at the beginning of
destruction. `docs/api/application.md` and `docs/api/shared/state.md` describe
restart/root replacement and owned versus borrowed state consistently with the
example. Refresh cancellation happens in `onStop`; the operation also checks
activity, controller identity, and the controller's aborted signal before commit.

## Executed evidence

`test/docs/retained-refresh-checks.mjs` supplies preparations and assertions for
the guide's actual `guides-retained-refresh-1` fence. A controlled fetch resolves
initial readiness, then deliberately ignores abort for later requests. The fence
passed using this checkout's built public package exports and JSDOM:

```sh
node --import ./test/tmp/retained-refresh/bootstrap.mjs test/tmp/retained-refresh/check.mjs
npx eslint test/docs/retained-refresh-checks.mjs
git diff --check
```

The temporary check was extracted from the Markdown fence and combined with the
maintained preparation/assertion strings. Shared runner integration is handled
in `test/docs/reference-examples.mjs`.

Observed outcomes:

- The DOM button starts refresh; loading, success, and failure retain the same
  PageView, SummaryView, NotesView, textarea, and unfinished textarea value.
- Latest success wins despite an older response arriving afterward. An obsolete
  rejection leaves the newer operation's loading/error state alone.
- Current HTTP failure preserves the last data and displays its error.
- Rejected ordinary stop preparation leaves the live request authoritative.
- Successful stop aborts the request and destroys the root. A late completion
  after another start cannot overwrite that new run; owned state is retained.
- Actual restart replaces the root and preserves Application state identity.
- Pending destruction deactivates before stop readiness completes. A response
  during that interval is discarded; completed destruction disposes owned state.
- Failed initial readiness rejects activation before a root is created. Refresh
  while stopped starts no request.

Three temporary mutations were each rejected by outcome assertions: removing
request authority checks, removing stop cancellation, and allowing commits while
destruction is pending. These mutations were not applied to tracked files.

## Strengths and limits

The example demonstrates retained UI with normal framework ownership and one
feature-specific async operation. Tests observe outcomes from the published code
rather than a second implementation, including an abort-ignoring transport.

This is a latest-request policy, not a universal refresh policy. Notes are local
unfinished input, not saved drafts. Initial activation failure is delegated to
the caller's error boundary. JSDOM checks prove element/value retention, not real
browser focus, network cancellation, heap reachability, or teaching effectiveness.
Fresh-context transfer still requires an independent learner evaluation.
