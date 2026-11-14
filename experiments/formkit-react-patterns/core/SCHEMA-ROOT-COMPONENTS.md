# Literal Schema and Root factories

The portable factory library registers `FormKitSchema` and `FormKitRoot` in
addition to FormKit, Provider, LazyProvider, Messages, Summary, and Icon. These
account for the eight reusable portable component names in the pinned Vue/React
2.5 catalog. Framework runtime aliases and development playgrounds are not
additional portable components.

```js
mount({ host, schema: {
  $cmp: 'FormKitRoot', children: {
    $cmp: 'FormKitSchema', props: {
      __raw__schema: [
        { $el: 'p', children: '$intro' },
        { $formkit: 'text', name: 'answer', validation: 'required' }
      ],
      __raw__data: { intro: 'A schema in the existing form' }
    }
  }
} });
```

Use `__raw__schema` for a literal schema object, or `schema: '$declaration'` to
read a declaration from outer schema data. The raw prefix prevents the caller's
prop compiler from interpreting expressions belonging to the inner schema.

`FormKitSchema` borrows the current Core parent. Its nonvisual Marionette object
owns an independent field map, layout controller, observers, registry watches,
and slots. It reuses `createSchemaController`, `createLayoutController`, the
existing field reconciliation, and `renderSections`; it adds no second schema
interpreter, Core container, or form element. Layout wrappers use `display:
contents` to preserve fragment-like layout.

- `schema`, `data`, `library`, `memoKey`, and `slots` update the local instance.
  Data updates reconcile fields and refresh presentation. Schema-valued slots follow replacement data objects, including removed keys, without replacing retained keyed slot DOM. Replacing schema,
  library, slots or memoKey invalidates its presentation controller; native field
  owners of the same name/type and explicit key retain identity, DOM and edited values. Changing an explicit key replaces the owner and uncontrolled value.
- The local `library` overrides portable factories, including the FormKit sugar
  factory. An overridden FormKit factory receives declarations directly without
  hidden native Core allocation. Native input definitions/plugins/config continue
  to inherit through the Core parent and Provider option scope.
- Schema expressions use explicit `data`, independent from caller lexical data.
  `$values` is not implicitly reserved in this literal component. Supplying
  `data.values` uses that value. `$get` still uses the existing owned registry.
  A `data.node` value does not replace the injected Core parent.
- `slots` accepts existing portable slot callbacks or schema values. Literal
  children supply the caller's default slot and retain the caller's lexical data.
  `onMounted` runs once after the schema host is connected.
- A supplied reactive FormKit context is observed and unsubscribed on replacement
  or destruction. Plain mutable data can be refreshed through the enclosing
  `updateData` call. No supplied data object or external Core node is destroyed.

Opaque provider/factory presentation follows the existing layout-controller
replacement lifecycle. Arbitrary structural replacement of every nested opaque
factory while retaining all of its private state is not established. This does
not claim complete dynamic prop/config parity or framework component support.

`FormKitRoot` renders children only after its actual boundary belongs to a
Document or ShadowRoot. It obtains that root from the boundary's `getRootNode`,
including a nested ShadowRoot inside a document-owned form. The selected root
passes independently of Provider options through factories, groups, Schema,
named slots and lazy loading into descendant `node.props.__root`. It adds no
Core node and does not change the existing Core parent. Like the official
components, it discovers a root once; moving an active instance between roots
requires remounting it.

The renderer's optional `domRoot` and `parentNode` scope arguments keep DOM-root
and Core-parent injection separate from public schema data. `renderChildren`
retains both lexical scopes. Factories may return `refresh()` when they own an
independent scoped controller; the outer renderer calls it during notified
updates. Existing factories need no change.

## Verification and source distinctions

`schema-root-upstream.mjs vue|react document|shadow` executes the installed exact
Vue/React 2.5 components. All four references confirm same-parent ownership,
Document/ShadowRoot selection, explicit data, initial value hydration, native
field retention on schema replacement, and complete form removal.

There is one observed ownership difference between those upstream adapters:
Vue's Schema unmount cleanup destroys a Core node supplied as `data.node`;
React leaves it borrowed. This implementation follows React and never destroys
a data node or the injected Core parent. Vue Suspense, React contexts and their
internal parse-cache structures are not portable APIs reproduced here.

`schema-root-components-test.mjs` covers these contracts plus scoped libraries,
Provider composition, caller/named slots, reactive data, mounted timing, pending
Root teardown, and cancellation of nested LazyProvider work. Exact Core creation
and destruction counts verify no duplicate owners. The evidence is JSDOM/Core
execution; browser layout, focus, accessibility and performance remain untested.

Compatible literal `$cmp:FormKit` declarations with object props and legal string `bind` use the same native owner map as `$formkit` sugar, preserving Core/edited value/DOM on Schema or memo replacement. Bound type/name/key are evaluated in the current lexical scope; explicit props override the bound bag. Omitted type defaults to text. Explicit key changes replace named owners; private anonymous fallback keys do not request replacement. Own/non-enumerable prop getters and expression/loop scope are preserved. Non-container default children (including arrays of DOM markup) remain on the factory path; they are not field arrays. Named schema slots and native group/list children retain their existing projection. Overridden factories, whole expression-bound prop bags, non-container default-child bodies and opaque provider-containing scopes retain their documented factory lifecycle. A container whose type comes only from bind and has a default-child body also remains opaque; declaring its group/list type explicitly selects native child projection. No compatibility claim is added for `props: '$fieldProps'`. Focused peer coverage is `schema-bind-retention-test.mjs experiment|vue|react document|shadow`.
