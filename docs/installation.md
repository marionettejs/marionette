# Installing Marionette

Install the core package, show a View, then add the integrations your application
needs. Native DOM APIs, plain objects, and function templates work out of the box.

This guide describes the current v5 source. Published alphas may lag behind it;
see [contributor setup](https://github.com/marionettejs/marionette/blob/master/CONTRIBUTING.md#set-up-the-repository) to build and pack
an unreleased checkout locally.

## Documentation Index

* [Install](#install)
* [Peer dependencies](#peer-dependencies)
* [Quick start](#quick-start)
* [TypeScript](#typescript)
* [Independent runtimes](#independent-runtimes)
* [Observable data sources](#observable-data-sources)
* [Distribution formats](#distribution-formats)
* [Backbone is optional](#backbone-is-optional)
* [jQuery DOM adapter is optional](#jquery-dom-adapter-is-optional)
* [DOM content adapters are optional](#dom-content-adapters-are-optional)
* [Current v5 documentation](./readme.md)

## Install

The v5 package name is `marionette`.

```bash
npm install marionette@5.0.0-beta.1
```

This command becomes available after the beta is published. Use documentation matching that
artifact. To use the current-source APIs described here, [build and pack the
checkout](https://github.com/marionettejs/marionette/blob/master/CONTRIBUTING.md#set-up-the-repository)
and install the package artifacts from that same source revision. A matching
alpha version string alone does not establish that a published package contains
the same APIs as this checkout.

> The v4 package name has changed. See the [upgrade guide](../upgradeGuide.md)
> for migration guidance from earlier releases.

Core and `@mnjs/data` automatically install the matching `@mnjs/utils`
version. Applications do not need a separate install unless they import helpers
directly. During prereleases, keep Marionette packages on the same version. See the
[shared helpers](https://github.com/marionettejs/marionette/blob/master/docs/common.md#shared-helpers) for reusable component helpers.

## Peer dependencies

Marionette v5 core has no peer dependencies. The separate
`@mnjs/adapters` package requires the matching Marionette version and
declares the integration-specific peers as optional.

| Peer | Required? | When you need it |
|---|---|---|
| `marionette` `5.0.0-beta.1` | Required | The matching core runtime configured with an adapter. |
| `backbone` `^1.4.0` | Optional | Only if your app imports `@mnjs/adapters/backbone`. See [Backbone is optional](#backbone-is-optional). |
| `@types/backbone` `^1.4.23` | Optional | TypeScript declarations for `@mnjs/adapters/backbone`. JavaScript consumers do not need it. |
| `jquery` `^4.0.0` | Optional | Only if your app uses the `@mnjs/adapters/dom/jquery` adapter. See [jQuery DOM adapter is optional](#jquery-dom-adapter-is-optional). |
| `@types/jquery` `^4.0.1` | Optional | TypeScript declarations for `@mnjs/adapters/dom/jquery`. JavaScript consumers do not need it. |
| `morphdom` `^2.7.8` | Optional | Only if your app imports `@mnjs/adapters/dom/morphdom`. |
| `lit-html` `^3.3.3` | Optional | Only if your app imports `@mnjs/adapters/dom/lit-html`. |

Optional peers are installed only when you opt into them:

```bash
# Only if you use the Backbone integration
npm install @mnjs/adapters@5.0.0-beta.1 backbone

# Only if you use the jQuery DomApi adapter
npm install @mnjs/adapters@5.0.0-beta.1 jquery

# Only if you use XState actors
npm install @mnjs/adapters@5.0.0-beta.1 xstate
```

The XState actor adapter does not import or declare XState as a peer. Install
XState alongside the adapter; the adapter consumes its public actor shape.

Npm does not install missing optional peers. TypeScript consumers of an optional
subpath must install its matching type package explicitly:

```bash
# Only if TypeScript imports @mnjs/adapters/backbone
npm install --save-dev @types/backbone@^1.4.23

# Only if TypeScript imports @mnjs/adapters/dom/jquery
npm install --save-dev @types/jquery@^4.0.1
```

Marionette core does not import or require Underscore. Install it as an
application dependency only when your own code uses it, such as an `_.template`
used by a View.

## Quick start

Marionette v5 exposes its public API through named ESM imports. There is no
default-namespace export; use named imports only. Add a mount element to the page
before running the module:

```html
<div id="app"></div>
```

```js
import { Application, View } from 'marionette';

const RootView = View.extend({
  template: () => '<div>Hello, Marionette.</div>'
});

const app = new Application({
  region: document.getElementById('app'),
  onStart() {
    this.showView(new RootView());
  }
});

await app.start();
```

`View` and `CollectionView` accept a DOM element for `el`. They do not resolve
selector strings — pass `document.querySelector('#root')` at the call site. See
the [upgrade guide](../upgradeGuide.md) for the migration entry. `Region` continues
to accept selector strings.

## TypeScript

The current v5 source includes declarations for TypeScript 6 and 7, with ESM and
CommonJS entrypoints. Core needs no separate `@types` package. Annotate `initialize`
to describe a View's application options; TypeScript uses that signature to check
construction and `this.options`.

```ts
import { View } from 'marionette';

const MessageView = View.extend({
  template: false,
  initialize(options: { message: string }) {
    this.el.textContent = options.message;
  },
  message(): string {
    return this.options.message;
  }
});

const view = new MessageView({ message: 'Hello, Marionette.' });
document.body.append(view.render().el);
```

This View requires a string `message`. Missing options or a numeric message are
compile errors. `template: false` preserves the text set during initialization.

Named imports work with `NodeNext` or bundler module resolution. The
[consumer TypeScript guide](./typescript.md) covers application options,
DOM events, module resolution, and inheritance choices. Optional
integrations may need their own type packages, listed above.

## Independent runtimes

The named root exports form one default runtime. Use `createMarionette()` only when
independent applications in the same process need isolated classes, adapters,
renderer configuration, or Radio channels:

```javascript
import { createMarionette } from 'marionette';

const isolated = createMarionette();
const IsolatedView = isolated.View.extend({ template: () => 'Independent' });
```

See [Runtime isolation](./runtime-isolation.md) for composition and ownership rules.

## Observable data sources

Core's default DataApi supports plain objects and static arrays without a required
dependency. Backbone Models and Collections are observable sources too; retain
them through the [Backbone adapter](./optional-backbone.md) when the application
already uses them. For a new application needing observable Model and ordered
Collection sources, the optional `@mnjs/data` package is the native choice:

```bash
npm install @mnjs/data@5.0.0-beta.1
```

Configure its adapters before constructing owners. See the
[`@mnjs/data` guide](./data.api.md#optional-mnjsdata-sources) for a
complete adapter setup and rendered list example.

Applications using XState actors can select an ordered array of child actor
references through `@mnjs/adapters/xstate`. See
[XState actors](./data.api.md#xstate-actors).

## Distribution formats

ES modules are the canonical path for new applications. Use `import` syntax so
package export conditions select the ESM entry, and use Marionette's named exports.

Marionette also ships compatibility distributions throughout v5:

- CommonJS supports legacy Node and build-tool consumers through
  `require('marionette')`.
- Unminified and minified UMD builds support no-bundler, AMD, and
  `Marionette`-global consumers.

All four ESM, CommonJS, unminified UMD, and minified UMD outputs remain supported
and distribution-validated for v5. Marionette will not add another format or switch
to unbundled source modules without measured consumer benefit. Six months after
v5.0.0 is published, the distribution review is an evidence checkpoint for a
future major version, not a removal commitment.

## Backbone is optional

Starting with v5, Marionette core does not depend on Backbone at runtime. Plain
objects and arrays use the default DataApi. Applications passing Backbone Models
or Collections to Marionette must configure the Backbone DataApi before
constructing those consumers:

```javascript
import BackboneApi from '@mnjs/adapters/backbone';
import { setDataApi } from 'marionette';

setDataApi(BackboneApi);
```

This configures model and collection use. Select the StateApi role separately
when an owner uses Backbone state; see [Optional Backbone](./optional-backbone.md).
[Data API](./data.api.md) describes the neutral runtime contract.

## jQuery DOM adapter is optional

Marionette v5 core is jQuery-free. The default DOM API uses native browser
methods, and `view.$(selector)` returns a `NodeList`.

Applications that want jQuery-shaped results from Marionette's DOM helpers —
for example, `view.$(selector)` returning a jQuery collection — can opt into
the optional `@mnjs/adapters/dom/jquery` adapter at app boot:

```javascript
import { setDomApi } from 'marionette';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';

setDomApi(JQueryDomApi);
```

The adapter imports `jquery`, so this integration requires `jquery` only when you
select that adapter. If existing code also uses `$el`, assign `this.$el = $(this.el)` in
its View, CollectionView, or Behavior `initialize()` method. See the [upgrade guide](../upgradeGuide.md) for the migration entries on jQuery DOM
compatibility and the `detachContents` policy.

## DOM content adapters are optional

Use the same `@mnjs/adapters` package for incremental rendering. Install
only the DOM library you select:

```bash
npm install @mnjs/adapters@5.0.0-beta.1 morphdom
# or
npm install @mnjs/adapters@5.0.0-beta.1 lit-html
```

Import `MorphdomDomApi` from `@mnjs/adapters/dom/morphdom`, or
`LitDomApi` from `@mnjs/adapters/dom/lit-html`, and pass it to
`ViewClass.setDomApi()` before creating instances. Each adapter preserves unrelated
DOM operations. Lit supplies the attachment hooks its directives need. DataApi and StateApi
configuration remains explicit and separate.

See [Rendering to DOM](https://github.com/marionettejs/marionette/blob/master/docs/view.rendering.md#rendering-to-dom)
for examples and lifecycle requirements.

## Getting Started

[Choose a class for the job](https://github.com/marionettejs/marionette/blob/master/docs/classes.md), or learn the
[shared configuration patterns](https://github.com/marionettejs/marionette/blob/master/docs/basics.md).
