# Runtime, renderer, DOM, and event provider audit

Source audit on 2026-09-29 for the current `5.0.0-rc.2` checkout. This is a contract inventory for writing references, not an application architecture example or evidence of teaching effectiveness. No runtime or public documentation was edited for this audit.

## Source scope

- `src/index.ts`, `src/create-marionette.ts`, `src/runtime-id.ts`
- `src/runtime/{renderer,dom-api,event-delegator,data-api,state-api}.ts`
- `src/mixins/{template-render,view-events}.ts`
- `src/modules/{view,collection-view,region,application,behavior}.ts`
- `src/modules/common/{build-region,monitor-view-events}.ts`
- `src/utils/extend.ts`
- Focused runtime tests listed below, plus `test/types/{facade,dom}.{mts,cts}` inspected for public declaration expectations.

## Runtime factory and export inventory

The root package has named exports; its public entrypoint does not expose a default export. `createMarionette()` takes no options and returns a synchronous facade. It is not an Application instance and has no start, destroy, reset, or recursive `createMarionette` method.

The facade contains:

- Six classes: `Application`, `Behavior`, `CollectionView`, `MnObject`, `Region`, `View`.
- Provider values: `DataApi`, `DomApi`, `StateApi`.
- `Radio`, `Events`, `MarionetteError`, `VERSION`, `extend`, `monitorViewEvents`.
- Five configuration functions: `setDataApi`, `setDomApi`, `setEventDelegator`, `setRenderer`, `setStateApi`.

The root additionally exports `createMarionette` itself and public types. There is **no runtime `EventDelegator` or `Renderer` export**. `EventDelegator`, `DelegateOptions`, `DelegatedEvent`, and `Renderer` are type exports. The default event provider is available through `View.prototype.EventDelegator`. The contract types for exported provider values have distinct names: `DataApiContract`, `DomApiContract`, `StateApiContract`.

### Scope and return values

| Setter | Classes configured by root/facade call | Class operation |
| --- | --- | --- |
| `setDomApi(mixin?)` | View, CollectionView, Region | Shallow overlay onto a fresh `prototype.Dom` object |
| `setDataApi(mixin?)` | View, CollectionView | Shallow overlay onto a fresh `prototype.Data` object |
| `setStateApi(mixin?)` | View, CollectionView, Behavior, MnObject, Application | Shallow overlay onto a fresh `prototype.State` object |
| `setRenderer(renderer?)` | View, CollectionView | Replace `prototype._renderHtml` |
| `setEventDelegator(delegator)` | View, CollectionView, Behavior | Replace entire `prototype.EventDelegator` |

Every root or facade setter returns `undefined` (`void` in declarations). Every class setter returns its receiving class. Only the classes listed in a row expose that static setter; an Application's Region and a Behavior's host provide their DOM/data operations indirectly.

Class setters affect the receiving prototype; they do not mutate its parent's provider slot. Descendants and existing instances that still inherit the slot see subsequent parent changes. A descendant with its own configured slot keeps it. Configuring a class does not configure an unrelated child class, host Behavior class, or already-created Region class. The runtime setters intentionally visit all supported classes.

DOM/data/state overlays copy own enumerable properties, including symbols. They are shallow, preserve unspecified existing operations, and overwrite operations explicitly set to `undefined`. There is no validation or provider compatibility inference. No argument does not restore a provider. Renderer/event setters replace rather than merge; `setRenderer()` installs `undefined`, which cannot render a template. A usable renderer must be supplied to restore rendering.

Configuration operates on prototype slots rather than retroactively rebuilding active resources. Event registrations retain the cleanup returned by their original provider. New registration after `undelegateEvents()`/`delegateEvents()` uses the current provider. Configure before constructing consumers as the normal path.

### Isolation boundaries

`createMarionette` shallow-copies native provider snapshots captured at module initialization. It explicitly restores the native renderer and creates its own Radio channels/debug state. Existing configuration on root exports does not seed the new runtime. Each of its classes extends the matching root class; `instanceof` the root class still succeeds. It is not a deep clone of arbitrary base-class methods or application state, a separate JavaScript realm, or a DOM isolation mechanism. Shared function implementations and utilities remain shared.

Initially the runtime's `DomApi` value and DOM-capable class slots refer to the same fresh object; analogous relationships hold for data and state. After a setter overlays a slot, the public `runtime.DomApi`/`DataApi`/`StateApi` value is **not** replaced. It is a native baseline, not a getter for the latest class configuration. Use setters rather than mutating exported provider objects.

