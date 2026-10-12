# @mnjs/formkit (development)

Marionette-owned native forms backed by FormKit 2.1.2. `FormView` owns one official FormKit runtime. Author inputs with a schema,
a small `fields` shorthand, or ordinary Marionette templates and `FieldView`
children in Regions. There is no Vue, React or Pro runtime dependency.
This local development package has not been published. See the
[compatibility record](compatibility.md) for verified scope and remaining limits.
The [canonical ownership checkpoint](OWNERSHIP.md) records the new owner's
measurements separately from the transferred historical acceptance evidence.

Conditional inputs use official schema conditions or explicit owner/Region
composition. The retired `showField`/`showIf` registration API is absent from this
candidate; its original checkpoint and failing evidence are preserved separately.
A declared-composition experiment remains outside shipped source and unexported
pending acceptance; its repository tests and full coverage remain enabled.

## Use the native form

```ts
import { Region } from 'marionette';
import { FormView, SubmissionError } from '@mnjs/formkit';

interface Profile { email: string; details: { name: string; updates: boolean } }
const form = new FormView<Profile>({
  schema: [
    { $formkit: 'email', name: 'email', label: 'Email', validation: 'required|email',
      autocomplete: 'email' },
    { $formkit: 'group', name: 'details', children: [
      { $formkit: 'text', name: 'name', label: 'Name', validation: 'required' },
      { $formkit: 'checkbox', name: 'updates', label: 'Send updates' }
    ] }
  ],
  async submit(values, { signal }) {
    const response = await fetch('/api/profile', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    if (!response.ok) {
      throw new SubmissionError('Unable to save.', { email: ['Please check this email.'] });
    }
  }
});
const region = new Region({ el: document.querySelector('#profile')! });
region.show(form);
// The feature owner calls region.destroy() when the feature ends.
```

Use exactly one of `schema`, `fields`, or `template`. The schema path installs official MIT
input definitions, their value features, sections, messages and native handlers.
The `fields` shorthand translates to the same official schema runtime: each field has `name`, `type`,
`label`, optional `help`, `value`, `validation`, `validationMessages`, `attrs`, and
select `options`; groups have `type: 'group'`, `name`, `label`, and `children`.
Shorthand names are unique among siblings, nonempty and contain no dots. Its groups
render semantic fieldsets. Numeric shorthand fields yield numbers or `undefined`.

The schema path supports text, email, password, search, tel, url, number, range,
color, date, datetime-local, month, time, week, hidden, textarea, radio, single and
group checkboxes, single and multiple select, file, button, submit, groups, lists
and metadata. Schema numbers use the official `number` prop for numeric values.
File values are FormKit's file-list entries, not serializable file contents.
Disabled fields stay in the value tree. Add semantic fieldsets/legends in schemas
when a grouping needs an accessible name; schema `group` is structurally transparent.

Use `class ProfileForm extends FormView<Profile>` for Marionette hooks or subscribe
with `form.on(...)`. Show through a Region; detach/re-show retains nodes and DOM.
Repeated `render()` preserves unchanged controls, focus and selection. The `render`
event observes completed DOM. A supplied `el` must be an `HTMLFormElement` whose
entire contents the owner permits this View to manage. Construction clears its
existing contents before Marionette initializes it; `render()` mounts the new
controls. Schema children describe
fields inside this root form; do not insert a second nested form.

Schema and shorthand modes add Submit and Reset buttons by default. Change their
labels with `submitLabel`/`resetLabel`; suppress both with
`formProps: { actions: false }` or replace their slot with
`slots: { actions: () => [] }`. Template mode adds no buttons. Its ordinary
`button[type="submit"]` and `button[type="reset"]` use the same owned handlers,
submission state and cancellation. FieldViews display field messages; a template
renders root errors itself from `form:state` and `state.errors`.

## Place schemas and named Views in one form

