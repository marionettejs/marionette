# Scoped providers in one form

The portable factory library includes `FormKitProvider` and `FormKitLazyProvider`.
They render their descendants into the existing form or group. They create no
Core container and no additional `<form>` element. The schema layout projector
keeps these boundaries and their sibling arrays in the same Core ownership scope
opaque, so siblings and provider fields allocate in declaration order. Nested
group/list owners keep their separate projection boundary. This preserves initial
list values without moving Core nodes after creation. Async children retain the
upstream late-append Core order, while the DOM remains in declaration order.
Aliases to the same provider factory retain that behavior.

```js
import { mount, defaultConfig } from './index.mjs';
const scoped = defaultConfig({ inputs: { uniqueInput: definition } });
const form = mount({ host, schema: [
  { $formkit: 'text', name: 'outside' },
  { $cmp: 'FormKitProvider', props: { __raw__config: scoped }, children: [
    { $formkit: 'uniqueInput', name: 'inside', validation: 'required' },
    { $cmp: 'FormKitLazyProvider',
      props: { configFile: '/unused-because-scope-exists.mjs' },
      children: { $formkit: 'uniqueInput', name: 'inherited' } }
  ] }
] });
```

`FormKitProvider.config` takes configured portable options or a synchronous
factory returning them. Use this adapter's `defaultConfig`, whose bindings target
the portable renderer; Vue and React default configs contain their own bindings.
A falsy config passes through the nearest options scope. Replacement configs
apply to newly mounted descendants. Existing Core nodes keep their identity,
value, plugins, and configuration, as in React's `useInput` node ownership.
Mutable Core `rootConfig` continues to use official reactive propagation.

A `FormKitLazyProvider` with an inherited options scope bypasses loading and
`defaultConfig`, like both official adapters. `FormKitApplication.getFormOptions`
also carries this scope when used to create a View or passed through `mount`.
A plain synchronous form is not itself an options provider. If inherited options become available while a child loader is pending, its Application cancels obsolete activation and uses that scope without waiting for the old module. If an inherited scope is later removed, the old child scope is disposed and an Application loads this boundary's own configFile. These transitions follow React's replacement-provider behavior; Vue captures provider options at setup. The Application is created only when own loading is needed and is reused across later transitions. The old module may finish evaluation, but its obsolete factory and child creation are suppressed.

Without a scope, LazyProvider owns a nonvisual Marionette Application.
`configFile` is a dynamic-import URL, relative to `provider-components.mjs` when
relative; prefer an absolute module URL. It accepts a module's default object,
default synchronous config factory, or named-export namespace. Defaults are
applied unless `defaultConfig: false`; a raw config must supply its own library
and bindings where the Core parent does not supply them. Only descendants wait:
siblings, the form owner, initial values, and parent validation remain live.

Use `onProvider(application)` to retain the ordinary public Application. Its
`start()` Promise observes initial readiness, `restart({configFile})` retries or
loads replacement options, and `stop()` removes its descendants. Active restart
keeps existing descendants and values and supplies new options to future fields.
The View emits `provider:ready(application)` and
`provider:error(error, application)` for the initial load. Explicit `start` and
`restart` calls return their usual observable/rejecting Promises. Configuration
errors do not create descendant Core nodes. Removing the boundary or destroying
the form destroys its Application and prevents late factory or DOM/Core work.
Module evaluation itself cannot be cancelled.

Provider props forward to immediate children, with explicit child props taking
precedence. Direct DOM children receive attributes; their descendants do not
inherit those attributes. Lazy loading keys and `onProvider` are consumed by the
provider. Changing `configFile` or `defaultConfig` triggers Application restart,
retaining existing nodes/values while supplying replacement options to future
fields. Inherited scopes continue to bypass loading.

The optional factory argument `configScope` carries the nearest portable scope.
`locals`, `schemaData`, and `schemaChildren` retain lexical data and named slots
for FormKit inputs rendered inside opaque boundaries.
A factory can pass a scope to `renderChildren` through its lexical slot data;
this is internal to the provider implementation and does not change Core parent
selection. `renderChildren(target, before, slotData, inheritedProps)` additionally
accepts an optional function returning props for immediate children. Only
provider factories use this optional argument; existing factories are unchanged. Section renderers and named root slots forward the scope.

## Verified upstream precedence and limits

Installed exact `@formkit/vue`, `@formkit/react`, `@formkit/core`, and supporting
FormKit packages are version 2.5.0. `nested-provider-upstream.mjs vue|react` runs
actual adapters and gives matching results for the same nested form:

- All five fields have the same root Core parent and there is one form element.
- The inner provider adds a unique input and its custom plugin.
- The outer Core parent's library redefines a common type to the outer input.
- Outer locale/root classes remain inherited; inner explicit input delay applies.
- LazyProvider under the inner scope does not import an invalid configFile.

These are Core contracts, not adapter gaps. Sources: `useInput`,
`normalizeOptions`, `FormKitProvider` and `FormKitConfigLoader` in the installed
React distribution; Vue's `useConfig`/provider setup; Core `nodeInit`, `use`,
`add`, `findDefinition`, and `createConfig`; Inputs `createLibraryPlugin`.

The portable boundary intentionally exposes Marionette Application readiness and
error handling; it does not implement Vue Suspense or React contexts. Vue's
Provider config is captured during setup; React reacts to replacement options
for future inputs. The portable provider uses React's replacement-options and loader-reload
semantics; Vue captures its Provider config and loader setup initially. Both
official adapters may still call a pending imported config factory after unmount;
the Application signal prevents this late call in the portable implementation.
The module's own evaluation remains unavoidable. These are host lifecycle
choices, not claims that Vue or React component objects run here.

`nested-provider-test.mjs` verifies the above scope behavior plus nested native
groups, delayed value hydration, validation aggregation, aliases/keyed loops,
rejection/retry, active reload identity, and exact node/Application cleanup.
JSDOM evidence establishes portable DOM/Core behavior, not real-browser layout,
focus, performance, or real-device behavior.

Child-scope construction disposes its newly allocated DOM/Core resources if rendering throws before a disposer can be returned. The original construction error remains observable; stop/retry does not accumulate failed fields. Ordinary callback failures still do not imply arbitrary rollback or attempt-all cleanup.
