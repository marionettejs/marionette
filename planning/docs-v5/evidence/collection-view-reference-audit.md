# CollectionView reference contract audit

Audited 2026-09-29 against local v5 source (`5.0.0-rc.2`). Source and tests establish runtime contracts; they do not establish architecture quality or reader effectiveness. No runtime or test files changed for this audit.

## Sources and verification

Primary sources: `src/modules/collection-view.ts`, `src/modules/child-view-container.ts`, `src/mixins/view.ts`, `src/mixins/template-render.ts`, `src/runtime/data-api.ts`, `src/modules/common/chainable-methods.ts`, `src/index.ts`, and `packages/data/src/api.ts`. Focused tests cover those contracts; some compatibility test fixtures use an explicit Backbone adapter. That fixture choice is not an application recommendation.

Command run:

```sh
npx vitest run test/unit/collection-view test/unit/child-view-container.spec.js test/unit/runtime/data-api.spec.js test/unit/data-api-integration.spec.js test/unit/data-api-redux.spec.js test/unit/model-based/collection-view.spec.js test/unit/destroy-listener-cleanup.spec.js
```

Result: **16 test files passed; 524 tests passed**, exit 0. The model-based test represents multiple generated operation sequences, not multiple counted tests. This is a focused runtime-contract run, not the full unit suite, package validation, browser validation, or an agent evaluation.

## Public configuration inventory

CollectionView composes the shared visual mixin; it does not inherit View's named Region APIs.

Constructor-copied options (undefined values do not replace prototype configuration): `attributes`, `behaviors`, `childView`, `childViewContainer`, `childViewEventPrefix`, `childViewEvents`, `childViewOptions`, `childViewTriggers`, `className`, `collection`, `collectionEvents`, `el`, `emptyView`, `emptyViewOptions`, `events`, `id`, `model`, `modelEvents`, `stateEvents`, `sortWithCollection`, `tagName`, `template`, `templateContext`, `triggers`, `ui`, `viewComparator`, `viewFilter`. Supplied `state` is handled by the state mixin rather than that copy list.

| Configuration | Contract |
| --- | --- |
| `childView` | Class or `(model) => class`, resolver called on CollectionView. Required when constructing collection children; absent value throws `MN0011`. Not required for a manual-only list or an empty source with no constructed child. |
| `childViewOptions` | Object or function called with model and CollectionView receiver. Default construction merges `{ model, ...options }`, so an explicit `options.model` overrides the source model. Prefer preserving it for key lookup/reconciliation. |
| `collection` | Source supplied to the configured `Data` provider. Default provider accepts static arrays, uses each item itself as key, and provides no mutation notifications. CollectionView does not own/destroy the supplied collection or its models. |
| `template` | Optional parent markup; false/undefined skips parent template rendering but still builds, filters, and renders children. Unlike View, a populated adopted element is initially `isRendered() === false`. |
| `childViewContainer` | Selector or zero-argument resolver on CollectionView; first matching descendant receives children, otherwise root is used when unspecified/falsy. Missing selected descendant throws `MN0013`. Empty View uses the same container. |
| `sortWithCollection` | `true` by default; source order influences reconciliation and source reorder notifications call `sort()`. `false` ignores reorder-only notifications, keeps insertion order without a custom comparator; updates and resets still reconcile children. |
| `viewComparator` | Model attribute string, unary criterion `(view)`, or binary comparator `(left, right)`, called on CollectionView. Function arity selects unary versus binary. `false` disables presentation comparator; other falsy values fall back to collection order when available and enabled. |
| `viewFilter` | Function `(view, index, allManagedChildren)`, model-attribute string (present and truthy), or object matching model attributes with strict equality and `Data.has`. Falsy disables filtering. Called on CollectionView; filters Views, not source models. |
| `emptyView` | Class, zero-argument resolver on CollectionView, or omitted/null/false. Resolver can return null/undefined/false to disable. |
| `emptyViewOptions` | Object or zero-argument function on CollectionView. Falls back to `childViewOptions` when falsy; fallback function receives no model argument. |
| `RegionClass` | Prototype/initialize customization of the empty Region class; not copied from constructor options. Empty Region receives `{el: container || el, replaceElement: false}`. |
| `monitorViewEvents` | Shared prototype configuration, enabled unless exactly false; not copied from constructor options. Suppresses managed child attachment/detachment monitoring. |

Shared defaults: `cidPrefix: 'mncv'`, `tagName: 'div'`, DOM event maps unset, child event prefix `false`. Shared `el`, renderer, UI, model/collection subscriptions, behaviors, state and explicit child event mappings follow their canonical shared reference pages.

## Public members and return values

Own CollectionView surface:

- `children`: current presentation `ChildViewContainer`; excludes filtered-out children, excludes empty View, includes a newly adopted deferred/manual child until a filter pass. It is not a collection mutation API.
- `getEmptyRegion()`: owned Region; creates it after initialize, retargets it to current container, reuses it while live, recreates if explicitly destroyed while owner lives, returns destroyed instance after owner destruction.
- `render()`: returns CollectionView; destroys all currently managed children (including manual/filtered children), creates source children, subscribes once to normalized collection changes on first render with a source, optionally renders parent template and binds UI, locates container, sorts/filters/renders children, marks rendered. Destroyed owner makes this a no-op.
- `sort()`: returns CollectionView; sorts all managed children, then calls `filter()` and renders presentation.
- `getComparator()`: explicit truthy comparator; otherwise false when disabled/no source/sortWithCollection false; otherwise source-index comparator.
- `setComparator(value, {preventRender}?)`: stores value, immediately calls sort only if value differs by strict equality and preventRender is false. Returns CollectionView. It does not wait for initial rendering.
- `removeComparator(options?)`: setComparator(null, options), restoring source order default when enabled. Returns CollectionView.
- `filter()`: returns CollectionView; updates presented set and renders it, no-op after destruction. It does not populate an unrendered list from its collection.
- `getFilter()`: raw viewFilter value; customization point.
- `setFilter(value, {preventRender}?)`: stores value, immediately filters only if value differs by strict equality and preventRender is false. Returns CollectionView. It does not wait for initial rendering.
- `removeFilter(options?)`: setFilter(null, options), returns CollectionView.
- `buildChildView(model, ChildViewClass, options?)`: customization point; returns newly constructed child using merged model/options, does not adopt/render it itself.
- `attachHtml(elementsOrFragment, container)`: customization point; appends using Dom, returns undefined. Custom alternate placement owns its own ordering.
- `detachHtml(view)`: customization point; detaches its element through Dom, returns undefined.
- `isEmpty()`: boolean based on presented children, so a fully filtered list is empty even with a nonempty source.
- `swapChildViews(first, second)`: requires both exact instances owned (filtered children included); swaps internal/presented ordering and elements, refilters when only one currently presented. Returns CollectionView; throws `MN0015` for foreign/impostor Views. Does not mutate source order; subsequent source/comparator sorting may restore it.
- `addChildView(view, index?, options?)`, `addChildView(view, options?)`: returns the input view. Ignores missing/falsy or destroyed input and calls after owner destruction. Rejects already-owned children (`MN0003`). Renders parent first when needed, adopts child, emits add pair, then sorts/filters/renders. Numeric index bypasses sorting/filtering for that insertion; `options.index` takes precedence. `preventRender:true` defers child pass but still adopts/indexes child; parent may already have rendered first.
- `detachChildView(view)`: removes ownership/event forwarding/DOM while retaining live child; returns input (including absent/unowned inputs). Caller now owns retained lifetime. Does not mutate source.
- `removeChildView(view)`: destroys owned child, removes lookup/ownership, may show empty View; returns input. Missing/unowned input is untouched. Source is unchanged, so later full render/reset can rebuild its source row. Its typed second `{shouldDetach}` argument is explicitly internal in source; document `detachChildView` as the supported public operation.

Shared instance/member inventory to reference rather than duplicate:

- Identity/configuration: `cid`, `cidPrefix`, `options`, `el`, `tagName`, `id`, `className`, `attributes`, `model`, `collection`, `events`, `triggers`, `ui`, `behaviors`, `childViewEvents`, `childViewTriggers`, `childViewEventPrefix`, `modelEvents`, `collectionEvents`, `stateEvents`, `state`, `template`, `templateContext`, `Dom`, `Data`, `State`, `EventDelegator`, `monitorViewEvents`.
- Construction/state: `preinitialize`, `initialize`, `createState`, `getState`.
- Visual lifecycle/query: `$`, `getUI`, `renderAttributes`, `destroy`, `isRendered`, `isAttached`, `isDestroyed`, `delegateEvents`, `undelegateEvents`, `delegateEntityEvents`, `undelegateEntityEvents`, `bindUIElements`, `unbindUIElements`.
- Rendering: `getTemplate`, `serializeData`, `serializeModel`, `serializeCollection`, `mixinTemplateContext`, `attachElContent`, intentional renderer hook `_renderHtml`.
- Common: `getOption`, `mergeOptions`, `normalizeMethods`, `bindEvents`, `unbindEvents`, `bindRequests`, `unbindRequests`, `normalizeUIString`, `normalizeUIKeys`, `normalizeUIValues`.
- Events: `on`, `off`, `once`, `listenTo`, `listenToOnce`, `stopListening`, `trigger`, `triggerMethod`.
- Class surface: `extend`, `setRenderer`, `setDomApi`, `setEventDelegator`, `setDataApi`, `setStateApi`, standard `prototype`, callable constructor `call`/`apply`.

## Child container public inventory