`SchemaView({ form, parent?, schema, schemaData?, components? })` places reusable
native schemas inside ordinary Views and Regions. It borrows a live group from the
same form and creates no extra form or layout group. `createViewComponents` returns
named factories for real Views, CollectionViews and FieldViews in JSON `$cmp`
schemas. The form retains one validation/submission/reset boundary across these
routes. See [schema Views and named components](schema-views.md) for typed examples,
Region placement timing, update/removal rules and preserve inheritance.

`SchemaView<Values>` uses `SchemaViewOptions<Values>` and inherits ordinary View
configuration, Regions, events and lifecycle methods. Its `node` getter exposes
the borrowed group; `setSchema(schema)` replaces its schema and
`setSchemaData(data)` replaces its expression data. `$node` always describes that
borrowed group. Destroying the View releases its resources; destroying the group
or form also ends detached schema Views.

`createViewComponents<Values>({ getForm, getOwner?, getParent?, registrations })`
returns a registry directly. `ViewComponentsOptions<Values>` describes these
resolvers. A `kind: 'field'` registration creates a real FieldView; a
`kind: 'view'` uses `ViewComponentRegistration<Values, Props, SpecificView>` with
`create({ form, parent, props, data, children })` and optional `update`. The owner
must be an actual View that owns Regions. Stable keys retain the View and Region;
compatible field props update through public setters. Remove a field before
replacing its type, id, name, parent, removal, ignore, plugins or config identity.
Factories render immediately and show their Region after wrapper insertion in
one microtask. There is no callback exception rollback or recovery guarantee.

## Compose keyed rows

`RowView<Values>` and `RowOptions<Values>` accept ordinary View configuration plus
`form`, `parent`, `rowKey` and `removal`. Render an owned FieldView list with
`input: { type: 'list', dynamic: true, itemKey: 'id' }`, then use its node as the
row parent. Each existing object has a unique immutable nonempty string key. A row
exposes its genuine group `node` after render; pass that node explicitly to its
FieldViews or SchemaViews. Ordinary CollectionViews control display independently
of business array order. RowView inherits ordinary View Regions, events and
lifecycle methods.

Use root `setValues` or list `setValue` for authoritative membership/order writes.
`removal: 'preserve'` supports temporary UI removal and rebuild; `clear` terminally
deletes that business row. Same-membership reset retains controls. If membership
changed, reset ends placements and the feature owner rebuilds from `form:reset`.
Added rows do not become construction reset members. To nest custom rows, mount
an owned list FieldView under an outer RowView's `node`, then mount inner RowViews
under that list's `node`. Keys are unique within each list; different outer rows
can each contain an inner row named `x`. Defaults, exclusions and cleanup follow
the full ancestor-key chain. Each ancestor array must be crossed through its owned RowView group.
Two levels are tested; mutable keys, unowned intervening arrays and arbitrary
direct Core array writes remain outside the contract. The
[row ownership contract](rows.md) explains retained validation, keyed defaults,
delayed mount, cleanup and reset in detail; `/composed.html` and `/nested.html` are
runnable examples.

## Compose fields in Marionette Regions

Use ordinary Views and Regions for feature layout. A `FieldView` owns an official
input, including its messages and value features; it uses the same runtime as schema
inputs. It is created without a node and mounts on first render. Show it through a
Region, then access `field.node` for core APIs. Render a group field first and pass
its node as `parent` to its children. Add a fieldset/legend in the surrounding template.

```ts
import { Region } from 'marionette';
import { FieldView, FormView } from '@mnjs/formkit';

class ContactForm extends FormView<{ email: string; updates: boolean }> {
  onRender() {
    this.showChildView('email', new FieldView({ form: this, name: 'email',
      removal: 'preserve', input: { type: 'email', label: 'Email', validation: 'required|email' } }));
    this.showChildView('updates', new FieldView({ form: this, name: 'updates', removal: 'preserve',
      input: { type: 'checkbox', label: 'Send updates' } }));
  }
}
const contact = new ContactForm({
  template: () => '<fieldset><legend>Contact</legend><div class="email"></div><div class="updates"></div></fieldset><button type="submit">Save</button>',
  regions: { email: '.email', updates: '.updates' },
  values: { email: '', updates: false }
});
// The host document contains <div id="contact"></div>.
const owner = new Region({ el: document.querySelector('#contact')! });
owner.show(contact);
// The feature owner calls owner.destroy() when the feature ends.
```