Runtime Views create that runtime's Regions, CollectionViews create that runtime's empty Region, and Applications use that runtime's Region class. Region instances/classes registered to View or Application owners must belong to the same runtime (`MN0030`). Application start-time Region replacement also checks the runtime. Child Applications must belong to their parent's runtime (`MN0031`). These runtime identities are not branded in the TypeScript types.

Showing a View from another runtime in a Region is expressly allowed and tested; do not generalize ownership checks into a ban on all mixed-runtime objects. A displayed View continues to use its own providers. No general View/Behavior/collection-child runtime compatibility check exists.

## Renderer contract

`Renderer<Receiver = unknown, Template = unknown, Data = unknown, Output = unknown>` is `(this: Receiver, template: Template, data: Data) => Output`.

- Called synchronously with the View/CollectionView as `this`.
- Template comes from `getTemplate()`; normal template rendering serializes model or collection, then applies `templateContext`.
- The renderer receives the resulting data, falling back to `{}` when it is falsy.
- Native renderer calls `template(data)` as a plain function; native templates therefore need to be callable. A replacement may accept another template representation.
- The returned value is always sent to `attachElContent(output)`, which normally calls `Dom.setContents(el, output)`.
- Native DOM insertion supports HTML strings and empties content for `null`/`undefined`. Returning `undefined`, `false`, a DOM node, or a Promise is not a signal to skip insertion. Rendering does not await a Promise.
- A renderer that performs DOM insertion itself must be paired with an appropriate `attachElContent` override or matching DOM provider. A non-string output likewise needs a matching insertion operation.
- `template: false` bypasses template evaluation through the View's render contract; it is not a renderer return convention.

Type parameters describe a renderer when it is authored; registration does not prove its template/data/output/DOM combination is consistent. A `Renderer<...>` annotation is useful, but a successfully registered provider alone is not a rendering guarantee.

## Complete DOM provider authoring contract

`DomApiContract<Query extends ArrayLike<Element> = ArrayLike<Element>, Content = never>` defines all operations below. `setDomApi` accepts partial overlays. A full provider declaration supplies every operation; optional calls at selected runtime sites do not make the interface members optional.

| Operation | Declared signature | Native behavior and obligation |
| --- | --- | --- |
| `createElement` | `(tagName: string) => Element` | Uses `document.createElement`; creation must return a DOM Element. |
| `createBuffer` | `() => DocumentFragment` | Creates an insertion buffer. |
| `getDocumentEl` | `(el: Element) => Element \| null` | Returns `el.ownerDocument.documentElement`; used with containment to determine attachment. |
| `findEl` | `(el: Element \| Document, selector: string) => Query` | Returns matching descendants as an array-like collection of Elements; excludes root. Native implementation returns a static `NodeList` and also accepts `DocumentFragment`. |
| `hasEl` | `(el: Node, childEl: Node \| null \| undefined) => boolean` | Strict containment, excluding `el` itself; native implementation checks containment of the child's parent. |
| `detachEl` | `(el: Element) => void` | Removes the root from its parent without destroying native listeners. |
| `replaceEl` | `(newEl: Element, oldEl: Element) => void` | Replaces old root with new root; native implementation does nothing when equal or old root is parentless. |
| `setContents` | `(el: Element, html: Content) => void` | Replaces root contents. Native implementation assigns `innerHTML = html ?? ''`. Its explicit native input is `string \| null \| undefined`. |
| `setAttributes` | `(el: Element, attrs: unknown) => void` | Applies own enumerable string-keyed attributes. `null` removes, `undefined` leaves unchanged, other values use `setAttribute`. It sets attributes rather than live properties. |
| `appendContents` | `(el: Element \| DocumentFragment, contents: Element \| DocumentFragment) => void` | Appends DOM content; native implementation accepts `Node` on both sides. |
| `moveEl` | `(el: Element, parent: Element \| DocumentFragment, before?: Node \| null) => void` | Inserts/moves before the specified node, or appends. Native implementation uses `parent.moveBefore` only for a child already in that parent when available; otherwise `insertBefore`. |
| `hasContents` | `(el: Node \| null \| undefined) => boolean` | Whether a node has child nodes; false for absent nodes. |
| `detachContents` | `(el: Element) => void` | Clears children while leaving the root; native implementation sets `textContent = ''`. |
| `notifyAttach` | `(el: Element) => void` | Provider notification for a monitored attachment; native implementation does nothing. |
| `notifyDetach` | `(el: Element) => void` | Provider notification for a monitored detachment; native implementation does nothing. |

