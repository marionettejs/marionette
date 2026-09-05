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
* [Historical starter projects](#historical-starter-projects)
* [Current v5 documentation](./readme.md)

## Install

The v5 package name is `marionette`.

```bash
npm install marionette
```

> The v4 package name has changed. See the [upgrade guide](../upgradeGuide.md)
> for migration guidance from earlier releases.

## Peer dependencies

Marionette v5 core has no peer dependencies. The separate
`@marionette/adapters` package requires the matching Marionette version and
declares the integration-specific peers as optional.

| Peer | Required? | When you need it |
|---|---|---|
| `marionette` `5.0.0-alpha.2` | Required | The matching core runtime configured with an adapter. |
| `backbone` `^1.4.0` | Optional | Only if your app imports `@marionette/adapters/backbone`. See [Backbone is optional](#backbone-is-optional). |
| `@types/backbone` `^1.4.23` | Optional | TypeScript declarations for `@marionette/adapters/backbone`. JavaScript consumers do not need it. |
| `jquery` `^4.0.0` | Optional | Only if your app uses the `@marionette/adapters/dom/jquery` adapter. See [jQuery DOM adapter is optional](#jquery-dom-adapter-is-optional). |
| `@types/jquery` `^4.0.1` | Optional | TypeScript declarations for `@marionette/adapters/dom/jquery`. JavaScript consumers do not need it. |

Optional peers are installed only when you opt into them:

```bash
# Only if you use the Backbone integration
npm install @marionette/adapters backbone

# Only if you use the jQuery DomApi adapter
npm install @marionette/adapters jquery

# Choose only the keyed snapshot store your application uses
npm install @marionette/adapters @reduxjs/toolkit
npm install @marionette/adapters zustand
npm install @marionette/adapters @xstate/store

# Only if you use XState actors
npm install @marionette/adapters xstate
```

The keyed snapshot and XState actor adapters do not import or declare provider
libraries as peers. Install only the provider package already selected by your
application; the adapter consumes its public source shape.

Npm does not install missing optional peers. TypeScript consumers of an optional
subpath must install its matching type package explicitly:

```bash
# Only if TypeScript imports @marionette/adapters/backbone
npm install --save-dev @types/backbone@^1.4.23

# Only if TypeScript imports @marionette/adapters/dom/jquery
npm install --save-dev @types/jquery@^4.0.1
```

Marionette core does not import or require Underscore. Install it as an
application dependency only when your own code uses it, such as an `_.template`
used by a View.

## Quick start

Marionette v5 exposes its public API through named ESM imports. There is no
default-namespace export; use named imports only.

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
[typing guide](https://github.com/marionettejs/marionette/blob/master/CONTRIBUTING.md#typescript-source) covers custom constructors
and the supported combinations of `.extend` and native classes. Optional
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
dependency. Install the optional `@marionette/data` package when the application
wants first-party observable Model and ordered Collection sources:

```bash
npm install @marionette/data
```

Configure its adapters before constructing owners. See the
[`@marionette/data` guide](./data.api.md#optional-marionettedata-sources) for a
copy-pastable isolated-runtime example.

Applications that already use Redux Toolkit, Zustand vanilla stores, XState
Store, or XState actors can select an ordered model array with an explicit
`@marionette/adapters` subpath. See
[Keyed snapshot store adapters](./data.api.md#keyed-snapshot-store-adapters) and
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
objects and arrays use the default DataApi. Applications using Backbone must
select its data and event integration at application boot:

```javascript
import BackboneApi from '@marionette/adapters/backbone';
import { setDataApi, setStateApi } from 'marionette';

setDataApi(BackboneApi);
setStateApi(BackboneApi);
```

See [Data API](./data.api.md) for the neutral runtime contract and
[Optional Backbone](./optional-backbone.md) for the integration.

## jQuery DOM adapter is optional

Marionette v5 core is jQuery-free. The default DOM API uses native browser
methods, and `view.$(selector)` returns a `NodeList`.

Applications that want jQuery-shaped results from Marionette's DOM helpers —
for example, `view.$(selector)` returning a jQuery collection — can opt into
the optional `@marionette/adapters/dom/jquery` adapter at app boot:

```javascript
import { setDomApi } from 'marionette';
import JQueryDomApi from '@marionette/adapters/dom/jquery';

setDomApi(JQueryDomApi);
```

The adapter imports `jquery`, so `jquery` is only required when you install the
adapter. It restores `$el` on View, CollectionView, and Behavior instances and
keeps the wrapper synchronized with the owning View's `setElement()` calls. See
the [upgrade guide](../upgradeGuide.md) for the migration entries on jQuery DOM
compatibility and the `detachContents` policy.

## Historical starter projects

The following projects target `backbone.marionette ~3.0.0`. They remain useful
references for that generation of Marionette. For v5, start with the package and
examples above; copying these projects also brings their older dependencies.

### Quick start using NPM and Webpack

[Webpack starter for Marionette v3](https://github.com/marionettejs/marionette-integrations/tree/master/webpack).

### Quick start using NPM and Brunch

[Brunch starter for Marionette v3](https://github.com/marionettejs/marionette-integrations/tree/master/brunch).

### Quick start using NPM and Browserify

[Browserify starter for Marionette v3](https://github.com/marionettejs/marionette-integrations/tree/master/browserify).

### Browserify and Grunt

[Browserify and Grunt starter for Marionette v3](https://github.com/marionettejs/marionette-integrations/tree/master/browserify-grunt).

### Browserify and Gulp

[Browserify and Gulp starter for Marionette v3](https://github.com/marionettejs/marionette-integrations/tree/master/browserify-gulp).

## Getting Started

[Choose a class for the job](https://github.com/marionettejs/marionette/blob/master/docs/classes.md), or learn the
[shared configuration patterns](https://github.com/marionettejs/marionette/blob/master/docs/basics.md).
