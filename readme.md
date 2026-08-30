<h1 align="center">Marionette.js</h1>
<p align="center">
  <img title="Marionette" alt="Marionette logo" src="https://github.com/marionettejs/marionette/raw/master/marionette-logo.png" />
</p>
<p align="center">Explicit Views, Regions, lifecycle, and application structure.</p>
<p align="center">
  <a href="https://github.com/marionettejs/marionette/actions/workflows/ci.yml"><img src="https://github.com/marionettejs/marionette/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI status" /></a>
  <a href="https://www.npmjs.com/package/marionette"><img src="https://img.shields.io/npm/v/marionette.svg" alt="npm version" /></a>
</p>

Marionette is a lightweight application framework for building structured interfaces
with deterministic lifecycle, named composition boundaries, and explicit ownership.
It works with native DOM APIs by default. Backbone models and collections and a jQuery
DOM adapter are available as optional integrations.

The current v5 pre-release is under active development. Stable v5 will ship only after
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

- [Backbone models, collections, and shim](docs/optional-backbone.md)
- [jQuery DOM adapter](docs/installation.md#jquery-dom-adapter-is-optional)

See [installation](docs/installation.md) for package entrypoints and supported setup.

## Documentation

- [Documentation index](docs/readme.md)
- [Installation and package entrypoints](docs/installation.md)
- [Optional Backbone integration](docs/optional-backbone.md)
- [Pre-rendered DOM](docs/dom.prerendered.md)
- [Phase 0 performance baselines](docs/performance-baselines.md)
- [v4-to-v5 compatibility ledger](docs/migration-from-v4.md)
- [Upgrade guide](upgradeGuide.md)

The API reference is being reconciled for stable v5 in
[issue #147](https://github.com/marionettejs/marionette/issues/147). Until that
work is complete, the repository's v5 guides above are canonical; the hosted
`/docs/current` site describes earlier releases.

## Development

Contributions should start from a focused public issue with an explicit behavior and
runtime-cost boundary. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[agent-ready v5 roadmap](ROADMAP.md).

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