For conditions, the feature owner decides membership through ordinary Regions
and synchronizes its business model. The runnable `/composition.html` example
uses a `FieldView` change listener and `showChildView`/`Region.empty`, including
reset. Use official schema conditions when layout and inputs fit a schema.
An ordinary child View's Regions remain that child's resource. Accordion collapse
can hide DOM while retaining controls and validation; input disabled props retain
values. Each has its own lifetime and value contract.

### Explicit FieldView ownership

`FieldView` accepts `form`, local `name`, `input`, explicit `removal`, and optional
`parent`. Parents must be live groups owned by that form. For a CollectionView
rendering real array items, use `RowView` to borrow one keyed group from an owned
list, then pass `row.node` to its fields. The [row ownership contract](rows.md)
documents addition, order, temporary unmount, terminal deletion and reset limits.
`input` accepts official native input props/custom definitions, rather than Vue props.
Names are unique within each group, nonempty and contain no dots. IDs are unique by
default; explicit IDs are the consumer's responsibility.

- `getValue()` returns a copied plain value; `setValue(value, { notify?, source? })`
  replaces this input's value, including an object or array. `notify: false` suppresses
  both field and form value events. Root `setValues` retains its partial-merge contract.
- `field:change(value, { source })` runs after a changed commit and Region placement.
  Sources follow the form contract. Silent snapshot echoes do not turn user edits into
  programmatic events. Read the latest owner snapshot when delayed callbacks execute.
- `setInput(partialProps)` patches mutable props such as label, options, validation,
  disabled or attrs, including before render. It is shallow: provide the complete
  replacement `attrs` object. Use `setValue` for values and a new View for type/identity,
  parent, name, preserve, ignore, plugins or config changes. Initial `ignore: true`
  controls have independent values/validation and contribute neither to the form;
  their listeners and Views still end with their form owner.
- `removal: 'preserve'` removes the node on destroy but retains its draft value.
  `removal: 'clear'` removes both node and value, including under preserved groups;
  snapshots written through `setValues`, `setValue` or `resetForm` cannot resurrect
  the absent clear path. Remount restores its initial
  value/default; reset restores construction/first-mount baselines.

Hiding a Region's DOM or detaching its View retains its node, draft, validation and
listeners. Destroying a field removes its validation. Destroying an owned group
ends all its descendant fields, even in external Regions; destroying the form also
ends detached fields. Re-showing a destroyed field requires a new View. Repeated
`render()` is intentionally stable in every authoring mode; it does not rebuild a
template's layout. Use Regions for layout changes or create a new form owner.

An external actor remains the feature owner's resource. Listen to `field:change`,
send the actor's real events, and echo snapshots with `notify: false`. The feature
owner must unsubscribe its actor, cancel its timers, and guard delayed edits against
its latest read-only state. This package has no actor adapter dependency or invented
business event protocol. FormKit `mounted` occurs when the input runtime is built;
use Marionette `attach` for custom controls that require connected DOM or measurements.

### Mix schema and ordinary sections

Several section Views can share one form by passing the same `form` to each
FieldView. Separate FormViews own separate root nodes and submit/reset lifetimes.
The root constructor still takes exactly one of `schema`, `fields`, or `template`.
A group FieldView's native default slot can render schema inputs within a template:

```js
const contact = new FieldView({
  form, name: 'contact', removal: 'preserve',
  input: { type: 'group', slots: { default: () => [
    { $formkit: 'email', name: 'email', label: 'Email', validation: 'required|email' }
  ] } }
});
form.showChildView('contact', contact);
// After the group has rendered, other section Views may use contact.node as parent.
const notes = new FieldView({ form, parent: contact.node, name: 'notes',
  removal: 'preserve', input: { type: 'textarea', label: 'Notes' } });
section.showChildView('notes', notes);
```

