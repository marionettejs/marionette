# Bounded unsaved-change leave design

Design proposal only. This pass implements registration cancellation and initial
dispatch results, but adds no guard option, global registry or history workaround.

## Decision and boundary

Start with one application-owned asynchronous leave decision around explicit
navigation commands. Keep Router's synchronous `navigate()` result contract and
ordinary Application lifecycle. The outgoing feature owns dirty state, saving,
confirmation UI and its lifetime. The shell owns the pending navigation request.
Keep one shared Router and the feature's named handler route hash.

Proposed application operation (not a package export):

```ts
type LeaveDecision = (context: {
  from: ActiveMatch | null;
  target: { name: string; params?: Params } | { back: true };
  signal: AbortSignal;
}) => boolean | Promise<boolean>;
```

One active outgoing feature supplies the decision; no ordered guard chain,
ancestor discovery, route-definition guard fields or per-child hooks. `true`
allows the original request; `false` keeps the active UI and history unchanged.
Save/discard/stay belong to the application's dialog. Only return `true` after
any required save succeeds. A failed save/decision rejects the application
operation without dispatching a route, rather than emitting `route:error` for a
navigation that never started. Applications can distinguish failure from stay.

The shell captures the target params/query/history/state/info once, creates a
request controller, and awaits the decision **before** calling `router.navigate`
or `router.back`. Approval rechecks request identity, outgoing feature identity,
and cancellation before issuing that exact captured operation. Do not resolve
the request later from mutable form state or the latest target variable.

A newer request, outgoing-feature destruction/unregistration, shell stop/destroy,
or a route change through another source cancels the pending decision. Cancel its
dialog/save signal and discard late approval/rejection. Keep the currently active
route signal alive while the dialog is open: a denied request must leave the
current UI usable. The decision request therefore needs its own signal, distinct
from the outgoing Match's signal. Replacing a feature with the same name creates
a different identity and cannot inherit an earlier approval. Do not stop/switch
children before approval. Once navigation is issued, ordinary route signals,
awaited activation and the switcher's selection rules own cancellation.

## Browser and history implications

| Source | Proposed guarantee | Limit |
| --- | --- | --- |
| App command to a named route | Decide before Driver navigation; denial creates no entry and does not abort current route work. | Every relevant app command must use the shell operation. |
| App Back button calling `router.back()` | Decide before requesting traversal; denial leaves the index unchanged. | Browser Back is a different input path. Recheck `canGoBack()` after approval. |
| App-owned anchor | A View can prevent its ordinary unmodified local click, then use the operation. | Preserve modifier/new-tab/download/external-link behavior. Native interception alone does not provide this gate. |
| Browser Back/Forward or native traversal | No universal asynchronous stay-on-current-entry promise. | Native Driver declares `cancelTraverse: false`; memory Driver's `true` is not browser evidence. |
| Reload, external/document navigation, closing tab | Optional application-owned `beforeunload` policy while dirty. | Host-owned prompt and delivery restrictions; do not promise custom text, async save or guaranteed delivery. |

The current Driver exposes synchronous `preventDefault()` only during a cancelable
navigate event. Its `intercept({ handler })` runs route work after the destination
entry commits. Returning false from a handler, throwing, or aborting owned route
work does not restore the prior URL, entry index, state, focus or scroll. Unmount
cancellation likewise retires route authority without rewriting browser history.

Do not compensate for denied traversal with `back`, `forward`, `traverseTo`, a
replacement URL or a sentinel entry: those create a second observable navigation,
can change history/state and introduce loops and races. A stronger uniform browser
guarantee would require a separately reviewed Driver precommit capability and
native-browser evidence. Do not infer it from the memory implementation or change
`cancelTraverse` as part of this pass. Dirty state must not be cleared merely
because history moved; draft retention/recovery remains application policy.

## Focused implementation test plan

These are proposed future guard tests, not claims of implemented guard behavior.

| Scenario | Observable assertion |
| --- | --- |
| Clean, approve, stay | Exactly one Driver command for clean/approve; no command, history/state mutation, route event or child stop for stay. |
| Save before leave; save/decision failure | Await save before navigation; failure keeps current UI/dirty state and reports once to the caller. |
| A then B while A's dialog/save is pending | Abort A's request; only B can issue navigation, even if A later approves or rejects. |
| Destroy/unmount/remount the outgoing feature with the same name | Discard old approval by identity; no effects on the new registration. |
| Shell stop/destroy, or external route change during a dialog | Cancel promptly, close owned UI, suppress late effects and release listeners. |
| App Back stay/approve | Stay preserves entry key/index/state; approve traverses once, with no replacement entry. |
| Redirect and rapid approved requests | Keep one original approval per command; Router's redirect chain and route signal settle the operation; no stale rendering. |
| Memory cancelable traversal | Verify only the declared memory capability, independently of native behavior. |
| Real browser Back/Forward/reload/close | Record event cancelability, entry key/index/state, committed versus finished, URL/UI agreement, focus/scroll and prompt limits. Unsupported blocking must remain explicit. |

Run native cases on each supported browser before promising stay-on-entry behavior.
In this cloud environment the Chromium download was rejected with HTTP 403
`Domain forbidden`; no new native-browser result is claimed. Existing router
regressions cover cancellation and stale-work suppression, not unsaved-change
protection. A full framework guard system remains outside this design.
