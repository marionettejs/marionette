# Install and render a View

This guide targets Marionette 5.0.0-rc.2 with Node 24 or newer. The [documentation index](readme.md) identifies this prerelease candidate.

## Create the project

Create a directory and place the five supplied candidate tarballs (`marionette`, `@mnjs/utils`, `@mnjs/radio`, `@mnjs/data`, and `@mnjs/adapters`) in its `artifacts` subdirectory. Then run these commands from that project directory:

```sh
npm init -y
npm pkg set type=module scripts.dev="vite" scripts.build="vite build"
npm install --ignore-scripts --save-exact ./artifacts/*.tgz lit-html@3.3.3
npm install --ignore-scripts --save-dev --save-exact vite@8.3.0
```

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
import { Region, View, setDomApi, setRenderer } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

setDomApi(LitDomApi);
setRenderer((template, data) => template(data));

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

The renderer and DOM adapter are configured once before creating Views. Read [setup](setup.md) when adding observable data. Before adding service calls or coordinating panels, read [ownership and lifetimes](architecture.md). The [records lesson](records.md) applies those concepts in a runnable feature.
