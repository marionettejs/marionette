<h1 align="center">Marionette.js</h1>
<p align="center">
  <img title="Marionette" alt="Marionette logo" src="https://github.com/marionettejs/marionette/raw/master/marionette-mark.svg" width="140" height="145" />
</p>
<p align="center">Built for agent-led development.</p>
<p align="center">
  <a href="https://github.com/marionettejs/marionette/actions/workflows/ci.yml"><img src="https://github.com/marionettejs/marionette/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI status" /></a>
  <a href="https://www.npmjs.com/package/marionette"><img src="https://img.shields.io/npm/v/marionette.svg" alt="npm version" /></a>
</p>

Marionette v5 is a JavaScript library built for agent-led development. It gives
coding agents a consistent structure for building interfaces, version-matched
contracts to work from, and tools to check the code they produce.

The v5 npm package is **`marionette`**; **`backbone.marionette`** is the legacy
package. Check the installed package name and version before choosing documentation.
V5 core has native DOM support and requires neither Backbone nor jQuery. Backbone
Models and Collections integrate through optional adapters, so an existing Backbone
application can keep its Models and persistence. For v4 upgrades, use the
[migration guide](docs/guides/migration.md).

## Why Marionette for agent-led development?

- **Clear places for behavior.** Views render content and handle local interactions.
  Regions own View replacement and destruction. Applications coordinate feature
  readiness and lifetime. These boundaries give an agent a repeatable way to
  compose features and make changes without inventing their ownership from scratch.
- **The relevant contract in context.** Documentation and an agent skill ship with
  the package. API and diagnostic lookup lead to specific contracts; documentation
  MCP access connects those references to supported agent clients.
- **Feedback on generated code.** TypeScript declarations, an ESLint rule against
  private framework access, and stable diagnostic codes help agents catch mistakes.
  Runnable examples and public behavior checks show how to verify interaction, cancellation, replacement, and cleanup.

Start with the [agent entrypoint](docs/agents.md).
[Consumer tooling](docs/tooling.md) covers skill/plugin installation, documentation
MCP access, lint, types, and installed documentation lookup.

## Try v5

Packaged applications are verified on Node 22.22.2+ (22.x) and 24.15.0+ (24.x); use the latest patch of either LTS line. Newer Node versions may install; Node 26 is checked separately as advisory. For framework development or Git installs, select the pinned [source toolchain](https://github.com/marionettejs/marionette/blob/master/CONTRIBUTING.md#set-up-the-repository).
Install matching package versions in your browser application:

```sh
npm install --save-exact marionette@5.0.0 @mnjs/utils@5.0.0 @mnjs/radio@5.0.0 @mnjs/adapters@5.0.0 lit-html@3.3.3
```

Given `<div id="app"></div>` in your page, this module shows a dismissible panel:

```js
import { Region, View, setDomApi } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

setDomApi(LitDomApi);

const Notice = View.extend({
  template: () => html`
    <p>Your report is ready.</p>
    <button type="button">Dismiss</button>`,
  triggers: { 'click button': 'dismiss' }
});

const region = new Region({ el: '#app' });
const notice = new Notice();
region.listenTo(notice, 'dismiss', () => region.empty());
region.show(notice);
```

The View turns a click into intent. The Region renders and mounts the View;
`empty()` destroys it and releases its event connections. Showing another View in
that Region also destroys the previous one. No separate DOM removal or event
unbinding is needed.

The [quick start](docs/quick-start.md) supplies the complete HTML and Vite setup.
Continue with the [Records lesson](docs/records.md) to combine a list, detail panel,
and asynchronous feature lifecycle. Upgrading an existing application? Use the
[v4-to-v5 migration guide](docs/guides/migration.md).

## Documentation

Start with the [v5 documentation index](docs/readme.md), [quick start](docs/quick-start.md), or [API index](docs/api.md). The reference is organized by class and shared contracts; runnable lessons demonstrate selected workflows.

The [testing guide](docs/guides/testing.md) supplies a runnable recipe for checking
interaction, replacement, readiness, and teardown.

## Development

Found an awkward API, a missing example, or a bug that survives a convincing test
suite? Bring a small reproduction. Contributions should start from a focused public
issue that describes the intended behavior and its runtime cost. See
[CONTRIBUTING.md](https://github.com/marionettejs/marionette/blob/master/CONTRIBUTING.md)

## License

Marionette is available under the [MIT license](license.txt).
