# Schema mounting, layout and root slots

`mount({host,schema,data,values,components,slots,schemaSlots,...})` mounts a content schema inside the existing owned Core form. Choose `schema` or explicit `fields` as the declaration source; supplying both rejects. A schema mount creates no count-fixture fields. Configure the owned root form through `formProps`; the schema describes its contents rather than a second form.

```js
const api = mount({
  host,
  values: {name: 'Ada'},
  data: {title: 'Contact'},
  schema: {$el: 'fieldset', children: [
    {$el: 'legend', children: '$title'},
    {$formkit: 'text', name: 'name', label: 'Name'},
    {$el: 'p', children: '$values.name'}
  ]},
  slots: {
    default: {$el: 'article', children: ['$slots.fields']},
    actions: {$el: 'aside', children: 'Custom actions'}
  }
});
api.updateData({title: 'Updated contact'});
api.setSchema({$el: 'section', children: {$formkit: 'text', name: 'name'}});
api.setSlots({}); // Restore the ordinary root sections/default field outlet.
```

`updateData(next)` replaces external schema data. Supplied `$values` always reads the owned Core form value and updates after notified commits; it is an adapter data convention, not an upstream reserved token. Field projection runs synchronously for explicit data changes; context-driven DOM work can settle in microtasks. Silent external mutation is not observed. Field-slot bodies share external data and their live loop locals. Ordinary reactive updates retain matching Core owners and controls; schema replacement reconciles named fields while replacing layout containers. Root/schema redraws do not promise to preserve browser focus while controls are detached.

## Root presentation slots

`slots` supplies named root form sections such as `default`, `actions`, `messages` or `message`. Values are schema bodies or callbacks. They receive the root context; the official definition decides where each section is invoked. A `message` slot replaces the whole message section, including its normal loop, so a supplied body must provide its own `for:['message','$messages']` when needed. Custom slot names can also be called from supplied slot schemas. Slot bodies inherit current loop locals and external data.

The reserved `$slots.fields` schema outlet places the already-owned fields/layout. A default override can wrap this outlet, or omit it to keep declared controls parked outside the visible form. Parked fields remain owned and accept schema data updates; revealing them delivers their mounted lifecycle when attached. One active field outlet is supported.

A callback receives `{parent,before,context,locals,renderFields}`. Call `renderFields(parent,before)` once to place content; the owner manages that outlet's cleanup. Return a cleanup function or `{update(args),destroy(remove)}` for your own presentation/listeners. As with other renderer slots, `remove:false` means the outer owner will clear its DOM. `setSlots(next)` replaces root presentation while retaining matching field DOM, Core nodes and values.

`schemaSlots` is separate: it supplies callback slots to the content layout schema. This preserves the existing explicit layout controller's scoped callback contract. Field declaration `children:{label: schema,...}` remains an adapter named-input-slot shorthand; it is not upstream FormKitSchema component-slot syntax. React/Vue component objects require explicit framework-neutral factories; see `RENDERER-COMPONENTS.md`.

## Explicit field projection

`createSchemaController({node,schema,onFields,data})` in `schema.mjs` remains available independently. It compiles actual FormKit expressions into field declarations; `onFields` normally calls `form.setFields`. Initial projection and `updateData` are synchronous; notified Core changes coalesce in a microtask. `destroy()` ends registry/observer work; Core form destruction also disposes it.

Projection accepts registered input types, dynamic names/types/props, anonymous identities, native group/list children, conditional branches, bind precedence, recursively evaluated arrays/objects, raw `__raw__` props, array/object/numeric loops and reactive registry `$get`. Active sibling names/keys must remain unique. Conditional fields may be absent; removed fields release their owned Core values using upstream behavior. Native groups/lists have field-array children in explicit field projection; other schema-driven inputs use named slot dictionaries. Schema mounting and layout composition additionally accept mixed content under native groups/lists.

String `if` conditions are compiled as expressions, including constants such as `'false'`, `'true'` and `'1 === 2'`; ordinary prop strings remain literals unless expression-prefixed. Conditional prop objects use the same condition semantics. A false branch allocates only its `else` fields, so inactive required inputs do not affect validation or submission.

A declared dynamic `name` may resolve to `undefined`, producing an anonymous Core name. Layout outlets and field projection share a stable private identity for these declarations, retaining anonymous Core nodes and controls across data-only updates. An explicit key changing with a resolved name requests a remount, matching the installed peers. Existing named-field reconciliation still applies when names change.

`createSchemaController` projects fields, not DOM wrappers. Use schema mounting or the layout controller for `$el`/`$cmp` composition. External data is plain and explicitly refreshed. Equality may traverse projections and observation can read aggregate root values; neither is constant-time work.

## Explicit layout composition

`createLayoutController({form,schema,data,components,slots})` in `schema-layout.mjs` remains supported. It composes arbitrary literal/dynamic DOM tags, text, attributes/events, bind, conditions, loops, registry `$get`, explicit component factories and owned field outlets. It shares the existing form's sole field owner. Native group/list child arrays can mix DOM wrappers, text, explicit component factories, conditions, loops and nested fields. The layout controller projects only the fields into each native owner and renders presentation at that owner's existing default child outlet; wrappers create no Core nodes. Child names are unique within their native parent, and anonymous child identities are local to that parent. External data, `$values` and inherited loop locals update through the same projection/presentation cycle as root content. Native default-slot context tokens are not added to the field projection data contract by this change. Named input-slot dictionaries on other input types retain their existing behavior. Layout `innerHTML` attributes remain rejected; trusted raw icon HTML in official input/section schemas is a separate path.

Only one layout controller may own a form at once, including an automatically created schema mount. Root section/slot redraws retain that controller and its component instances. Destroying only the controller restores still-owned fields to the ordinary outlet; terminal form destruction releases the root Core owner first, then presentation/descendants, with one outer DOM clear. Replacing a schema uses ordinary reconciliation, without transactional rollback or recovery for arbitrary failing callbacks.

Focused checks: `unified-schema-root-slots-test.mjs`, `schema-test.mjs`, `schema-layout-test.mjs`, the breadth/registry/slot fixtures, `schema-layout-parity.mjs vue|react|experiment`, `schema-native-layout-test.mjs vue|react|experiment` and `schema-native-layout-lifecycle-test.mjs`. The experiment arm now exercises unified mounting against the same genuine schema used by the installed Vue/React bindings. These are JSDOM checks; browser, accessibility and performance work remains separate. MIT attribution: `LICENSE.formkit`.

## Explicit FormKit components and current ownership

`$cmp:'FormKit'` owns its child schema through the built-in factory, rather than having descendants projected before their Core parent exists. This composes with native mixed groups/lists in both directions. Other portable factories retain their explicit DOM/schema boundary. Projected named input slots retain outer loop locals separately from field context; `$id` still resolves to the input context. Default-child invocations have independent retained scopes keyed by their actual Core parent and release removed rows.

Official add-on containers use the resolved Core group/list type with field-array children. Document/ShadowRoot is supplied as `__root`, and an explicit `formProps.name` names the root Core form. Attribute/bind-only section changes can use `renderSections.setSchema` to retain mount-owned plugin DOM; structural or local-library changes use full redraw. Ref callbacks are replaced/cleared with their owner. The official `fillForm` helper can await the returned native submission Promise; no cancellation is added to native reset/submit.
