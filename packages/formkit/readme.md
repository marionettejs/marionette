> Package-only review: build, tests, fixtures, licenses and binding reproduction are
> owned by this package. No working experiment directory is required. Historical
> source and receipts remain linked by immutable commit in `PROVENANCE.md`.

> Local released-peer integration: this private candidate targets official Marionette,
> Radio and Utils **5.2.0**, with the FormKit family pinned together at **2.9.0**.
> See `RELEASED-520-INTEGRATION.md` for source recovery, exact package provenance,
> executed checks and limits. Historical TCM evidence is not current acceptance.

# @mnjs/formkit

FormKit schemas, inputs and validation with Marionette View, Region and
Application ownership. This is an unpublished package candidate. It imports
neither React nor Vue; their component objects require explicit DOM factories.

The package workflow checks the current revision against released Marionette
5.2.0 and FormKit 2.9.0. It exercises the package's ESM, CommonJS and TypeScript
exports, lifecycle and validation contracts, and selected Vue and React
reference cases. These are not full browser, licensed Pro, or performance
certification. See [PROVENANCE.md](PROVENANCE.md) for historical evidence rather
than treating results from a frozen candidate as current.

## Build and verify the candidate

From the repository checkout after dependencies have been installed:

```sh
npm --prefix packages/formkit run build
npm --prefix packages/formkit test
npm --prefix packages/formkit run check:types
npm --prefix packages/formkit run check:package
npm --prefix packages/formkit run lint
npm --prefix packages/formkit run coverage
```

`build` emits ESM and CommonJS bundles plus declarations for each module system.
`test` runs actual public-package Vitest tests without a hidden build. The packed
check extracts a newly created FormKit tarball into an isolated consumer, reuses
installed dependencies without registry access, then verifies both module systems,
public exports, mount/update/destruction and TypeScript consumers. Mandatory compiler
counts and extracted-package scope/lifetime guards also run; the check fails if
instrumentation misses the layout module or required outlet work disappears. It writes the
report and candidate path to `test/tmp/package-result.json`.

`lint` checks package files and the complete active runtime import graph with the
repository's rules. The complete production graph is owned by `src/runtime`; lint rejects any
production import escaping the package source directory. `coverage` uses the
same package-owned build graph. These focused tests
are not comprehensive behavior or browser certification. See [DESIGN.md](DESIGN.md)
for source ownership and the remaining integration work.

## Mount a form

```js
import { mount } from '@mnjs/formkit';

const editor = mount({
  host: document.querySelector('main'),
  fields: [
    { name: 'email', type: 'email', label: 'Email', validation: 'required|email' },
    { name: 'subscribed', type: 'checkbox', label: 'Send updates' },
  ],
  values: { email: '', subscribed: false },
  onSubmit(values) { return saveProfile(values); },
});

editor.setValues({ subscribed: true });
console.log(editor.getValues());
editor.destroy();
```

