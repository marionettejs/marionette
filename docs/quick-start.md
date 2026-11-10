# Install and render a View

This guide targets Marionette 5.0.1 and is verified on the supported Node LTS lines: Node 22.22.2+ (22.x) or 24.15.0+ (24.x). Use the latest patch of either line. Newer Node versions may install; Node 26 remains advisory until its LTS support is verified. The [documentation index](readme.md) identifies this package version.

## Install matching packages

Use matching `5.0.1` versions of `marionette`, `@mnjs/utils`, `@mnjs/radio`, and any optional `@mnjs/adapters` or `@mnjs/data` packages you use. Pin the versions explicitly when installing these packages. The independently versioned renderer below does not need `@mnjs/adapters`.

## Create the project

For a greenfield project with no stack chosen, this is the recommended Vite and `@mnjs/html`
setup. In an existing project, follow its compatible renderer, data runtime, router,
build setup, and architecture. For a whole application, page, or composed feature,
continue with the compact [composition starter](guides/composition.md) after the
first render below. It combines managed Views/Regions, lists and feature readiness,
with focused links for deeper needs; the first View is not a complete application template.

`@mnjs/html` is independently versioned from core. This recipe pins version `0.1.0`; use its matching package documentation.

Create a project directory:

```sh
mkdir marionette-example
cd marionette-example
npm init -y
npm pkg set type=module scripts.dev="vite" scripts.build="vite build"
npm install --ignore-scripts --save-exact marionette@5.0.1 @mnjs/utils@5.0.1 @mnjs/radio@5.0.1 @mnjs/html@0.1.0
npm install --ignore-scripts --save-dev --save-exact vite@8.3.0
```

This first UI uses `marionette`, `html` from `@mnjs/html`, and its `@mnjs/html/marionette` DOM adapter. Core also depends on `@mnjs/utils` and `@mnjs/radio`; the command pins those dependencies to the same release. `@mnjs/data` is optional and is added in the [data setup guide](integrations/setup.md).

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
import HtmlDomApi from '@mnjs/html/marionette';
import { html } from '@mnjs/html';

setDomApi(HtmlDomApi);

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

Configure `HtmlDomApi` once before creating Views. The default renderer calls each template function with its data; `HtmlDomApi` updates the View's contents. Use View `events`/`triggers`/`ui` for interactions. `@mnjs/html` rejects `@event` and event-handler property bindings; ordinary values, attributes and non-handler properties remain template data.

Continue with the [composition starter](guides/composition.md) for a whole application, page or composed feature; the [learning progression](readme.md#learn-as-the-feature-grows) offers deeper lessons.
