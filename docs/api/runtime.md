# Runtime configuration

[API index](../api.md) · [Rendering and DOM providers](providers/dom.md) · [Data and state providers](providers/data.md)

A Marionette runtime is a family of classes with shared configuration choices and a Radio instance. The named imports from `marionette` use the default family. Configure that family once for an ordinary application; use `createMarionette()` when independently configured parts or tests must coexist. An [Application](application.md) manages a feature lifetime within either family.

## Configure the default runtime

Import the named setters in your application's setup module, before constructing Views. For example, install the Lit DOM adapter once:

```js
import { View, setDomApi } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

setDomApi(LitDomApi);

const Heading = View.extend({
  template: () => html`<h1>Overview</h1>`,
});
const heading = new Heading().render();
```

The default renderer already calls the template function with its data. Configure a different renderer only when the template engine needs one. The [quick start](../quick-start.md) mounts a View in the page; [setup](../integrations/setup.md) adds observable data when needed.

## Configure an isolated runtime

`createMarionette()` takes no arguments and returns a new runtime. Configure it, then define classes from its constructors. Imports of adapters alone do not install them.

```ts
import { createMarionette } from 'marionette';
import { Model, DataApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const runtime = createMarionette();
runtime.setDataApi(DataApi);
runtime.setDomApi(LitDomApi);

const Heading = runtime.View.extend({
  template: ({ title }: { title: string }) => html`<h1>${title}</h1>`,
  modelEvents: { 'change:title': 'render' },
});

const title = new Model({ title: 'Overview' });
const heading = new Heading({ model: title });
heading.render();
title.set('title', 'Updated overview');
```

The default renderer evaluates the function; Lit inserts its result. DataApi supplies the Model's attributes and subscriptions. Configure StateApi separately if an owner's `stateEvents` or owned-state disposal needs it. The View borrows the Model; its owner manages the Model's lifetime. See [observable data and API access](../integrations/setup.md#observable-data-and-api-access) for the boundary between observation and persistence.

## Choose a configuration scope

| Scope | Effect and return value |
| --- | --- |
| Named `setDomApi`, `setDataApi`, `setStateApi`, `setRenderer`, `setEventDelegator` imports | Configure the affected default classes. Return `undefined`. |
| The same methods on a `createMarionette()` result | Configure only the affected classes in that runtime. Return `undefined`. |
| `SomeClass.set…(...)` | Configure the receiving class's prototype. Return that class for chaining. Descendants inherit unless they have their own override. |

| Setter | Classes configured by a top-level/runtime call | Operation |
| --- | --- | --- |
| `setDomApi(mixin)` | View, CollectionView, Region | Shallow overlay on each class's `Dom`. |
| `setDataApi(mixin)` | View, CollectionView | Shallow overlay on each class's `Data`. |
| `setStateApi(mixin)` | Application, Behavior, View, CollectionView, MnObject | Shallow overlay on each class's `State`. |
| `setRenderer(renderer)` | View, CollectionView | Replace the renderer function. |
| `setEventDelegator(provider)` | View, CollectionView, Behavior | Replace the DOM delegation provider. |

Only the classes listed in each row provide that static setter. Configure before constructing consumers. Setters change prototype configuration, not an instance's already-created element, cached data, or installed subscriptions. They do not rebuild existing instances. A live instance that inherits the slot can use the new provider on its next operation while retaining earlier subscriptions or renderer-owned contents. This can mix incompatible configurations; configuration is not a live migration API. A parent setter can affect subclasses still inheriting that slot; a subclass overlay creates its own provider object and no longer inherits later parent changes to that slot. Configure both a CollectionView and its child View classes when both consume an integration.

Overlays preserve unspecified methods, with the last supplied value winning. They are shallow: nested values and function closures are shared. Explicit `undefined` can remove a required method; an empty overlay does not restore defaults. `setRenderer()` assigns `undefined`, also not a reset. Supply valid providers; setters do not certify runtime compatibility.

## Defaults and exports

| Runtime member | Default and reference |
| --- | --- |
| `Application`, `Behavior`, `CollectionView`, `MnObject`, `Region`, `View` | Constructors in this family. See the [class index](../api.md#core-classes). |
| `DomApi` | Native DOM operations, static descendant queries and HTML-string insertion. [DOM contract](providers/dom.md#domapi). |
| `DataApi` | Plain values for rendering and static arrays for collection membership; compatible `on`/`off` sources for explicit entity events. [Data contract](providers/data.md#dataapi). |
| `StateApi` | No observable-state support or owned disposal by default. `subscribe` throws `MN0037`. [State contract](providers/data.md#stateapi). |
| `Radio` | Default exported Radio for the default family; a new Radio instance for each isolated runtime. [Owner bindings](shared/common.md#declarative-radio-bindings). |
| `VERSION` | The package version string, also available as a named import. |
| `Events`, `extend`, `MarionetteError`, `monitorViewEvents` | Shared utilities, not newly isolated copies. [Events](shared/events.md), [extension](shared/common.md#define-a-class), and [View lifecycle monitoring](view.md#lifecycle-hooks-and-events) describe the relevant contracts; the [utilities reference](../packages/utils.md) and [errors reference](errors.md) cover the standalone exports. |

`createMarionette` is a named export of `marionette`. The package has no default export, and a created runtime does not itself have a `createMarionette` method. `EventDelegator` and `Renderer` are type exports, not provider values. Configure those behaviors through their setters.

`DataApi`, `DomApi`, and `StateApi` expose the initial provider objects. Setters replace class slots with overlays; they do not update these exported objects into a registry of the active configuration. Inspect a class's `prototype.Data`, `prototype.Dom`, or `prototype.State` when needed. Prefer setters over direct mutation.

## Isolation and composition

Each `createMarionette()` starts from copied native defaults, even after configuring the default family. It has separate constructors, provider objects and Radio channels. Changing one family's configured slots or resetting its Radio does not reset another family's configuration/channels. Native Regions created by its Views and Applications, and the CollectionView empty Region, use its own Region class.

Use the appropriate family's constructors for composition:

- A View/Application Region definition cannot borrow a Region or Region class from another runtime (`MN0030`).
- Application child registration requires a child from the same runtime (`MN0031`); a start destination must be a Region from the same runtime (`MN0030`).
- `Region.show(view)` supports a View from another runtime through its supported View lifecycle. It does not convert the View's renderer/data providers or move the Region into that other runtime.

This is configuration isolation. Classes inherit from the library's base classes, utilities and the document remain shared, and providers may close over shared resources. It is not a security boundary or a deep clone of application data. There is no runtime-wide destroy/reset method; destroy the Applications, Regions, Views and other owners you create.

## TypeScript

Use `ReturnType<typeof createMarionette>` for the returned runtime type; there is no named public Runtime type. Runtime methods expose the same class/provider contracts as named imports. Types are structural, so they do not brand objects by runtime; ownership checks still run at runtime.

Provider registration accepts concrete source/output types through an intentionally opaque class slot. It does not prove that every model, template, DOM result, child class or supplied state matches that provider. Keep the concrete adapter typed, configure a coherent class family, and test its consumers. See [DOM types](providers/dom.md#typescript) and [data types](providers/data.md#typescript).
