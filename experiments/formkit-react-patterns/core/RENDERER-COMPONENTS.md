# DOM/Marionette component boundary

`mount({ components: { Widget: factory }, ... })` exposes named factories to input definition schemas and layout schemas containing `$cmp: 'Widget'`. This is an adapter contract, not portability for Vue/React component objects.

A factory receives `{ props, context, parentNode, hasChildren, host, renderChildren }`, plus lexical `locals`, `schemaData`, `schemaChildren` and `configScope` for scoped composition:

- Mount DOM or a Marionette View inside `host` (a renderer-owned `display: contents` span).
- Return `{ update(nextProps), destroy(remove = true) }`. Both methods are optional; without `update`, a prop change destroys and recreates the instance.
- `destroy` must dispose any owned View, listeners, timers or resources. The renderer also clears its owned host and child-render scopes.
- `parentNode` is the nearest scoped Core node (falling back to `context.node`); `hasChildren` reports whether schema children were supplied. The built-in FormKit factory passes its new node into its child scope and advertises a default slot only when children exist. Ignored nested inputs remain owned for teardown but have no Core parent.
- Call `renderChildren(target = host, before = null, slotData = {})` to render schema children with additional local values. Each call returns a disposer for that invocation; repeated calls append independently owned child scopes. The FormKit factory retains default-child scopes through compatible redraws and releases removed row scopes.
- Props support expressions, conditional values and nested object values. Node input should use the provided FormKit context handlers, rather than a second value store.

Unknown registry names and non-callable component definitions throw. Framework-specific components must be adapted explicitly. The renderer supports explicit schema `innerHTML` for FormKit icons; only pass trusted schema/HTML, just as with upstream raw HTML bindings.

Focused JSDOM checks: `node core/renderer-breadth-test.mjs` and `node core/renderer-component-input-test.mjs`. These do not establish browser, accessibility or performance parity.

## Repeated ownership

Loops support `[valueName, source]` and `[valueName, keyName, source]`. Numeric sources produce zero-based values; arrays use numeric indexes and objects use property names. An explicit `attrs.key` (DOM schema) or `props.key` (component schema) supplies row identity, matching the upstream rendered-element key. Without one, identity falls back to array index/object property. Duplicate explicit identities fail rather than silently sharing ownership.

Retained keys preserve row DOM/component scopes and refresh their local data. Deleted rows are destroyed. Reordering keeps the focused row attached and moves its siblings around it. This is covered by JSDOM identity/focus/selection checks, not a complete real-browser certification.

Slots may return a cleanup function, or `{ update(args), destroy(remove) }`. `args` includes `{ parent, before, context, locals }`; use `update` when a retained loop row's local data changes. The callback initially creates content, so `update` is not called again during that initial creation.

## Nested inputs and lazy schema producers

`$formkit` sugar dispatches to the registered `FormKit` factory, retaining the upstream split between control keys (`for`, `if`, `children`, `bind`) and input props. It does not create an unrelated form or independent value store.

Loop, condition and dynamic-tag projections preserve property descriptors, including non-enumerable accessors used by schema producers. Schema attrs and props enumerate own property names rather than assuming every schema property is enumerable. Targeted coverage: `renderer-descriptor-test.mjs`.

Named input slots inherit live loop locals. A retained field can add, replace, remove and re-add slot schemas through `setFields`; every repeated invocation has its own controller and cleanup. Focused free checks: `pro-contracts-free-test.mjs` and `dynamic-slots-breadth-test.mjs`. These exercise shared contracts without importing Pro or requiring a key.

Root slot schemas/callbacks and automatic content-schema mounting are documented in `SCHEMA.md`. Root redraws preserve the existing layout controller and component scopes. DOM event props ending in `Passive` (including the actual Pro rating touch spellings) map to the native event with `{passive:true}`; handler replacement and owner teardown remove the registered listener metadata. `passive-event-contract-test.mjs` verifies this without Pro or geometry shims.

Owned factories should honor `destroy(false)` by releasing listeners/resources while leaving DOM for the outer terminal clear. Direct external helper-node destruction still removes its presentation immediately. Summary/Messages/Icon registration and local factory libraries are documented in `HELPER-COMPONENTS.md` and `LIBRARY-RESOLUTION.md`. The portable Icon keeps the documented conservative SVG vocabulary; it is not a claim of arbitrary upstream trusted-HTML portability.

Same-form FormKitProvider/FormKitLazyProvider option scopes and direct-child prop forwarding are documented in [NESTED-PROVIDERS.md](NESTED-PROVIDERS.md). Literal FormKitSchema/FormKitRoot factories now reuse scoped schema ownership and actual DOM-root discovery; see [SCHEMA-ROOT-COMPONENTS.md](SCHEMA-ROOT-COMPONENTS.md).

Each renderChildren invocation owns its construction. If drawing throws before a disposer is returned, that invocation releases its newly allocated resources and propagates the error. This is local construction cleanup, not arbitrary callback rollback or attempt-all teardown. Inherited component props and scope changes apply before descendant effects.

SVG roots and their DOM descendants use the SVG namespace; foreignObject children resume HTML, and nested SVG resumes SVG. This establishes the tested SVG/HTML boundary,not blanket XML/MathML support.

The built-in FormKit factory places its native section output directly under the declared schema parent so official child selectors match. Its bookkeeping host remains connected with `display:contents`; full section redraw re-presents the native output in the same position. Custom factories retain their explicit host contract. `native-factory-dom-placement-test.mjs` checks hierarchy, structural redraw, removal and exact Core teardown; browser geometry evidence is separate.
