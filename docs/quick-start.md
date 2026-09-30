# Install and render a View

This guide targets Marionette 5.0.0-rc.2 with Node 24 or newer. The [documentation index](readme.md) identifies this prerelease candidate.

## Obtain the development candidate

Obtain the five matching `5.0.0-rc.2` candidate tarballs from the maintainer: `marionette`, `@mnjs/utils`, `@mnjs/radio`, `@mnjs/adapters`, and `@mnjs/data`. Put them together in a directory named `marionette-v5-artifacts` in your workspace. The packages are already built; you do not need a framework checkout.

This guide uses supplied local artifacts. A registry installation path for this candidate has not been verified.

## Create the project

From the directory containing `marionette-v5-artifacts`, create the project beside it:

```sh
mkdir marionette-example
cd marionette-example
npm init -y
npm pkg set type=module scripts.dev="vite" scripts.build="vite build"
npm install --ignore-scripts --save-exact ../marionette-v5-artifacts/marionette-5.0.0-rc.2.tgz ../marionette-v5-artifacts/mnjs-utils-5.0.0-rc.2.tgz ../marionette-v5-artifacts/mnjs-radio-5.0.0-rc.2.tgz ../marionette-v5-artifacts/mnjs-adapters-5.0.0-rc.2.tgz lit-html@3.3.3
npm install --ignore-scripts --save-dev --save-exact vite@8.3.0
```

This first UI uses `marionette`, the Lit adapter from `@mnjs/adapters`, and `lit-html`. Core also depends on `@mnjs/utils` and `@mnjs/radio`; installing their local tarballs keeps those dependencies on the same candidate. `@mnjs/data` is optional and is added in the [data setup guide](integrations/setup.md).

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

The Lit DOM adapter is configured once before creating Views. The default renderer calls each template function with its data. Read [setup](integrations/setup.md) when adding observable data. Before adding service calls or coordinating panels, read [ownership and lifetimes](architecture.md). The [records lesson](records.md) applies those concepts in a runnable feature.
