# Proposal: release incoming event subscriptions when destruction completes

Status: implemented in PR #594; revised on 2026-09-28 to preserve the existing abort-on-error destruction contract.

## Recommendation

Include this in v5 before the stable release, provided lifecycle ordering and listener bookkeeping pass the checks below. It closes a concrete retention gap and gives native objects a consistent destruction contract. The runtime change should be small; lifecycle verification is the substantive work.

Priority: medium-high before v5. This is worth a bounded release task, but it is not evidence of a widespread production leak or a reason for an open-ended release delay. No consumer incidence or retained-memory benchmark has been measured for this proposal.

## Problem

Today, core destruction calls `stopListening()`: the dying object releases subscriptions it made to other objects. It generally does not call `off()`: subscriptions other objects made to it remain registered.

```js
owner.listenTo(child, 'change', owner.onChildChange);
child.destroy();
```

If `owner` survives, its listening registry can retain `child` until the owner explicitly stops listening. Destroying the child and dropping the application's direct reference are insufficient to release that event-system reference.

Native `@mnjs/data` Model and Collection already call both `stopListening()` and `off()` during destruction. Core Object, View/CollectionView, Region, Application, and Behavior do not consistently provide the same incoming cleanup.

## Proposed contract

**As the final event cleanup step of terminal destruction, a native object removes all handlers registered on itself and releases native listeners' references to those subscriptions.**

- Deliver the existing final lifecycle notifications before clearing handlers, including `destroy`, its `all` observers, and host-delivered Behavior notifications.
- Complete cleanup synchronously before synchronous destruction returns, or before Application destruction successfully resolves.
- Remove all current registrations: `on`, `once`, `listenTo`, and `listenToOnce`, including registrations added during final destruction callbacks. Self-listeners are removed as well as outside listeners.
- Preserve subscriptions that surviving listeners hold to other sources.
- Keep repeated destruction idempotent and preserve existing return values and lifecycle payloads.
- Apply this to terminal destruction only. Application stop/restart and view detachment keep their existing contracts.

Calling `trigger('destroy')` manually does not perform destruction. A Collection forwarding a model's `destroy` event must retain its own subscriptions. Cleanup belongs in lifecycle completion, not in generic event dispatch or registration.

The guarantee concerns registrations present at completion. This proposal does not add guards against registering new handlers afterward, disable `triggerMethod` method calls, or cancel callbacks already captured by an enclosing event dispatch. Those would be separate behavior changes.

## Implementation direction

Use the existing no-argument `off()` after outgoing cleanup and final notification delivery. Native Events already records incoming listening relationships and removes their entries from the listeners' registries when `off()` runs. No public API, per-subscription destroy hook, deferred callback, or new event-name convention is needed.

| Area | Work |
| --- | --- |
| Object destroy mixin | Finish with incoming cleanup after final notification and outgoing cleanup. |
| View and CollectionView | Clean up after host and Behavior lifecycle delivery. CollectionView inherits the View destruction path. |
| Region | Finish cleanup after existing ownership release and final notification. |
| Application | Clean up in terminal completion before successful promise resolution; retain existing cancellation and failure behavior before destruction commits. |
| Behavior | Handle direct destruction and host-managed teardown at their actual completion boundaries. |
| Native Model and Collection | Retain existing incoming cleanup without runtime changes; verify the shared successful-cleanup contract. |

### Behavior ordering requires explicit handling

The host currently invokes `Behavior.destroy()` before later delivering its `destroy` notification through `behavior.triggerMethod(...)`. Adding `off()` directly to that early call would erase registered Behavior lifecycle handlers prematurely.

For direct Behavior destruction, finish incoming cleanup when that call completes, preserving its current lack of an independent destroy notification. For host-managed teardown, retain handlers through the existing notification sequence and let the host finalize incoming cleanup afterward. Distinguish these paths explicitly in internal orchestration; do not defer cleanup to a timer or infer completion solely from an early `_isDestroyed` flag.

### Error handling

Preserve the existing abort-on-error contract. Incoming cleanup is the last
step of successful destruction. A throwing lifecycle or cleanup callback aborts
the operation and can skip subsequent cleanup; do not add `try`/`finally`,
recovery bookkeeping, or a new guarantee for partially destroyed objects.

Application preparation, cancellation, and rejection retain their existing
semantics. Native Model and Collection need no runtime changes because they
already call `off()` after successful final notification delivery.

## Strengths

- **Removes a real retention path.** A long-lived owner can listen to short-lived native objects without separately releasing each destroyed source from its event registry.
- **Simplifies lifetime reasoning.** Either endpoint's destruction releases the event relationship. Consumers have less need to choose `on` versus `listenTo` based on which object outlives the other.
- **Aligns native types.** Core objects adopt the incoming cleanup already present in native Model and Collection.
- **Uses existing machinery.** No extra destroy listener per relationship, deferred work, or normal-dispatch branch is required.
- **Makes terminal destruction clearer.** Preexisting callbacks cannot receive later, newly dispatched events from a retained destroyed object.

