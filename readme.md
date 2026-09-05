<h1 align="center">Marionette.js</h1>
<p align="center">
  <img title="Marionette" alt="Marionette logo" src="https://github.com/marionettejs/marionette/raw/master/marionette-logo.png" />
</p>
<p align="center">Pull a few strings. Give your interface some structure.</p>
<p align="center">
  <a href="https://github.com/marionettejs/marionette/actions/workflows/ci.yml"><img src="https://github.com/marionettejs/marionette/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI status" /></a>
  <a href="https://www.npmjs.com/package/marionette"><img src="https://img.shields.io/npm/v/marionette.svg" alt="npm version" /></a>
</p>

Marionette is a JavaScript library for building interfaces whose parts have clear
jobs. Views render content and handle interactions. Regions give those Views a place
to appear, change, and leave. Applications bring features together and coordinate
the work that starts and stops with them.

Start with native DOM APIs, plain objects, and function templates. Choose other data,
state, and rendering tools as your application needs them.

## A place for the next change

Adding a detail panel, updating a list, or stopping a feature should have a
recognizable approach:

- **Build a screen** with a [View](docs/marionette.view.md).
- **Replace part of it** through a named [Region](docs/marionette.region.md).
- **Repeat rows or cards** with a [CollectionView](docs/marionette.collectionview.md).
- **Share an interaction** through a [Behavior](docs/marionette.behavior.md).
- **Start and stop a feature** with an [Application](docs/marionette.application.md).

Those same patterns give an agent a place to make a change and give you something
specific to review. Marionette v5 is being developed with agent-led work in mind:
consistent APIs, public types, and guidance that connects a task to the code it needs.

We're optimistic about agents. We've also read the diffs.

## Trying v5

The v5 pre-release is under active development. These guides describe the current
source; published alphas can lag behind it. Stable v5 will ship only after
the public correctness, agent-development, packaging, browser, and performance gates
in the [project roadmap](ROADMAP.md) pass.

## Install

```sh
npm install marionette
```

```js
import { View } from 'marionette';

const GreetingView = View.extend({
  el() {
    return document.querySelector('#app');
  },
  template: () => '<h1>Hello</h1>'
});

new GreetingView().render();
```

Marionette core has no required peer dependencies. Install optional peers only when
the application uses their corresponding integration:

- [Observable Model and Collection sources](docs/data.api.md#optional-marionettedata-sources)
- [Backbone data and event integration](docs/optional-backbone.md)
- [jQuery DOM adapter](docs/installation.md#jquery-dom-adapter-is-optional)

Applications that use Underscore directly, such as with `_.template`, must declare
`underscore` as their own dependency.

See [installation](docs/installation.md) for package entrypoints and supported setup.

## Documentation

- [Documentation index](docs/readme.md)
- [Installation and package entrypoints](docs/installation.md)
- [Classes and their jobs](docs/classes.md)
- [Rendering and templates](docs/view.rendering.md)
- [State and observation](docs/marionette.state.md)
- [Data and integrations](docs/data.api.md)
- [Lifecycle and cleanup](docs/view.lifecycle.md)
- [Upgrade guide](upgradeGuide.md)

The API reference is being reconciled for stable v5 in
[issue #147](https://github.com/marionettejs/marionette/issues/147). Until that
work is complete, the repository's v5 guides above are canonical; the hosted
`/docs/current` site describes earlier releases.

## Development

Found an awkward API, a missing example, or a bug that survives a convincing test
suite? Bring a small reproduction. Contributions should start from a focused public
issue that describes the intended behavior and its runtime cost. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the [v5 roadmap](ROADMAP.md).

```sh
npm ci
npm test
npm run lint:ci
npm run coverage
npm run test:fixtures
npm run size
npm run performance:timing
```

## License

Marionette is available under the [MIT license](license.txt).