All lookups operate on current presented children. `findByModel(model)` looks up `Data.key(model)`, not necessarily model object identity; `findByKey(key)` uses the key directly. Native `@mnjs/data` provider key is model.cid, not model.id. Default provider key is item identity/value.

- `length`, `[Symbol.iterator]`, `toArray()` (new shallow array).
- `findByModel`, `findByKey`, `findByIndex`, `findByCid`: child or undefined.
- `findIndexByView`: integer or -1; `hasView`: exact instance matching indexed cid; `contains`: exact instance membership; `isEmpty`: boolean.
- `each(callback, context?)`: returns container; `map(callback, context?)`: result array.
- `reduce(callback, initialValue?, context?)`: accumulator; omitted initial uses first child; empty without initial throws `MN0024`. Explicit undefined counts as supplied initial.
- `find`, `filter`, `reject`, `every`, `some`, `partition`: function predicate only, optional context, arguments `(view, index)`; respective outputs child/undefined, arrays, booleans, pair of arrays.
- `invoke(methodName, ...args)`: invokes child method with child receiver, returns result array.
- `pluck(property)`: direct View property array, not model attribute/property-path lookup.
- `first()`, `last()`: child/undefined; `first(count)`, `last(count)`: arrays; `initial(count = 1)`, `rest(count = 1)`: arrays; counts must be nonnegative integers or throw `MN0024`.
- `without(...views)`: new array excluding exact instances.

No public mutation methods on children. Its `Data` field is typed provider context, not a per-container runtime configuration recommendation. Internal `_views`, `_viewsByCid`, `_indexByModel`, `_keyByView` and all underscore container methods must not be promoted. Removed aliases and undocumented where/findWhere helpers are absent.

## Reconciliation, retention and ownership

- Observable provider must supply unique non-null keys stable while model stays in the list; repeated same model, colliding distinct keys or changed key throws `MN0039`. Equality uses SameValueZero.
- Collection observation starts during first render with a collection and is disposed on destruction. Reassigning `collection` is not a supported source-rebinding API: the existing normalized observer is not replaced by `render` or `delegateEntityEvents`.
- Add/remove update constructs or destroys affected children; survivors retain View/element identity. Presented survivors are reordered in place; focus/selection restoration applies to surviving controls, not rerendered/replaced controls.
- Same-reference update marks that View unrendered; next presentation pass rerenders it. Hidden updated View waits until shown. Immutable same-key replacement creates a new View with the new model, removes old ownership, renders new presentation, then destroys old View. Stable key is not a promise of retaining child instance across immutable replacement.
- `reset` and explicit parent `render` destroy/rebuild all managed children, including manually added and hidden children. Collection reset does not rerender parent template or change parent rendered/attached state.
- Normal model change events are provider-specific. Do not promise arbitrary model mutations generate normalized updates; `@mnjs/data` observes collection update/reset/sort events. Local child `modelEvents` remains available.
- Filtering detaches without destroying and keeps ownership/event forwarding. Removing filter can reuse existing rendered DOM; filtered children remain part of eventual destruction. Capture references through appropriate owner flow rather than accessing private `_children`.
- Repeated empty render passes create a fresh empty View, replacing the previous one. Empty View is owned through `getEmptyRegion()`, not children; its events use shared child forwarding.
- Manual removals do not edit source. Later same-key updates skip a removed child's missing ownership; full render rebuilds it. Source-backed mutation should normally change source.
- Source order supplies ties for custom comparators during normalized notifications with sortWithCollection true. `viewComparator:false` still follows normalized source ordering if sortWithCollection remains true, but emits no comparator sort events. Default source comparator orders manual children lacking a source model before source children (index -1); avoid implying all manual additions append under defaults.
- Setters compare function/object identity. Mutating captured filter state or the same object requires explicit filter()/sort() (or a new predicate). Configure at construction or defer before initial show; immediate setters are not readiness guards.

## Events and hooks

Events use `triggerMethod`, so `before:add:child` corresponds to `onBeforeAddChild`, etc.

| Event pair | Arguments and scope |
| --- | --- |
| `before:render`, `render` | `(collectionView)`; explicit full render only. `render` sees isRendered true; before sees previous state. |
| `before:add:child`, `add:child` | `(collectionView, child)`; adoption before/after index/ownership, generally before child render/attachment. |
| `before:remove:child`, `remove:child` | `(collectionView, child)`; removal from indexes. Direct remove/detach disposes child before this pair; normalized updates emit pair before deferred destruction. Do not promise one universal destroy order. |
| `before:sort`, `sort` | `(collectionView)`; only when managed children exist and effective comparator truthy. |
| `before:filter`, `filter` | Before `(collectionView)`; after `(collectionView, acceptedViews, rejectedViews)`; only when managed children exist and active filter truthy. |
| `before:render:children`, `render:children` | `(collectionView, presentedViews)` each child rendering pass including empty. Array is live presentation storage; copy if retaining snapshot. |
| `before:destroy:children`, `destroy:children` | `(collectionView)` around bulk destruction when managed children exist. Individual remove does not emit this pair. Bulk destruction does not emit per-child remove pairs. |
| `before:attach`, `attach`, `before:detach`, `detach` | Shared managed lifecycle `(view)`; row attach/detach only when relevant and monitoring enabled. Sorting survivors does not emit synthetic detach/attach. |
| `before:destroy`, `destroy` | `(collectionView, options)`; owner detaches root, destroys children/empty Region, subscriptions/behaviors/owned state, then clears incoming/outgoing native event registrations. |

