# Schema Views and named Marionette components

One `FormView` owns the native form root, canonical values, validation, submission
and reset. Ordinary Views and CollectionViews own layout. A `FieldView` owns one
input/group/list. A `SchemaView` borrows a live group and owns only its renderer and
created input resources. DOM nesting never selects a serialized data parent.

## Place a reusable schema

```ts
import { Region, View } from 'marionette';
import { FormView, FieldView, SchemaView, createViewComponents } from '@mnjs/formkit';

interface ContactValues { contact: { email: string } }
const form = new FormView<ContactValues>({
  template: () => '<div data-contact></div><button type="submit">Save</button>',
  regions: { contact: '[data-contact]' },
  values: { contact: { email: 'invented@example.test' } },
  submit: async (values, { signal }) => { console.log(values, signal.aborted); }
});
const components = createViewComponents({
  getForm: () => form,
  registrations: {
    Email: { kind: 'field', create: options => new FieldView(options) },
    Caption: {
      kind: 'view',
      create({ props }) {
        class CaptionView extends View {
          onRender() { this.el.textContent = String(props.text ?? ''); }
        }
        return new CaptionView({ template: () => '' });
      },
      update(view, props) { view.el.textContent = String(props.text ?? ''); }
    }
  }
});
const contact = new SchemaView({
  form,
  components,
  schema: {
    $formkit: 'group', name: 'contact', preserve: true,
    children: [
      { $cmp: 'Email', props: { name: 'email', removal: 'preserve',
        input: { type: 'email', label: 'Email', validation: 'required|email' } } },
      { $cmp: 'Caption', props: { text: '$node.value.email' } }
    ]
  }
});
const owner = new Region({ el: document.querySelector('#contact')! });
owner.show(form);
form.showChildView('contact', contact);
// The feature owner calls owner.destroy() when the feature ends.
```

`SchemaView<Values>` infers `Values` from its `form`. Its options are `form`, optional
`parent`, required `schema`, optional `schemaData` and `components`, plus ordinary
View configuration except `el` and `template`. `parent` defaults to `form.node` and
must be a live group belonging to that form. Its public `node` getter returns that
borrowed group. `setSchema(schema)` reconciles definitions; `setSchemaData(data)`
replaces the authored expression scope. Both return the same View. Repeated render
retains the mounted renderer. Destroying the View ends its resources, not its
borrowed parent. Parent/root destruction ends detached SchemaViews too.

Top-level expressions see authored schemaData, reserved `$node` (the borrowed
Core group), and renderer `$get(id)` registry lookup. schemaData cannot overwrite
`node`. Parent-context `$value` and state are not flattened into this scope; use
`$node.value` or `$get(id)`. Native child input schemas use their normal FormKit
context. A named FieldView inside a native group receives that actual group via
its context, independently of where its wrapper appears in the DOM.

`$node` has a local meaning in each placement:

| Placement | `$node` refers to |
| --- | --- |
| `FormView({ schema })` | That FormView's root Core group. |
| `SchemaView({ form, schema })` | `form.node`, the borrowed root group. |
| `SchemaView({ form, parent: group.node, schema })` | That explicit live group. |
| `SchemaView({ form, parent: row.node, schema })` | That RowView's retained group, selected by its immutable business key. Reordering changes its index, not the scope to another row. |
| SchemaView borrowing a nested group inside a row | That explicit nested group, rather than the whole row or form. |
| Children of a native `$formkit: 'group'` schema | That native group's normal input context supplies its group node. |

For example, the plain JSON condition `if: '$node.value.invoice'` reads the
committed `invoice` value in that local group. It needs no authored field ID or
registry lookup. A configured input delay still applies before a draft becomes a
committed value. DOM nesting and a matching field name never select an ancestor
or a different row. Application `schemaData` names are explicit supplied data;
there is no automatic `$values`, `$root` or `$parent` alias. Keep named component
constructors in the runtime registry, separately from serializable JSON schemas.

To share root-value expressions across adapters, explicitly bind the data name:
`schemaData: { get values() { return form.node.value; } }`. The same JSON can then
use `$values.invoice` inside nested groups or rows. A Vue mounting adapter supplies
its reactive root model as `data.values`. Retain that binding when replacing
schema data to update other flags. This leaves `$node` local and provides no
automatic alias or observation of raw object mutation.

Root FormView application schemas prefer explicitly supplied caller keys over
native root fallbacks, while reserving `node`. Native input child slots use their
nearest input context before lexical caller data. A slot returning `{ schema,
data }` replaces its scope explicitly. Text expressions stringify their evaluated
result, including `null` and `undefined`; native control values keep normal empty
handling.

SchemaView adds no default action buttons and rejects a nested native form input.
The enclosing FormView owns submit/reset handlers and app-authored actions.
The same SchemaView can be placed inside an ordinary View or a `RowView`; pass the
actual live group explicitly, such as `parent: row.node`. Keyed defaults and reset
exclusions then follow the RowView business key and named suffix. See
[keyed row ownership](rows.md) for construction baseline, membership-changing reset
and nested-array restrictions.

