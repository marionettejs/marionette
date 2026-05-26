# Installing Marionette

As with all JavaScript libraries, there are a number of ways to get started with
a Marionette application. In this section we'll cover the most common ways.
While some integrations are listed here, more resources are available in the integrations repo:
[marionette-integrations](https://github.com/marionettejs/marionette-integrations)

## Documentation Index

* [Install](#install)
* [Peer dependencies](#peer-dependencies)
* [Quick start](#quick-start)
* [Backbone is optional](#backbone-is-optional)
* [jQuery DOM adapter is optional](#jquery-dom-adapter-is-optional)
* [NPM and Webpack](#quick-start-using-npm-and-webpack)
* [NPM and Brunch](#quick-start-using-npm-and-brunch)
* [NPM and Browserify](#quick-start-using-npm-and-browserify)
* [Browserify and Grunt](#browserify-and-grunt)
* [Browserify and Gulp](#browserify-and-gulp)
* [Getting Started](./basics.md)

## Install

The v5 package name is `marionette`.

```bash
npm install marionette
```

> The v4 package name has changed. See the [upgrade guide](../upgradeGuide.md)
> for migration guidance from earlier releases.

## Peer dependencies

Marionette v5 declares the following peer dependencies. Only Underscore is
required; the rest are optional.

| Peer | Required? | When you need it |
|---|---|---|
| `underscore` `^1.13.0` | Required | Always. Marionette publishes named ESM imports from `underscore`, and versions before 1.13 are CJS-only with no package `exports` map, so modern Node and bundler ESM resolution cannot satisfy the imports. |
| `backbone` `^1.4.0` | Optional | Only if your app uses Backbone models/collections, or imports the bundled `marionette/backbone` shim. See [Backbone is optional](#backbone-is-optional). |
| `jquery` `^3.5.0` | Optional | Only if your app uses the `marionette/jquery-dom-api` adapter. See [jQuery DOM adapter is optional](#jquery-dom-adapter-is-optional). |

Install the required peer alongside Marionette:

```bash
npm install marionette underscore
```

Optional peers are installed only when you opt into them:

```bash
# Only if you use Backbone models/collections or the bundled shim
npm install backbone

# Only if you use the jQuery DomApi adapter
npm install jquery
```

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

app.start();
```

`View` and `CollectionView` accept a DOM element for `el`. They do not resolve
selector strings — pass `document.querySelector('#root')` at the call site. See
the [upgrade guide](../upgradeGuide.md) for the migration entry. `Region` continues
to accept selector strings.

## Backbone is optional

Starting with v5, Marionette core does not depend on Backbone at runtime. Backbone is one valid implementation of the model and collection contracts Marionette consumes; any object that satisfies those contracts works equally well. Applications that want the v4-style Backbone integration can opt in with a side-effect import of the bundled shim:

```javascript
import 'marionette/backbone';
```

See [Optional Backbone](./optional-backbone.md) for the model/collection protocol and a small non-Backbone adapter example.

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
adapter. The adapter intentionally does not restore `view.$el`; legacy apps
that still depend on `$el` should set it in their own view layer. See the
[upgrade guide](../upgradeGuide.md) for the migration entries on jQuery DOM
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

[Continue Reading...](./basics.md).

Additionally check out [features](./features.md) for some configurable options.