Empty Region additionally exposes normal Region events. CollectionView does not add `before:show:empty`/`show:empty`/`before:remove:empty`/`remove:empty` events.

## Types and internal classification

Root exported types: `CollectionViewInstance<Child, Options, State, Source, Query>`, `CollectionViewConstructor<Props, Args, State, Statics, Query>`, `CollectionViewConfiguration<Child, Model>`, `CollectionChild`, `ChildRenderOptions` (`preventRender?`, `index?`). Shared `SupportedView`, `ViewLifecycle` and provider contracts remain their canonical reference scope. ChildViewContainer and ContainerChild are internal module types reachable through the instance's children surface, not named root exports.

`CollectionChild` intersects SupportedView with cid/model container contract. Constructor inference tracks child factory/class, collection source, supplied state, options and query return shape; this does not add runtime source rebinding or mutation observation. RegionClass appears in configuration type but the runtime copy list still requires prototype/initialize placement.

`_renderHtml` is intentional rendering extension. Other underscore CollectionView members are internal: reconciliation snapshots/queue, `_children`, `_emptyRegion`, `_initialEvents`, `_onCollection*`, `_setChildrenFromSnapshot`, `_initChildViewStorage`, `_getChildView*`, `_createChildView`, `_addChild*`, `_removeChild*`, `_setupChildView`, `_getImmediateChildren`, `_getChildViewContainer`, `_sortChildren`, `_viewComparator`, `_filterChildren`, `_getFilter`, `_detachChildren`, `_detachChildView`, `_renderChildren`, `_getBuffer`, `_attachChildren`, `_showEmptyView`, `_getEmptyView*`, `_destroyEmptyView`, `_destroyChildView`, `_destroyChildren`, `_removeChildren`; common internal mixin hooks are also excluded. `container` is a resolved runtime cache, not a configuration/reassignment API. Tests touching internals verify implementation and do not convert those names into recommended API.

## Canonical coverage disposition

- Constructor/options/state/Behavior boundary: [construction](../../../docs/api/collection-view.md#construction-and-options) and linked shared references.
- Source observations, child identity and rebuild: [collection updates](../../../docs/api/collection-view.md#rendering-and-collection-updates).
- Comparators and filter methods/options: [sorting](../../../docs/api/collection-view.md#sorting), [filtering](../../../docs/api/collection-view.md#filtering).
- Empty Region and emptyView configuration: [empty presentation](../../../docs/api/collection-view.md#empty-presentation).
- Child-container public queries: [find and inspect children](../../../docs/api/collection-view.md#find-and-inspect-children).
- Manual child ownership methods: [manage View instances](../../../docs/api/collection-view.md#manage-view-instances-directly).
- Events, hooks, DOM/build extension points, status/destruction and inherited links: [lifecycle](../../../docs/api/collection-view.md#lifecycle-and-extension-points).
- Exported type roles: [TypeScript](../../../docs/api/collection-view.md#typescript).

A follow-up draft review checked these paths and the full public method list. Three wording corrections were applied: limit MN0039 to diagnosed key failures; use sort() for deferred comparators; say child adoption precedes presentation by this list, since a retained child may have been shown before. Other listed internals/provider-authoring gaps retain their dispositions above.

## Review follow-up source checks

- Criteria sorting uses `compareCriteria` in `src/modules/child-view-container.ts`: original index breaks equal criteria ties, and undefined criteria sort last. The installed example assertions exercise ties and move an undefined key from first to last.
- `_renderChildren` calls the public `isEmpty()` method to choose empty presentation. `_getChildViewContainer` resolves a string through `$`, matching its declared selector-returning function type.
- `_renderChildren` passes `children._views` to lifecycle events; it is live storage, not a snapshot. Default source ordering maps manual children missing from the source to -1.
- Native `packages/data/src/api.ts` collection observation listens for update/reset/sort. Model attribute changes forwarded by Collection do not synthesize those membership notifications. The installed example asserts that parent order/filter stay unchanged until explicitly applied.
- RegionClass is absent from constructor ClassOptions and read directly by getEmptyRegion; the docs describe this verified source/type mismatch without changing runtime.