The consumer supplies `saveProfile`. `mount` owns a Region and the returned form;
call `destroy()` when that owner is no longer needed. The host remains available
for later use. Supply `fields`, `schema`, or both, with `fields: []` for an empty form. Both
sources share the owned Core form; `setFields` updates direct declarations and
`setSchema` updates schema content. Use `updateData` and `setFields` for live edits
where possible. Replacing a root schema, layout or slots may move the
focused control. Resetting sections to the default when already using it
leaves focus and selection alone. Reordering keyed field declarations moves
their DOM elements and preserves their Core nodes; it does not reorder a Core
list's indices or values. To reorder the list itself, move the rows through
FormKit Core (for example, by setting a row node's `index`) as well.
The compatibility `count` fixture creates required text fields and should not be
used for production declarations. Native actions follow the official form
schema; `formProps: { actions: false }` suppresses them.

The returned `MountedForm` exposes the Core `node` and ordinary Marionette `form`,
plus `getValues`, `setValues`, `getFormState`, `setErrors`, `clearErrors`, `reset`,
`submit`, `setFields`, `setSchema`, `updateData`, `setSlots` and
`setSectionsSchema`. `getValues()` returns a snapshot. `setValues` merges supplied
values; `{ notify: false }` suppresses the adapter change event. Official Core
validation and message visibility determine the rendered messages.

FormKit-owned DOM sections can expose their element through the field's
`node.context.refs`. A resolved `ref` attribute takes precedence over automatic
capture, even when its value is `null` or `undefined`. Changing or removing a
callback releases it with `null`; removing the key restores automatic capture
if the section is still mounted. A layout may include `meta: { section: 'name' }`,
but standalone schemas do not create a public `data.refs` store.

Field declarations accept both `onUpdateModelValue` and `'onUpdate:modelValue'`,
including a callback without an explicit `value` or `modelValue`. Both callbacks
follow the existing queued model-update behavior: initialization, direct Core
writes and external value updates may invoke them. They are not user-only events.
For external state synchronization, `setValues(patch, { notify: false })` suppresses
`form:change`; it does not suppress field model callbacks. The form event retains
its `(wholeValues, state, { source })` arguments. Await `node.settled` after an
input operation to await Core settlement; that promise does not certify that all
asynchronous validation or queued callbacks have finished.

Without a field override or inherited configuration, current bindings use the
upstream `blur` default for ordinary inputs and `dirty` for checkboxes. An
independent text-input probe on the frozen adapter and pinned Vue/React 2.5
showed no visible required message initially and one after actual focus/blur,
with no own `validationVisibility` prop. A deliberate current live-default
divergence is not supported by that evidence.

Removing an explicit `validationVisibility` declaration is a separate contract.
The adapter clears a mode only while the declaration still owns it, then resumes
inherited configuration. A later plugin/onNode/runtime replacement retains its
ownership; an unrelated declaration update does not reclaim it. The independent
ownership suite passes for those adapter cases. This does not establish paired
Vue/React equivalence for every explicit override-removal sequence.

## Use an existing Region

```js
import { Region } from 'marionette';
import { FormKitView } from '@mnjs/formkit';

const region = new Region({ el: document.querySelector('main') });
const view = new FormKitView({ fields: [{ name: 'title', label: 'Title' }] });
region.show(view);
view.on('form:change', (values, state, info) => {
  console.log(values, state.valid, info.source);
});
region.empty(); // destroys the View and its owned Core nodes
```

`FormKitView` supports the normal `extend`, event and Region lifecycle contracts.
The package tests cover retained ordinary named fields when their declarations
are updated. That evidence does not establish approval of the proposed dynamic-list or raw
identity corrections. The stable package name aliases the existing runtime constructor;
`ExperimentalFormView` is not a public package export.

## Observe captured commits and wait for pending edits

The opt-in commit channel reports contributing descendant Core input commits,
including no-op commits with `changed: false`. It does not emit group/list/form
aggregate duplicates or an initial replay:

```js
const stop = editor.observeFieldCommits(fact => {
  console.log(fact.path, fact.previous, fact.value, fact.changed, fact.source);
});
try {
  await editor.whenPendingEditsSettled({ signal });
  editor.setValues(incomingValues, { notify: false });
} finally {
  stop();
}
```

The application supplies `signal` and `incomingValues`. Both methods also exist on
`FormKitView`. Register before input you intend to observe. Values, previous data
and relative paths are captured at each actual commit, then delivered in order in
a microtask. Later writes cannot replace an earlier fact with a newer live value.
The Core `node` is an identity handle; `generation` is an opaque token for the
current tracked attachment. Retained list owners keep that token through reorders;
removal/replacement retires it and cancels queued facts. Do not treat array indices
as row identity or compare generations across a fully disposed tracking session.

This first channel classifies explicit `setValues` and declaration operations as
`programmatic`, reset as `reset`, and other origins as `unknown`. It does not claim
user provenance, including for synthetic input or forwarded label activation.
A custom legacy `form:change` source label is not proof of user origin. The fact
channel is not user-only; the application must choose how unknown origins are
handled. No XState dependency or actor synchronization is added.

The fence waits for contributing Core nodes and live input producers registered to
the constructing form, including ignored inputs with `parent: null`, their
scheduled Core input timers and
synchronous queued fact delivery, including synchronous reentrant edits. It observes
actual timer assignments and commit dispatch entry in the pinned FormKit Core graph (currently 2.9.0), rather
than estimating completion from delay props or root settlement. Changing a delay
inside an input listener, or calming a node with an immediate input, cannot hide a
previous timer. A dispatch captures its pending generation before any public commit
middleware runs and retires only that generation afterward. Normal middleware may
prepend, append, or schedule input before or after next; newly scheduled work remains
pending. Core timers are neither cancelled nor replaced. Completed,
synchronous and destroyed inputs add no historical delay to a later fence. Removing
a still-live constructor-owned node from Core ancestry does not end its ownership;
its outstanding work continues to delay the constructor's fence until it completes
or the node is destroyed.

Native adapter nodes install this integration during Core creation, before library
features can cache their methods. A fresh library-created node inheriting the
owner plugin is also registered when its library hook runs before those features.
Ignored nodes participate in completion only; they do not produce value-contributing
field facts. The owner releases each registration at node destruction.
Already-created producers and fresh explicit definitions whose features ran before
the inherited plugin remain unsupported: their scheduling history is unknown. The
fence rejects unsupported producers that are visible through construction ownership
or contributing Core ancestry. An already-created detached node that only receives
the plugin late has established neither; it is outside this fence, not implicitly
observed or rejected. Attaching such a
foreign producer, or replacing input/add/calm, the commit dispatcher, or the timer context,
cannot establish that scheduling history; the fence rejects with TypeError instead
of guessing. Such nodes can still use their existing Core operations and commit
observation. This deliberately couples the fence to the pinned Core implementation;
future Core upgrades must verify its scheduling and synchronous commit paths.

Apply an incoming patch synchronously after awaiting the fence. This is an
observation barrier, not a write lock or incoming-wins policy: future edits can start
after it resolves, and it never reapplies a patch already overwritten by older local
commits. It does not wait for asynchronous validation, callback-returned promises or
unrelated future work. Errors from arbitrary Core middleware/listeners retain Core's
normal reporting; this is not a transaction or error-recovery wrapper. The whole-value
`form:change` arguments and `notify: false` behavior are unchanged.

Fact envelopes, paths and plain objects/arrays are frozen. Supported built-in data
(Date, RegExp, Map, Set and buffers/views) is detached and copied per recipient;
recipients must treat their data as readonly. Repeated references, view offsets and
shared backing buffers are preserved within each snapshot, with no shared mutable
copy between recipients. File/Blob values retain immutable
file-data handles; custom expando properties are outside that data contract.
Callable or opaque objects cannot be captured. Initial unsupported captures throw
from registration; later capture failures and callback errors preserve their
identity, end the affected subscriptions and reject current fences. Delivery stops
at the first throwing observer for that fact; later recipients do
not receive that fact, while surviving observers can receive subsequent facts.
Errors from a retired observation session do not reject a new session's fence.
Core constructor initialization (before its public `isCreated` flag becomes true)
is labeled programmatic, including new fields rendered inside opaque component
children. Later direct Core writes remain unknown unless an explicit adapter
operation establishes their origin. Core commits are not rolled back. Queued errors retain normal asynchronous
reporting. A new
healthy observation/fence can be started afterward.

The disposer is idempotent. Form destruction cancels queued delivery and rejects
waiting fences with `AbortError`. Aborting a fence rejects only that wait with the
signal's reason. It does not unsubscribe commit observers or cancel Core input.
Core scheduling tracking is installed per node by default; it adds no timer, delay
sampling, snapshot or queued fact. Completion ownership adds one live-node Set
entry per registered producer; active completion/settled subscriptions are installed
only while observation or a fence is active and released afterward. Fact
subscribers and fence waiters remain opt-in. A fence-only
wait observes settlement without cloning values. The new methods are an isolated
recovery candidate and require independent review before consumer adoption.

## Reuse projection lifecycle without a state-library dependency

```js
const projection = editor.createValueProjection({
  read: () => applicationValues(),
  onError: reportError,
});
// Invoke from the application's existing store/selector notifications.
void projection.request();
// At an explicit application boundary, request/join a current projection.
await projection.flush();
projection.dispose();
```

`createValueProjection` is optional on both mount and View APIs. Requests coalesce,
wait for the existing pending-edit fence, then read current values and apply the
existing `setValues` operation with `notify:false` (recursive merge by default).
This suppresses `form:change` for the projected write, not field callbacks or
programmatic commit facts. The controller does not subscribe to XState, dispatch
domain commands, infer acceptance, flush application debounce queues or make
schema/structure changes transactional. Replacement is opt-in as documented below.

`flush()` uses the fence before applying values, not after. If edits or fact
delivery triggered by the write must settle before the next operation, await a
separate `whenPendingEditsSettled()` afterward. Neither fence waits for
asynchronous validation or application debounce queues. Keep pending application
intent explicit in `read` and handle validation readiness separately.

In `onSubmit(values)`, the callback argument can predate an application-managed
projection. If you await that projection and any needed post-write edit fence
inside the callback, read current form values with `editor.getValues()` afterward
instead of reusing the callback argument.

Every operation returns a promise. Without `onError`, callers must handle rejection.
An explicit `onError` reports once per failed/coalesced operation and owns notification
for fire-and-forget requests. Awaiting the operation still rejects with the original
error; a throwing reporter cannot replace it. A later request/flush retries after a
transient failure rather than retaining a permanent error latch. An independently
throwing field observer still follows its documented terminal subscription contract;
this value controller neither hides that error nor silently resubscribes it.

The controller retires on owner destruction or explicit dispose. Pending and later
requests reject with AbortError, and no late value write occurs. With `onError`,
fire-and-forget cancellation is handled even for requests made after disposal;
retired owners do not invoke the reporter. Awaited operations still reject.
Reentrant requests
reread before applying stale data. It adds no default subscription or projection to
a form that never creates it. This is a new local candidate API pending independent
review; no full application/Pro/browser readiness follows from its package tests.

## Type values and extension points

```ts
import { mount } from '@mnjs/formkit';
import type { ComponentLibrary, FieldSpec } from '@mnjs/formkit';

interface Profile { email: string; subscribed: boolean }
const fields: FieldSpec[] = [{ name: 'email', type: 'email' }];
const form = mount<Profile>({
  host: document.createElement('main'), fields,
  values: { email: '', subscribed: false },
});
form.setValues({ email: 'paul@example.test' });
const email: string = form.getValues().email;
form.destroy();
```

The value generic describes the consumer's value shape; it does not derive a
runtime validator from TypeScript. `FieldSpec` declares native props and accepts
additional plugin props as `unknown`. Config, plugins, schemas and nodes reuse
FormKit's public types. Factory props and lifecycle, slots, form state, metrics,
Application readiness and the mount result have explicit declarations. ESM
`.mts` and CommonJS `.cts` consumer fixtures verify the published declarations,
including wrong-value and missing-host errors plus mixed fields/schema declarations.

## Schemas and component factories

```js
const editor = mount({
  host,
  schema: [
    { $el: 'h2', children: '$heading' },
    { $formkit: 'text', name: 'title', label: 'Title' },
    { $cmp: 'Notice', props: { text: '$heading' } },
  ],
  data: { heading: 'Edit record' },
  components: {
    Notice({ host, props }) {
      const message = document.createElement('p');
      message.textContent = String(props.text);
      host.append(message);
      return {
        update(next) { message.textContent = String(next.text); },
        destroy() { message.remove(); },
      };
    },
  },
});
editor.updateData({ heading: 'Updated heading' });
```

Here `host` is an application-owned DOM element. Factories receive the current
props, context, nearest Core parent, lexical data, owned host and `renderChildren`.
They can return `update`, `refresh` and `destroy` methods. Dispose any View or
listeners created by the factory. Framework component objects are not
interchangeable with this factory contract.

FormKit, Summary, Messages, Icon, Provider, LazyProvider, Schema and Root roles
are registered by the View. `@mnjs/formkit/components` separately exports the
portable `FormKitSummary`, `FormKitMessages`, `FormKitIcon` and
`createFormKitHelpers` factories for explicit outlets. Messages follow visible
Core context messages. Summary links navigate to fields. Icons use official
loaders and a conservative SVG vocabulary. These portable behaviors do not
implement Vue/React injection, refs, emits or framework slots.

## Load configuration with an Application

```js
import { FormKitApplication } from '@mnjs/formkit';

const editor = new FormKitApplication({
  region: { el: document.querySelector('main') },
  configFile: new URL('./formkit.config.mjs', import.meta.url).href,
  form: { fields: [{ name: 'email', type: 'email' }] },
});
if (await editor.start()) console.log(editor.getView().getValues());
editor.destroy();
```

Application preparation loads configuration before creating the form View.
Cancellation prevents obsolete preparation from mounting later. A `provider`
borrows a ready config scope; `addChildApp` separately establishes ownership.
A borrowed Region remains borrowed. An unmatched selector with
`allowMissingEl: true` follows ordinary Application/Region ownership: configuration
is ready and the unrendered prepared form stays owned by the Application. A later
explicit `showView(getView())` retries that selector in the same Document; stopping
releases the prepared form. To acquire a different Document/ShadowRoot, stop and
start with the new Region target so a new form discovers that root. Missing
selectors otherwise retain Region errors (`MN0005`, or `MN0004` for an omitted
`el`). An `onStart` error occurs after activation; the caller handles the error
and explicitly stops the Application rather than assuming rollback.
For raw `defaultConfig: false` pipelines,
exported `bindings` can be combined with explicitly supplied FormKit library
plugins; the raw pipeline must provide its own root form definition and context.

For ordinary View and `mount()` options, supply `rules`, `locales`, and `plugins`
directly. For an Application, put the same settings under its `config` option.
The package adds the standard FormKit plugins once. A prepared
`defaultConfig(options)` result already includes them and can be passed to a
provider or Application, or spread into View and `mount()` options without
installing the defaults a second time. When you add rule, input, locale, message,
or icon declarations to a prepared config, other named declarations remain available.

Use `locale` with `locales` to select a translation. An explicit `config.locale`
takes precedence. Within an Application, locale set on an individual form
overrides the Application's default; an explicit form `config.locale` still wins.

## Scope

Runtime code lives in `src/runtime` and the public entries import it locally.
The byte-preserving relocation baseline is recorded in [PROVENANCE.md](PROVENANCE.md).
Installed bundles contain that runtime and do not import repository paths.
The integrated treatment includes the independently reviewed layout compiler-reuse
correction. Its matched relocation-only baseline and exact runtime hashes are
recorded in [PROVENANCE.md](PROVENANCE.md). Free inputs and
portable factories are included; no licensed Pro source or key is shipped.
Consumers can supply separately installed licensed plugins under their own
configuration. Full Vue/React parity, all Pro modes, browser accessibility,
geometry and performance are not certified by this package's tests. The current scoped approval includes the dynamic-list, raw identity and mixed
ownership corrections. The default-visibility agreement above remains distinct
from exhaustive parity for explicit override-removal sequences.

The declarations remain hand-maintained. Strict ESM/CJS consumer and anti-any
checks sample public contracts; they do not prove every runtime signature matches
the declaration surface. Full implementation-derived declaration verification
and the remaining runtime formatting are separate work.

## Configured DOM ownership

A FormKitView captures its configured `Dom` provider when initialized. Library-owned
HTML elements, normalized attributes, buffers, placement, replacement and removal
use that provider and receiver through direct fields, schema scopes, slots,
Provider/LazyProvider and helpers. Configure each owning View and Region explicitly;
configuration is not automatically inherited between unrelated owners. Standalone
helpers capture the configured default `View.Dom` when created. Foreign component
factories retain responsibility for their own renderers.

Required element operations are `createElement`, `createBuffer`, `setAttributes`,
`moveEl`, `appendContents`, `replaceEl`, `detachEl` and `detachContents`. A missing
method fails normally; provider errors are not retried through a native provider.
Namespace creation and text/comment operations use owner-document primitives where
the DomApi interface has no equivalent. FormKit retains normalized live property,
listener and focus behavior rather than treating these as plain attributes.

Use `innerHTML` only for trusted markup in a dedicated section without managed
children, such as a built-in icon. The captured provider's `setUnsafeHtml` writes
it without renderer dispatch or sanitization. Do not mix it with ordinary
children or use it on a reused form root; keep ordinary text as text. The separate
`FormKitIcon` helper still sanitizes SVG.

This candidate requires Marionette `^5.2.0`, which provides
`DomApi.setUnsafeHtml`. Raw sections cannot render with a provider that omits
that method; there is no native fallback.

The current package-local lock uses published Marionette, Radio and Utils 5.2.0.
The earlier `4df53edb` workspace build was a historical prerelease control, not
this candidate's peer graph. See [the integration guide](RELEASED-520-INTEGRATION.md)
for the separate root-tool/package installs and hosted verification scope.

Actual HtmlDomApi parent/Region integration and browser focus/IME behavior require
separate verification; configured-provider JSDOM controls do not establish them.

## Replace supplied value branches explicitly

`setValues(patch)` keeps its recursive merge default. With `{merge:false}`, each
supplied top-level value replaces that branch; top-level branches absent from the
patch are unchanged. Unknown old keys inside a replaced branch are removed. Active
registered fields omitted within retained records receive empty values (undefined for inputs,
empty containers for groups/lists), so Core's normal hydration cannot retain their
old answers. Registered fields remain represented in Core values; this does not
promise deleting their declarations or producing a byte-identical actor object.
The input patch is detached and never mutated.

The fenced `createValueProjection` accepts the same `merge:false` policy. Keep the
application's schema/record structure and public Core indices in order before
projecting values. The option does not reconcile schema declarations or infer
business-row identity; normal Core list synchronization remains in force. Emptying
a manually declared list requires removing its row declarations before projection.
It does not cancel pending input or create a transaction. Await the existing fence
before a direct incoming patch; the controller does that for its own operations.
Unawaited writes retain Core's existing pending-input behavior. Programmatic field
facts and notify:false remain unchanged, and reset retains construction defaults.

### Native class type contracts

Native subclasses retain typed values, method-style `preinitialize(options)` and a
polymorphic `render()` return. Early setup belongs in the method: it runs during
base construction before subclass fields initialize. Packed ESM/CJS controls verify
that ordering and normal View disposal. This declaration correction changes no
runtime constructor or callable/extend implementation.

### Expressions inside schema value arrays

In schema field props, DOM attributes, and component props, ordinary arrays
are literal. Plain objects still resolve expression properties, but arrays
inside those objects are literal too. Prefix the property that owns the
array with `__deep__` to resolve expressions throughout its nested arrays and
plain objects. The prefix is removed from the output property name:

```js
const schema = [{
  $formkit: 'select',
  name: 'fruit',
  '__deep__options': [{ value: 'apple', label: '$appleLabel' }],
}];
```

Thus `options: ['$5', '$10']` is a literal array. A `__raw__` property
remains literal even within a deep value, and explicit properties override
the same normalized property from `bind`. Schema children and loop
declarations are not attribute value arrays. Use `__deep__` on the
expression-bearing property within a conditional bag; as in upstream
FormKit 2.9, a prefix on the outer conditional property does not propagate
deep mode through the selected branch.

Earlier Marionette candidates eagerly resolved expression strings inside
unprefixed schema value arrays. If a schema relied on that behavior, prefix
its intended property with `__deep__` before adopting this candidate.

### Scoped component slots

A schema component can declare named outlets with `$cmp` and `slots`.
Ordinary `children` are the default content. A non-null authored `slots.default`
overrides that content; a null or undefined entry falls back. Outlets do not
create DOM or Core nodes until the factory renders them.

```js
const schema = [{
  $cmp: 'Panel',
  children: ['Default body'],
  slots: { heading: [{ $el: 'h2', children: '$title' }] },
}];

const components = {
  Panel({ host, renderChildren, renderSlot }) {
    const heading = renderSlot('heading', host, null, { title: 'Welcome' });
    renderChildren(); // still renders the resolved default and returns a disposer
    return {
      update(props) {
        heading?.update({ title: props.title ?? 'Welcome' });
      },
    };
  },
};
```

`renderSlot` returns undefined when there is no matching content. Each call
owns its own outlet. `update(data)` replaces that outlet's local data: explicit
slot data takes precedence over enclosing loop variables and outer schema data.
An omitted key restores the outer binding. `destroy()` releases the outlet; the
component owner also releases any outlets it still owns at teardown. The legacy
FormKit named `children` bag remains supported. On built-in FormKit inputs,
authored entries override matching section names; a section the input never
requests stays unmounted. Existing explicit `props.slots` on the
`FormKitSchema` wrapper take precedence over authored named entries there.

Named content on a `FormKitSchema` wrapper keeps its authoring scope; it does
not receive loop locals from the wrapper's inner schema. For fields whose
factory explicitly mounts an authored outlet, replacing the entire schema
may replace those fields. Their Core registration order is not guaranteed
to match the DOM order of eagerly projected siblings. An empty or null-only
slot map does not change the existing layout path.