Those Regions must exist on their respective owner Views. The feature owner ends
the section Views and form through normal Region teardown. A standalone
`createSchemaRenderer` does not register the built-in FormKit input component;
it is not a second form-section mounting API.

Core addresses are relative to a node's parent: use `group.node.at('$self.name')`
for a child of that group, or `$root.details.name` for an absolute form path.
Quoted registry IDs are literals in expressions, for example
`$get("contact-mode").value === "EMAIL"`. An unquoted ID containing a hyphen is
parsed as an expression.

Text input's native event can precede its committed `field:change` by the configured
FormKit delay. A business debounce measured from the keystroke should start on that
native event; a debounce started on `field:change` adds the commit delay. Keep those
timers with the feature owner. If an actor derives sibling values from a form change,
project its latest snapshot after the current core commit completes, rather than
writing siblings reentrantly inside that commit. Flush owned business drafts before
calling `submit()` when they must participate in the submitted snapshot.

Application initialization and draft restoration happen before constructing the
form. Pass the resulting complete snapshot as `values`; the package does not run
host initializers, fetch a draft, or persist it. Project an authoritative update
with `setValues(partial, { notify: false, source: 'load' })` to avoid echoing it into
an application change listener. A supplied list is authoritative and supersedes
pending edits on its supplied paths. Business updates should resolve the current
row by ID before writing that list, independently of its display order.

Keep engine errors in the feature owner's state when they must survive edits.
Render a separate accessible summary from that state and the form's validation
state; hiding a summary when valid does not clear its stored errors. Clear those
errors at the application's accepted submission transition. An invalid validation
attempt never calls the `submit` callback. `source: 'derived'` is metadata for the
application to distinguish its own effects; the package does not suppress its
notifications or saves. Own debounce timers with the feature and end them on
destruction. Discard that reloads the application uses Region teardown and a new
FormView with authoritative values; `resetForm()` remains a local reset to the
construction snapshot. The source checkout's
`test/unit/formkit-application-lifecycle.spec.js` exercises these bounded contracts.

## API

- `node`: the owned root `FormKitNode`; its public props, context, store, events,
  hooks, ledgers and input APIs remain available. Use View methods for owned
  lifetimes and removal policies; direct core mutations follow upstream semantics.
- `getValues()`: a typed snapshot. Plain objects and arrays are copied; opaque
  values such as `File`, `Date` and consumer instances retain identity. Mutating
  the copied plain tree does not edit the form. Treat retained instances as borrowed.
- `setValues(partialValues, { notify?, source? })`: merge a snapshot into the
  current tree synchronously. `notify: false` suppresses value-change events;
  `source` passes through to change events. Supplied paths supersede older delayed
  edits; unrelated paths retain their drafts. Unchanged values emit no change.
- `getState()`: `{ submitted, submitting, valid, errors }`. `errors` are root
  errors; `valid` reflects blocking messages, including pending validation.
- `submit(event?)`: resolves to `success`, `invalid`, `error`, `busy` or `cancelled`.
  Awaits values and validation, marks fields submitted, focuses the first enabled invalid
  control, prevents overlapping submissions and calls `submit(values, { node, signal })`.
  Official `submit-raw` events and submit hooks run. `formProps.onSubmitRaw`,
  `onSubmitInvalid`, `onSubmit`, `submitBehavior` and `incompleteMessage` are supported.
  The option `submit` takes precedence over `formProps.onSubmit`.
- `setErrors(rootErrors?, fieldErrors?)`: replace submission errors. Field keys
  use dot addresses such as `details.name`. `SubmissionError(message, fieldErrors)`
  does the same when thrown by the submit callback. Other thrown values get a
  generic message. Changed native edits clear root auto-clear submission errors
  by default; imperative field errors follow input commits and `preserveErrors`.
  Submit and reset clear these FormKit errors. External engine errors have a
  separate application-owned lifetime; validation remains rule-owned.
