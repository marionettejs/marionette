# Install and render a View

This guide targets Marionette 5.0.0 and is verified on the supported Node LTS lines: Node 22.22.2+ (22.x) or 24.15.0+ (24.x). Use the latest patch of either line. Newer Node versions may install; Node 26 remains advisory until its LTS support is verified. The [documentation index](readme.md) identifies this package version.

## Install matching packages

Use matching `5.0.0` versions of `marionette` and the companion packages: `@mnjs/utils`, `@mnjs/radio`, `@mnjs/adapters`, and optional `@mnjs/data`. Pin the versions explicitly when installing these packages.

## Create the project

Create a project directory:

```sh
mkdir marionette-example
cd marionette-example
npm init -y
npm pkg set type=module scripts.dev="vite" scripts.build="vite build"
npm install --ignore-scripts --save-exact marionette@5.0.0 @mnjs/utils@5.0.0 @mnjs/radio@5.0.0 @mnjs/adapters@5.0.0 lit-html@3.3.3
npm install --ignore-scripts --save-dev --save-exact vite@8.3.0
```

This first UI uses `marionette`, the Lit adapter from `@mnjs/adapters`, and `lit-html`. Core also depends on `@mnjs/utils` and `@mnjs/radio`; the command pins those dependencies to the same release. `@mnjs/data` is optional and is added in the [data setup guide](integrations/setup.md).

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Marionette example</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

Create `main.js`:

```js
import { Region, View, setDomApi } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

setDomApi(LitDomApi);

const WelcomeView = View.extend({
  template: () => html`<h1>Hello, Marionette</h1>`
});

const region = new Region({ el: '#app' });
region.show(new WelcomeView());
```

## Run it

```sh
npm run dev
```

Open the address Vite prints. You should see “Hello, Marionette”. `npm run build` produces a production bundle in `dist`.

The View describes the content. The Region renders and mounts it, then owns replacement and destruction. Calling `region.show(anotherView)` replaces the previous View; `region.empty()` destroys the displayed View.

The Lit DOM adapter is configured once before creating Views. The default renderer calls each template function with its data.

Continue with the [learning progression](readme.md#learn-as-the-feature-grows) for local interaction, data, composition, and Application readiness.
