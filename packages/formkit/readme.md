# @mnjs/formkit

FormKit schemas, inputs and validation with Marionette View, Region and
Application ownership. This is an unpublished package candidate. It imports
neither React nor Vue; their component objects require explicit DOM factories.

**This integration candidate is not production-ready.** Independent review of
historical `0078606d` confirmed dynamic-list validation and raw identity defects.
Scoped schema review of the supplied `c353a4d6` corrections now clears those
cases and mixed-source ownership. This branch also imports the exact owner's
`cb9db280` formatting and extraction repair. Broader independent review remains
pending; the nested peer-reset sequence and real-browser confirmation remain
unestablished. This isolated follow-on also imports the exact `b4e2a3b8`
runtime lint-cleanup candidate. Scoped independent review approves that cleanup
and strict extraction; broader review remains separate. Package and packed
consumer checks do not establish full readiness, and root-wide active test/tooling
lint remains a blocking gate.

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
public exports, mount/update/destruction and TypeScript consumers. It writes the
report and candidate path to `test/tmp/package-result.json`.

`lint` checks package files and the complete active runtime import graph with the
repository's rules. It fails for production-runtime diagnostics; it does not
exclude them because the source is still under `experiments/`. `coverage` uses the
same build graph, including runtime files outside this package. These focused tests
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
`setSchema` updates schema content.
The compatibility `count` fixture creates required text fields and should not be
used for production declarations. Native actions follow the official form
schema; `formProps: { actions: false }` suppresses them.

The returned `MountedForm` exposes the Core `node` and ordinary Marionette `form`,
plus `getValues`, `setValues`, `getFormState`, `setErrors`, `clearErrors`, `reset`,
`submit`, `setFields`, `setSchema`, `updateData`, `setSlots` and
`setSectionsSchema`. `getValues()` returns a snapshot. `setValues` merges supplied
values; `{ notify: false }` suppresses the adapter change event. Official Core
validation and message visibility determine the rendered messages.

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
A borrowed Region remains borrowed. For raw `defaultConfig: false` pipelines,
exported `bindings` can be combined with explicitly supplied FormKit library
plugins; the raw pipeline must provide its own root form definition and context.

## Scope

Runtime code currently comes from the sole-owned experiment at the verified
revision in [PROVENANCE.md](PROVENANCE.md), while package/build/types/tests live
here. Installed bundles contain that runtime and do not import repository paths.
Runtime relocation and fixes belong to the runtime owner. Free inputs and
portable factories are included; no licensed Pro source or key is shipped.
Consumers can supply separately installed licensed plugins under their own
configuration. Full Vue/React parity, all Pro modes, browser accessibility,
geometry and performance are not certified by this package's tests. The scoped
optional type/name defaults correction at `0078606d` was approved independently;
that scoped approval does not approve the proposed dynamic-list or raw identity
corrections now awaiting independent review.