- `resetForm()`: restore initial values/defaults, clear submission errors and
  touched/submitted state, and cancel pending submit. Native reset uses this API.
  Keyed schema rows are ordered to their construction values before reset. If row
  membership changed, reset can recreate or repurpose controls while restoring
  the initial rendered values; surviving control/widget identity and focus across
  restoration of removed rows are not guaranteed. The independent removed-initial-
  predecessor identity probe remains a recorded failure, not a repaired guarantee.
- `setSchemaData(data)`: replace schema expression data and reconcile synchronously.
- `setSchema(schema)`: replace the field schema and reconcile synchronously.
- `destroy()`: terminal Marionette cleanup, including every created input node,
  ignored button/meta nodes, registry entries, subscriptions and owned DOM listeners.
  Reset and destruction abort the submit signal and settle its public promise.

Submission normally disables controls until completion; `submitBehavior:
'live'` retains editable controls. Edits made while validation awaits must finish
committing and validating before the submission callback receives its snapshot.
An owner's existing disabled prop is restored.
A callback should honor the signal. After it receives the snapshot, a value change,
input/group creation or destruction, or validation-rule change cancels that attempt.
Pure layout movement or detach/reattach retains it. Late results cannot publish
success or field errors after cancellation, reset or destruction. Await the
`cancelled` result and retry explicitly; the package never repeats an external
request automatically and cannot undo one that ignored cancellation.
Use this submission API to gate the actual node validation state. Repeating a few
required checks in a custom submit handler omits other rules and async validation.
Declare format rules explicitly, such as `required|email`; FormKit's default
`required` permits whitespace, while `required:trim` requires non-whitespace text.

Events: `form:change(values, state, { source })`, `form:state(state)`,
`form:reset(values)`, `submit:invalid(values)`, `submit:success(values, result)`,
`submit:error(error)`. Sources are `user`, `programmatic`, `reset`, or a supplied
value. First render emits initial values. Validation state changes do not duplicate
value events. Marionette hooks use normal names, e.g. `onFormChange`.

## Schema inputs, slots and plugins

`schemaData` supplies expression data. At the root application schema, explicitly
supplied keys take precedence over native root fallbacks, including inherited
keys and present `null`/`undefined`; `node` remains reserved for the owning root.
Native input child slots use their nearest input context (`value`, `state`, `type`,
`id`, `label`, etc.), then lexical application data. A slot returning `{ schema,
data }` explicitly replaces its scope. Ordinary text expressions stringify their
results, including `null` and `undefined`; native control values retain normal
empty-value handling.

`inputs` extends the official library with custom native input definitions.
Schema definitions can use `schema` functions or literal schemas. Component
input definitions must use a native factory or a name in `components`; arbitrary
Vue/React components are not portable. `sectionsSchema` extends official sections,
and each schema input may provide its own section extensions.

Named `slots` are functions returning schema, a DOM node, or `{ schema, data }`.
Input `children` supply default content or a named-slot map. `$slots.name`, scoped
context, `$get("id")`, loops, stable keys and function event bindings work.
`setSchemaData` is explicit for application data; input context mutations and
borrowed registry nodes trigger queued renderer updates automatically.

```js
const form = new FormView({
  values: { rows: [{ id: 'a', name: 'Paul' }] },
  schema: [{ $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
    { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index',
      children: [{ $formkit: 'hidden', name: 'id' },
        { $formkit: 'text', name: 'name', label: 'Name', validation: 'required' }] }
  ] }]
});
```

Use each list child's core UID (`$item`) as its schema key. `itemKey` is an
application identity string property or function used to match external snapshots;
otherwise matching uses deep equality. Distinct stable keys preserve node/DOM
identity during reorders. Duplicate application identities should be avoided.