Provider attach/detach notifications are invoked by Marionette's lifecycle monitoring, including construction on an attached root. They do not observe arbitrary external DOM changes. `monitorViewEvents: false` suppresses the monitor, including these notifications. Keep the distinction between View lifecycle propagation and DOM provider resource integration.

DOM provider substitution still uses DOM Element/Node contracts. A changed `findEl` return type can change `$()`/UI query shape; registration does not rewrite previously declared View types. `DomApiContract` defaults `Content` to `never` to avoid falsely asserting that arbitrary registered content is safe. Use an explicit `DomApiContract<Query, Content>` when authoring a matched adapter.

## Event delegation provider contract

`EventDelegator` has exactly `delegate(options: DelegateOptions): () => void`.

`DelegateOptions` contains required `eventName: string`, `selector: string`, `handler: (...args: unknown[]) => unknown`, and `rootEl: Element`. Marionette supplies `selector: ''` for direct root registrations. The returned function removes this registration; reusable providers should make it safe to call more than once, as the native provider does.

Marionette resolves callback method names, binds event handlers to the owning View or Behavior, normalizes `@ui` references, and parses event-map keys before provider registration. A provider should call the supplied handler without replacing this owner binding. DOM trigger policy (preventDefault/stopPropagation and emitted Marionette event) belongs to the trigger wrapper, not the provider.

Native delegation:

- Uses `addEventListener` on the root. `focus` and `blur` use capture; other event types use bubbling registration.
- For nonempty selectors, walks from the event target through parent nodes to find the nearest matching Element, stopping before root. It invokes once and sets `event.delegateTarget` to that match. Text-node targets are supported.
- `event.currentTarget` remains the registration root. `DelegatedEvent` extends `Event` with optional `delegateTarget?: Element`.
- Empty selector passes the event directly without assigning `delegateTarget`.
- Uses native event names and CSS selectors. It does not provide jQuery event namespaces, delegated `mouseenter` emulation, `return false` cancellation, or extra trigger arguments.
- Returns idempotent cleanup that removes the exact listener with its original capture setting.
- Cleanup remains associated with the provider used at registration even if the class provider subsequently changes.

The static setter installs a configurable, enumerable, non-writable prototype data property. Later setter calls replace it through `defineProperty`. Direct assignment should not be offered as the public configuration path.

## Type/implementation limits to preserve in prose

1. Full provider types and partial registration types are distinct. The API deliberately accepts complete custom renderer content contracts without inferring downstream safety.
2. Native DOM method signatures can be broader than the authoring interface, notably `findEl(DocumentFragment, ...)`, and native `createElement` returns `HTMLElement` rather than only `Element`.
3. `NativeDelegateOptions` accepts absent/null selectors and a single `DelegatedEvent` callback; the exported `DelegateOptions` supplied by Marionette requires a string and allows custom providers to forward arguments. `NativeDelegateOptions` is not a root-exported type.
4. Type tests reject null/nonconforming event providers, but the setter itself performs no runtime shape validation. The comment in `test/types/dom.mts` saying null is rejected by the runtime setter is stronger than the implementation: JavaScript can install null and fail when delegation next uses it. Do not repeat that claim.
5. Overlay types permit nullish/primitive arguments and unknown extra metadata. These permissive implementation details are not useful normal configuration examples. An explicit `undefined` method overwrites a callable operation and can break later use.
6. Class/facade runtime ownership is not represented by distinct nominal TypeScript types; same-runtime ownership must be checked at runtime.

## Verification

Ran:

```sh
npx vitest run test/unit/create-marionette.spec.js test/unit/runtime/dom-api.spec.js test/unit/runtime/event-delegator.spec.js test/unit/runtime/renderer.spec.js test/unit/mixins/template-render.spec.js test/unit/mixins/view-events.spec.js test/unit/view.renderer.spec.js test/unit/common/monitor-view-events.spec.js
```

Result: **88 tests passed in 8 files**, exit 0.

Counts: factory 8; DOM 35; delegation 15; renderer 2; template rendering 10; event mixin 8; View renderer 7; lifecycle monitor 3. These run current sources through the repository's configured Vitest aliases. They do not establish installed package completeness or reader success. Type fixtures were inspected, not compiled by this audit; the parent workflow can add `facade` and `dom` fixtures to installed-package verification.

## Proposed reference emphasis

Lead with ordinary root setup and isolated runtime selection, then the setter scope table. Keep DOM/renderer/delegator authoring separate from ordinary View rendering and events. Document native defaults before extension points, include the full method inventory, and make matching renderer output to insertion explicit. Link shared class lifecycle contracts instead of rebuilding them here. Avoid an adapter example that only wraps a native method without solving a real integration need.