Ordinary Marionette Region/View owners destroy their child Views through their
normal lifecycle; the application need not manually destroy every composed field.
FormView also releases registered form resources, including detached placements
and retained row groups. A consumer still owns external resources it creates,
such as request controllers or window listeners, and ends them at its owning View's
lifecycle boundary.

## Register actual Views

`createViewComponents(options)` returns `Record<string, SchemaComponentFactory>`.
Pass that registry directly as `components`. JSON schemas contain named `$cmp`
strings and JSON props/expressions; constructors remain trusted runtime functions.
No eval, serialized constructor or nested FormView is supported.

`ViewComponentsOptions<Values>` contains:

- `getForm()`: the live enclosing FormView.
- `getOwner?()`: the ordinary View that registers component Regions; defaults to
  the form. It must support ordinary View Regions. A returned CollectionView may
  own its children, but it is not the `getOwner` Region owner.
- `getParent?(props, data)`: an explicit Core parent resolver. Otherwise the
  factory uses actual `data.node` when present, then `form.node`.
- `registrations`: named `kind: 'field'` or `kind: 'view'` registrations.

A field registration implements `create(options: FieldOptions<Values>)` and
returns a real FieldView. Evaluated props specify `name`, `input` and optional
`removal` (default `preserve`). Parent/form are supplied by the factory. A View
registration implements `create({ form, parent, props, data, children })` and
returns a real View or CollectionView; optional `update(view, props, data,
children)` updates that existing instance. No FieldView is accepted under
`kind: 'view'`; use the field registration to retain input identity rules.

Use `ViewComponentRegistration<Values, Props, SpecificView>` when a registration
has specific props or subclass methods. `SpecificView` may be a View or
CollectionView subclass. Typed DTOs, props and update methods are preserved:

```ts
import type { ViewComponentRegistration } from '@mnjs/formkit';
class Caption extends View {
  text: string;
  constructor(text: string) { super({ template: () => '' }); this.text = text; }
  onRender() { this.el.textContent = this.text; }
}
const caption: ViewComponentRegistration<ContactValues, { text: string }, Caption> = {
  kind: 'view',
  create({ props }) { return new Caption(props.text); },
  update(view, props) { view.text = props.text; view.el.textContent = view.text; }
};
const registry = createViewComponents({
  getForm: () => form, registrations: { Caption: caption }
});
```

## Placement, updates and teardown

Each named component uses a unique Region registered through its ordinary owner.
The existing renderer creates/updates factories before inserting their ranges.
The factory renders the actual child immediately, so a FieldView node participates
in immediate validation/submission. It calls Region.show one microtask after
insertion. At that boundary the wrapper must belong to its owner. Connected mounts
receive genuine attach; detached render then outer show propagates normal
attachment. Outer detach/re-show retains children. Await that placement microtask
before querying mounted child DOM.

Stable schema keys retain the Region, View, Core node and native control during
moves. These moves introduce no synthetic attach/detach cycle. A compatible
FieldView update uses public setInput, clearing omitted mutable keys, and setValue
only when an explicit value prop changes. Unrelated refresh does not replay a
static array value or cancel a native draft. Name/type/id/parent/removal/ignore/config and
plugins are identity, not mutable input props. Change the key to replace identity;
when reusing the same group/name, first hide/dispose the old component and then
remount. The renderer constructs new records before cleaning old ones, so a new
key alone is not an atomic same-name replacement. Duplicate live ownership rejects
deterministically.

Destroy/removal cancels deferred placement and ends owned Regions, input resources
and listeners. Direct child destruction terminates that component; condition
hide/remount creates a new instance. A View's own delayed application callbacks
still belong to that View and should be cancelled in its destruction hook.
Callbacks after root destruction cannot update its canonical form state. Generic
exception rollback or reconstruction of a directly mutated Core graph is not
promised.

## Preserve and removal

Native schemas retain Core's existing preserve inheritance; the wrapper does not
force preserve on recursive slot or SchemaView inputs. In FormKit 2.1.2, false is
treated as unset while traversing preserving ancestors. A native preserve:false
input below a preserved row can therefore retain its draft. For terminal removal
there, use an actual FieldView/registered `kind: 'field'` with `removal: 'clear'`, or
RowView's terminal row policy. That explicit FieldView clear also records a keyed
reset exclusion. No separate SchemaView removal option is added.

A native input with no preserving ancestor clears when removed and receives the
same construction baseline/reset accounting. A preserved input retains its value
through temporary layout removal. Ignored controls own no canonical baseline or
reset exclusion; ignored action FieldViews still belong to their form's teardown.
Explicit boolean ignore:true detaches the native Core node from the canonical
parent. This excludes it from canonical values/validation, not from all possible
input plugin execution.

This contract does not imply arbitrary nested array ownership, list reconciliation
from DOM order, or vendor-control support. The installed and browser acceptance
records identify which combinations were executed.