`config`, `plugins`, `validationRules`, and input `validationMessages` use official
core contracts. English localization is installed; compatible i18n plugins can
replace it. Async rules are guarded against stale values, rejection and teardown.
Current rule rejection becomes a failed validation and a public `validation-error`
node event; obsolete results do not change current validation.

Official MIT addons are consumer dependencies: install `@formkit/addons@2.1.2`
and pass plugin factories in `plugins`. Multi-step navigation, local storage,
length countdown and floating labels are covered by integration tests. Plugin
resources attached to window/document or external observers remain the plugin's
cleanup responsibility; owning rendered elements does not prove every third-party
plugin cleans up its independent resources. Borrowed actors remain with their feature owner. `FieldView` only accepts group
parents owned by its form; custom factories own their own external resources.

`theme`, `icons`, `iconLoader`, `iconLoaderUrl` and section classes use official
MIT theme features. An absent custom loader does not fetch remote icons implicitly.
Explicit remote themes/loaders require the consumer's network policy. SVG icons
and section HTML are trusted application content. Never use untrusted schemas,
HTML, expressions, component factories or callback bindings.

## Public schema renderer

```js
import { createSchemaRenderer } from '@mnjs/formkit';
const renderer = createSchemaRenderer(container, {
  schema: [{ $el: 'p', children: '$message' }], data: { message: 'Ready' }
});
renderer.update({ message: 'Saved' });
renderer.setSchema([{ $el: 'strong', children: '$message' }]);
renderer.destroy();
```

This standalone renderer uses core compilation and sugar, supports DOM/text,
conditions, attributes, loops, keys, scoped slots and subscribed registry lookup.
It does not itself register the built-in FormKit component; use `FormView` for
input trees. Native factories receive `{ document, props, data, children }` and
return `{ element, update(props, data, children), destroy() }`. They own their
internal resources. Supplied slot DOM is moved into and removed from this mount.
`innerHTML` requires `allowHTML: true`; string event handlers are rejected. Failures
of synchronous user factories/callbacks do not imply transactional rollback.

## TypeScript

`FormView<Values>` / `FormOptions<Values>` type values and submit callbacks.
`FormOptions` also accepts ordinary View configuration, including Regions, events,
model/collection/state bindings, classes, attributes, behaviors and template context.
The generic describes the consumer’s expected shape; it does not infer or validate
that shape from field names or schemas. Keep the declaration and rendered tree in sync.
`RuntimeOptions` describes schemas, slots, inputs, sections and theme options.
`Definition`, `FieldDefinition`, `GroupDefinition`, `NativeType` describe shorthand
fields; `FieldOptions`, `FieldInput`, `FieldInputUpdate` and `RemovalPolicy` describe
composed fields; `FormValues`, `FormState`, `SubmitResult`, `SubmissionContext`,
`ValueUpdateOptions`, `SchemaOptions`, `SchemaSlot`, `SchemaComponent`, and
`SchemaComponentFactory` describe the remaining public contracts. ESM/CommonJS
declarations are generated from authored TypeScript.

## Run the examples and checks

From the repository root with the configured toolchain:

```sh
npm ci
npm --prefix examples/formkit install --ignore-scripts
npm --prefix examples/formkit run dev
```

Open `/composition.html` for template/Region composition, explicit conditional
removal, grouped values and retained accordion drafts. Open `/` for grouped shorthand fields or `/schema.html` for official schema controls,
conditional company fields, files, multi-step validation, stable participant lists,
async submission, simulated errors, reset and cancellation. Both run locally.

```sh
npm run test:formkit
npm run build
npm --prefix examples/formkit run build
npm run test:formkit-package
npm run test:formkit-browser
npm run lint:ci
npm run coverage
```

Browser tests target Chromium, Firefox and WebKit using the pinned Playwright
browsers and their host dependencies. Select one with
`npm run test:formkit-browser -- --project=chromium`.

The package is outside the existing release certification set. Full FormKit Pro
support and release certification remain unverified; see the compatibility record.