## Weaknesses and compatibility risks

- **Observable behavior changes.** Consumers that deliberately emit events after base destruction will lose their preexisting listeners. Such notification must move into the destruction lifecycle or to a surviving owner. Do not add an opt-out unless an active contract establishes a concrete need.
- **Behavior cleanup has two phases.** Preserving its existing lifecycle requires more than appending one line to every method.
- **Failed destruction remains incomplete.** A throwing notification can skip incoming cleanup, just as it can skip existing teardown. This proposal assumes working lifecycle and cleanup callbacks.
- **This is not complete memory disposal.** Owner fields, collections, timers, closures, DOM integrations, and retained Behavior/view references still require their own ownership cleanup. Garbage collection timing remains outside the contract.
- **Interop has limits.** Clearing native handlers does not guarantee removal of private bookkeeping maintained by a foreign listener, such as Backbone's own `listenTo`. Native bidirectional bookkeeping is the guarantee; do not claim universal emitter compatibility.
- **Subclasses can bypass cleanup.** Overrides that skip base destruction remain responsible for their own lifecycle. Preventing later re-registration is outside this proposal.

## Verification required before release

Add focused tests demonstrating both event behavior and released registry references; absence of callbacks alone does not prove reference cleanup.

1. For each native destruction path, several surviving listeners lose the destroyed source while keeping unrelated subscriptions. Verify `listenToOnce`, direct `on`/`once`, and self-listening too.
2. Final `destroy` and `all` observers run before cleanup. Registrations added during final callbacks are cleared. Repeated and reentrant destruction remain safe.
3. Direct and host-managed Behavior destruction preserve current notification counts, order, and payloads, then release incoming subscriptions. Cover nested Behaviors; preserve the existing lifecycle failure boundary.
4. Application preparation failure/cancellation retains subscriptions when destruction has not committed; successful destruction cleans up before its promise resolves. Final notification failures continue to abort the operation without guaranteed remaining cleanup.
5. Destroying a member Model leaves Collection listeners intact. Application stop/restart and Region/CollectionView detach still retain their existing reusable behavior.
6. Preserve existing in-progress dispatch semantics and document/test the foreign-listener boundary.

Run the affected lifecycle and Events suites first, then the full unit suite and type checks. Update lifecycle documentation, migration notes, and any generated contracts affected by that wording; run the repository's corresponding checks. Exercise a reachable consumer flow that repeatedly creates and destroys listened-to children while its owner survives. Assert bounded registry entries rather than relying on nondeterministic GC timing.

No runtime checks were run for this proposal; these are implementation acceptance criteria.

## Value before v5 and estimated effort

This is a good major-release change: small API surface, useful lifecycle consistency, and an observable compatibility change that is easier to announce now. Shipping v5 with the old contract would make a later change more disruptive for consumers relying on post-destroy events.

Estimate **one focused engineering day**, with a second day if Behavior ordering, consumer verification, or integration tests expose additional contracts. This includes implementation, focused/full unit verification, type checks, and documentation. It excludes unrelated release failures.

Land it before v5 if the acceptance cases pass without a broader Behavior redesign. If an active consumer demonstrably requires post-destroy notifications, resolve that contract explicitly before merging. Do not silently maintain two cleanup behaviors or strip existing detach/ownership cleanup merely because some destruction-specific unbinding becomes redundant.

## Historical context and source evidence

The omission was intentional. In the 2014 [Object proposal](https://github.com/marionettejs/backbone.marionette/pull/1323#issuecomment-43710041), maintainers chose to stop calling `off()`, referring to the [self-reference/garbage-collection discussion](https://github.com/marionettejs/backbone.marionette/issues/1219). The [Controller discussion](https://github.com/marionettejs/backbone.marionette/issues/1446#issuecomment-45559159) described self-listening and listening to others as separate responsibilities.

That decision predates the February 2015 [Backbone fix](https://github.com/jashkenas/backbone/pull/3455) that made emitter-side `off()` release listener bookkeeping. [Backbone #4187](https://github.com/jashkenas/backbone/issues/4187) later reported the surviving-controller/removed-view case. This history supports revisiting the choice; it does not establish the original maintainers' intent for today's v5 lifecycle.

Current implementation anchors:

- `packages/utils/src/events.ts`: `cleanupListener`, `off`, and the incoming/outgoing registries.
- `src/mixins/destroy.ts`, `src/mixins/view.ts`, `src/modules/region.ts`, `src/modules/application.ts`: core destruction completion.
- `src/modules/behavior.ts`, `src/mixins/behaviors.ts`: early Behavior teardown and later host-driven lifecycle delivery.
- `packages/data/src/model.ts`, `packages/data/src/collection.ts`: existing terminal `off()` calls and Collection forwarding of model events.
