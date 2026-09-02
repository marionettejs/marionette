# Installing Marionette

As with all JavaScript libraries, there are a number of ways to get started with
a Marionette application. In this section we'll cover the most common ways.
While some integrations are listed here, more resources are available in the integrations repo:
[marionette-integrations](https://github.com/marionettejs/marionette-integrations)

## Documentation Index

* [Install](#install)
* [Peer dependencies](#peer-dependencies)
* [Quick start](#quick-start)
* [Distribution formats](#distribution-formats)
* [Backbone is optional](#backbone-is-optional)
* [jQuery DOM adapter is optional](#jquery-dom-adapter-is-optional)
* [NPM and Webpack](#quick-start-using-npm-and-webpack)
* [NPM and Brunch](#quick-start-using-npm-and-brunch)
* [NPM and Browserify](#quick-start-using-npm-and-browserify)
* [Browserify and Grunt](#browserify-and-grunt)
* [Browserify and Gulp](#browserify-and-gulp)
* [Current v5 documentation](./readme.md)

## Install

The v5 package name is `marionette`.

```bash
npm install marionette
```

> The v4 package name has changed. See the [upgrade guide](../upgradeGuide.md)
> for migration guidance from earlier releases.

## Peer dependencies

Marionette v5 core has no required peer dependencies. The declared peers are
optional integrations.

| Peer | Required? | When you need it |
|---|---|---|
| `backbone` `^1.4.0` | Optional | Only if your app imports the bundled `marionette/backbone` integration. See [Backbone is optional](#backbone-is-optional). |
| `@types/backbone` `^1.4.23` | Optional | TypeScript declarations for `marionette/backbone`. JavaScript consumers do not need it. |
| `jquery` `^4.0.0` | Optional | Only if your app uses the `marionette/jquery-dom-api` adapter. See [jQuery DOM adapter is optional](#jquery-dom-adapter-is-optional). |
| `@types/jquery` `^4.0.1` | Optional | TypeScript declarations for `marionette/jquery-dom-api`. JavaScript consumers do not need it. |

Optional peers are installed only when you opt into them:

```bash
# Only if you use the bundled Backbone integration
npm install backbone

# Only if you use the jQuery DomApi adapter
npm install jquery
```

Npm does not install missing optional peers. TypeScript consumers of an optional
subpath must install its matching type package explicitly:

```bash
# Only if TypeScript imports marionette/backbone
npm install --save-dev @types/backbone@^1.4.23

# Only if TypeScript imports marionette/jquery-dom-api
npm install --save-dev @types/jquery@^4.0.1
```

Marionette core does not import or require Underscore. Install it as an
application dependency only when your own code uses it, such as an `_.template`
used by a View.

## Quick start

Marionette v5 exposes its public API through named ESM imports. There is no
default-namespace export; use named imports only.

```js
import { Application, View, Region } from 'marionette';

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
import 'marionette/backbone';
```

See [Data API](./data.api.md) for the neutral runtime contract and
[Optional Backbone](./optional-backbone.md) for the bundled integration.

## jQuery DOM adapter is optional

Marionette v5 core is jQuery-free. The default DOM API uses native browser
methods, and `view.$(selector)` returns a `NodeList`.

Applications that want jQuery-shaped results from Marionette's DOM helpers —
for example, `view.$(selector)` returning a jQuery collection — can opt into
the optional `marionette/jquery-dom-api` adapter at app boot:

```javascript
import { setDomApi } from 'marionette';
import JQueryDomApi from 'marionette/jquery-dom-api';

setDomApi(JQueryDomApi);
```

The adapter imports `jquery`, so `jquery` is only required when you install the
adapter. It restores `$el` on View, CollectionView, and Behavior instances and
keeps the wrapper synchronized with the owning View's `setElement()` calls. See
the [upgrade guide](../upgradeGuide.md) for the migration entries on jQuery DOM
compatibility and the `detachContents` policy.

## Quick start using NPM and Webpack
[NPM](https://www.npmjs.com/) is the package manager for JavaScript.

Installing with NPM through command-line interface
```bash
npm install marionette
```

[Webpack][webpack] is a build tool that makes it easy to pull your dependencies
together into a single bundle to be delivered to your browser's `<script>` tag.
It works particularly well with Marionette and jQuery.

[Here](https://github.com/marionettejs/marionette-integrations/tree/master/webpack)
we prepared simple marionettejs skeleton with Webpack.


## Quick start using NPM and Brunch

[Brunch][brunch] is fast front-end web app build tool with simple declarative config,
seamless incremental compilation for rapid development, an opinionated pipeline
and workflow, and core support for source maps.

[Here](https://github.com/marionettejs/marionette-integrations/tree/master/brunch)
we prepared simple marionettejs skeleton with Brunch.


## Quick start using NPM and Browserify

[Browserify][browserify] is a build tool that makes it easy to bundle NPM
modules into your application, so you can `require` them as you would import
dependencies in any other language.

[Here](https://github.com/marionettejs/marionette-integrations/tree/master/browserify)
we prepared simple marionettejs skeleton with Browserify.

### Browserify and Grunt

[Grunt][grunt] is task runner. [Here](https://github.com/marionettejs/marionette-integrations/tree/master/browserify-grunt) is simple Browserify + Grunt skeleton.

### Browserify and Gulp

[Gulp][gulp] is streaming build system. [Here](https://github.com/marionettejs/marionette-integrations/tree/master/browserify-gulp) is simple Browserify + Gulp skeleton.


[browserify]: http://browserify.org/
[webpack]: https://webpack.github.io/
[brunch]: http://brunch.io/
[grunt]: http://gruntjs.com/
[gulp]: http://gulpjs.com/

## Getting Started

After installing Marionette you might want to check out the basics.

[Continue reading the current v5 documentation](./readme.md).
