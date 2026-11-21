# @mnjs/formkit

FormKit schemas, inputs and validation with Marionette View, Region and
Application ownership. This is a private, unpublished workspace candidate. It imports
neither React nor Vue; their component objects require explicit DOM factories.

The frozen `5fa30f06` candidate has independent approval for scoped PR
integration. Its root lint, default verification, 106 acceptance cases, 138
Vue/React/adapter references, package coverage, packed ESM/CJS consumers and
strict type consumers passed for that frozen revision under Node 24.19.0/npm 11.17.0. The dynamic-list,
raw identity, mixed ownership and dependency-pruning corrections are included.
This is an unpublished candidate, not browser, Pro, performance or release
certification. Exact-source Pro tests executed: zero. Current browser assets
remain unavailable; prior browser receipts retain their historical source.
Active watcher pruning does not remove all inert Core event history: the
independent probe records 73 slots versus 41 at baseline. No complete memory
or garbage-collection guarantee is claimed. See [PROVENANCE.md](PROVENANCE.md).

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
the workspace-built Marionette (including `setUnsafeHtml`) and locally installed
open-source dependencies without registry access, then verifies both module systems,
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
`.mts` and CommonJS `.cts` consumer fixtures verify the package declarations,
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
Core context messages. Summary links navigate to fields. The portable `FormKitIcon`
helper sanitizes SVG with a conservative vocabulary. Stock field icon sections use
trusted markup instead: only pass trusted SVG through field icon props or supply
trusted sources through `icons`, `iconLoader`, `iconLoaderUrl`, or a theme. They
do not go through the portable helper sanitizer. These portable behaviors do not
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

Raw sections require a Marionette provider with `DomApi.setUnsafeHtml`, as in
workspace Core containing `4df53edb`. Older providers without it cannot render
raw sections; there is no native fallback. This package stays private until
Marionette 5.2.0 ships with that method. `^5.2.0` is the planned publication peer
range, not a claim that the release exists or that registry integration has been
verified. Verify the published peer with a fresh install before removing the
publication guard and changing the range.

Actual HtmlDomApi parent/Region integration and browser focus/IME behavior require
separate verification; configured-provider JSDOM controls do not establish them.
