# Stage 1: View, Region, CollectionView, and state contracts

Evidence read directly from implementation and unit specifications on 2026-09-28. No tests were executed for this note. Paths below are relative to the repository root. Current documentation, generated documentation, documentation fixtures, and repository history were not consulted. Implementation files contain incidental inline comments; the citations below establish executable behavior only. Test scaffolding and helpers are not recommended application architecture.

## API constraints and proposed teaching choices

| Topic | Proposed teaching choice and relevant API constraint | Evidence for the API constraint only |
| --- | --- | --- |
| State ownership | Create shared state once at the owner whose lifetime matches the feature; supply that same source to readers. State created through `createState` is owned; supplied `state` is borrowed. | `src/mixins/state.ts:25-38,52-89`; `test/unit/state-owner.spec.js:50-57,94-142` |
| Plain versus observable state | Plain state is a valid simple default, but mutations do not create notifications. Configure a supported StateApi before teaching `stateEvents`. Name the selected adapter in the scaffold. | `src/runtime/state-api.ts:23-30`; `test/unit/runtime/state-api.spec.js:7-10`; `test/unit/state-owner.spec.js:192-198` |
| Rendering supplied state | Be explicit about what enters the template: default serialization reads `model` or `collection`, not `getState()`. Use `templateContext` or an intentional `serializeData` override when rendering state. | `src/mixins/template-render.ts:31-36,51-72` |
| Managed composition | Let a Region show and replace a child View. A View can have only one managed owner. | `src/modules/region.ts:142-182`; `src/modules/collection-view.ts:666-675`; `test/unit/collection-view/collection-view-children.spec.js:506-531` |
| Replacement | Showing a different View destroys the outgoing View, its managed children, behavior resources, framework subscriptions, and any owned state disposal configured by its adapter. | `src/modules/region.ts:165-176,364-408`; `src/mixins/view.ts:191-217`; `src/modules/view.ts:551-554`; `test/unit/region-lifecycle.spec.js:218-248` |
| Retained content | Keep a screen's layout mounted while updating its appropriate children or observed data. Rerendering the layout resets its Regions and destroys their children. | `src/modules/view.ts:527-546`; `test/unit/view.child-views.spec.js:420-461` |
| Lists | Use CollectionView to own row instances and their teardown; use its source adapter's supported update mechanism for updates that should preserve unaffected rows. | `src/modules/collection-view.ts:519-566,613-619,1230-1252`; `test/unit/collection-view/collection-view-reconciliation.spec.js:57-105` |
| Intent events | Explicitly map child events with `childViewEvents` / `childViewTriggers`, or have an owner `listenTo` a View. Automatic prefixed child forwarding is off by default. | `src/mixins/view.ts:244-280`; `test/unit/mixins/view.spec.js:473-543` |

Recommendations in this table still require review in a complete consumer feature. The cited tests do not establish that the recommendation is the best architecture.

## Contract distinctions relevant to the teaching slice

### Borrowed state survives a consumer

`getState()` creates state lazily and caches it; a class with no override creates `{}`. Destroying an owner removes its state subscriptions and calls `State.disposeOwned` only for state it created. Supplying shared state to a View does not transfer disposal responsibility to that View. View state survives its own rerender (`test/unit/state-owner.spec.js:200-212`), but that says nothing about retained DOM or child View identity.

The StateApi owns event names and callback arguments (`test/unit/state-owner.spec.js:172-190`). Do not promise generic Backbone-style `change:*` events for every state source.

### Detachment is a live object, not completed teardown

`Region.detachView()` removes the View from the Region, releases ownership, and removes the parent View's subscriptions to it; it does not invoke View destruction (`src/modules/region.ts:377-408,426-455`). The retained View remains responsible for its subscriptions and resources until explicitly destroyed or adopted and later destroyed by another owner. Use detachment only when retained View identity is a product requirement. Retaining shared state while replacing the View is usually simpler.

CollectionView's filtering also detaches elements while retaining ownership. This differs from explicit `detachChildView`, which releases ownership (`test/unit/collection-view/collection-view-children.spec.js:506-543,678-687`). This distinction can stay in reference material unless the example actually needs filtering or transfer.

### Full render is not list reconciliation

CollectionView `render()` destroys current rows before rebuilding (`src/modules/collection-view.ts:684-693`). Adapter update notifications preserve unaffected rows; reorder preserves row elements (`test/unit/collection-view/collection-view-reconciliation.spec.js:57-105`). An immutable same-key replacement creates a new row View and loses the old row's DOM identity (`test/unit/collection-view/collection-view-reconciliation.spec.js:142-219`). The default DataApi supports static arrays without observing their mutations (`src/runtime/data-api.ts:87-97`).

Therefore, a first example claiming retained inputs/focus must select an actual collection update contract and test the affected row identity. It must not imply that passing an array provides reactive reconciliation or that every keyed replacement preserves a View.

## Automatic cleanup versus explicit responsibility

Automatic on View destruction: DOM event undelegation, managed child destruction, collection observer cleanup, entity event cleanup, Behavior destruction, StateApi subscription cleanup, adapter disposal of owned state, and `listenTo` cleanup (`src/mixins/view.ts:191-217`). Region and CollectionView remove their child ownership and event forwarding when releasing a child (`src/modules/region.ts:377-408`; `src/modules/collection-view.ts:1213-1217`).

Explicit: resources created outside these facilities, such as native listeners, timers, observers, requests, and third-party widgets, need owner-managed cancellation/disposal. View destruction has no general operation that discovers such resources. `test/unit/view-ownership.spec.js:17-39` demonstrates explicit cleanup of an external renderer on both rerender and destruction. Prefer a single clear owner and lifecycle cleanup over adding generic helper abstractions to teaching code.

## Legitimate smaller alternatives

- A single View with a plain model and explicit rerender is sufficient for a static or small local display where preserving child instances or DOM state is unnecessary.
- A View with Regions can own purely visual composition and translate child intent. Do not require another application layer solely because there are multiple visual components.
- A plain object or explicit method argument is sufficient for state that needs no observers. Use a StateApi when subscription behavior is required, not to decorate every value.
- A static array can drive a CollectionView when full replacement is acceptable. Introduce an observable data source only when the task requires its update behavior.

These are architectural choices to validate through task requirements, not rules implied by class names.

## Narrow existing specifications for parent-run verification

Primary set:

- `test/unit/state-owner.spec.js`
- `test/unit/runtime/state-api.spec.js`
- `test/unit/region-lifecycle.spec.js`
- `test/unit/view.child-views.spec.js`
- `test/unit/collection-view/collection-view-reconciliation.spec.js`
- `test/unit/collection-view/collection-view-children.spec.js`
- `test/unit/mixins/view.spec.js`

Optional targeted external-resource demonstration: `test/unit/view-ownership.spec.js`.

This proves existing framework contracts only. It does not establish teaching effectiveness, browser focus behavior in the future example, or success by a fresh consumer agent.

## Selected data implementation: @mnjs/data

The user selected `@mnjs/data` for the first teaching slice. `packages/data/src/index.ts` exports `Model`, `Collection`, `StateApi`, and `DataApi`; the scaffold will register the APIs once. `packages/data/src/api.ts` contains the integration contracts.

Check observable collection updates, retained row identity, row rendering, and cleanup against these contracts when building the example. `test/unit/data-package/api-integration.spec.js` provides behavior checks, not an architectural template. It was inspected during the selection update, but no new test execution is claimed here.

The earlier Backbone-specific teaching suggestions have been removed. Historical test commands remain in the verification record so past execution is not misrepresented.
