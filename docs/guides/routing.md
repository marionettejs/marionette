# Connect navigation to feature ownership

Marionette v5 supplies UI and Application lifecycles. Choose browser navigation or a separate router for URL matching and history. Connect route decisions to the owner that shows or starts the destination feature.

## Keep a shell while changing its content

This small application uses fragment links for two synchronous pages. Its Application owns the shell and the browser subscription; the content Region owns the current page. No data provider is needed. The rendering packages are described in [setup](../integrations/setup.md).

```js
import { Application, View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const PageView = View.extend({
  template: () => html`
    <nav aria-label="Pages"><a href="#home">Home</a> <a href="#about">About</a></nav>
    <main class="content"></main>`,
  regions: { content: '.content' },
}).setDomApi(LitDomApi);
const HomeView = View.extend({
  template: () => html`<h1 tabindex="-1">Home</h1><p>Welcome.</p>`,
}).setDomApi(LitDomApi);
const AboutView = View.extend({
  template: () => html`<h1 tabindex="-1">About</h1><p>About this application.</p>`,
}).setDomApi(LitDomApi);
const NotFoundView = View.extend({
  template: () => html`<h1 tabindex="-1">Page not found</h1>`,
}).setDomApi(LitDomApi);

const NavigationApplication = Application.extend({
  onStart() {
    this.setView(new PageView());
    this.showView();
    this.onHashChange = () => this.showRoute();
    window.addEventListener('hashchange', this.onHashChange);
    this.showRoute({ focus: false });
  },
  showRoute({ focus = true } = {}) {
    const route = window.location.hash || '#home';
    if (route === this.currentRoute) return;
    this.currentRoute = route;
    const Destination = route === '#home' ? HomeView :
      route === '#about' ? AboutView : NotFoundView;
    const destination = new Destination();
    this.getView().showChildView('content', destination);
    const heading = destination.el.querySelector('h1');
    document.title = heading.textContent;
    if (focus) heading.focus();
  },
  onStop() {
    window.removeEventListener('hashchange', this.onHashChange);
    this.currentRoute = undefined;
  },
});

const mount = document.createElement('div');
document.body.append(mount);
const app = new NavigationApplication({ region: { el: mount } });
await app.start();
```

Startup reads the current fragment explicitly, so a direct link to `#about` works. Following a link changes the URL; `hashchange` selects the destination. Browser Back/Forward uses the same path. The shell and its navigation remain mounted while Region replacement destroys the previous page. Repeated dispatch of the same route keeps the current page. Unknown fragments show a separate not-found View.

Each destination updates the document title. Later navigation moves focus to its heading; startup leaves focus alone. Decide the focus policy for your actual navigation, especially when a route update merely filters retained content. A route parameter change need not replace the whole feature: update its owned state or use an explicit [retained refresh](retained-refresh.md) when appropriate.

Stopping destroys the shell and its children and removes the Window listener. Starting again reads the current URL and creates a fresh shell. Native `addEventListener` subscriptions need this explicit cleanup; Marionette's `listenTo` cleanup handles Marionette event sources, not Window subscriptions. Restart also rebuilds the shell, so it is unnecessary for an ordinary page change.

## Choose the URL owner

Fragment navigation is useful for a small standalone application. If an existing host already owns routing, let it select the feature and follow the [existing UI boundary](existing-ui.md). Avoid starting a second global URL listener for an embedded feature.

For path-based routing, configure the server to serve the application entry for valid direct links and reloads. A History API implementation must handle `popstate` for traversal and explicitly dispatch its own `pushState`/`replaceState` transitions: those calls do not emit `popstate`, and changing a fragment through them does not emit `hashchange`. See the browser contracts for [pushState](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) and [hashchange](https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event). Choose a routing library when matching, nested routes, redirects, or transition policies warrant it; Marionette ownership remains the same.

## Route to asynchronous features

When a destination needs readiness, let the navigation Application manage a child Application in the content Region. This independent example expects `GET /pages/home.json` and `GET /pages/about.json` to return `{ "title": string, "body": string }`. It keeps the shell while stopping the previous child run, then replaces the content with loading, the ready page, or an error. These Views share one Region, so only one is visible.

```js
import { Application, View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const ShellView = View.extend({
  template: () => html`
    <nav aria-label="Pages"><a href="#home">Home</a> <a href="#about">About</a></nav>
    <main class="content"></main>`,
  regions: { content: '.content' },
}).setDomApi(LitDomApi);
const MessageView = View.extend({
  template: ({ title, body }) => html`<h1>${title}</h1><p role="status">${body}</p>`,
}).setDomApi(LitDomApi);
const ContentView = View.extend({
  template: ({ title, body }) => html`<h1>${title}</h1><p>${body}</p>`,
}).setDomApi(LitDomApi);
const ErrorView = View.extend({
  template: ({ message }) => html`
    <h1>Could not load page</h1><p role="alert">${message}</p>
    <button type="button" class="retry">Retry</button>`,
  triggers: { 'click .retry': 'retry' },
}).setDomApi(LitDomApi);

const PageApplication = Application.extend({
  async prepareStart({ route }, { signal }) {
    const response = await fetch(`/pages/${route.slice(1)}.json`, { signal });
    if (!response.ok) throw new Error('The page request failed.');
    return response.json();
  },
  onStart(_app, _options, page) {
    this.showView(new ContentView({ model: page }));
  },
});

const NavigationApplication = Application.extend({
  childApps: { page: PageApplication },
  onStart() {
    this.showView(new ShellView());
    this.navigation = {};
    this.onHashChange = () => {
      this.navigationTask = this.showRoute();
      this.navigationTask.catch(error => console.error(error));
    };
    window.addEventListener('hashchange', this.onHashChange);
    this.onHashChange();
  },
  async showRoute() {
    if (!this.isRunning() || !this.navigation) return false;
    const route = window.location.hash || '#home';
    if (route === this.currentRoute) return false;
    this.currentRoute = route;
    const navigation = this.navigation = {};
    const isCurrent = () => this.isRunning() && this.navigation === navigation;
    const child = this.getChildApp('page');
    if (!await child.stop() || !isCurrent()) return false;
    const region = this.getView().getRegion('content');
    if (route !== '#home' && route !== '#about') {
      region.show(new MessageView({ model: {
        title: 'Page not found', body: 'Choose Home or About.',
      } }));
      return true;
    }
    region.show(new MessageView({ model: {
      title: 'Loading page…', body: 'Please wait.',
    } }));
    try {
      const started = await child.start({ region, route });
      return started && isCurrent();
    } catch (error) {
      if (!isCurrent()) return false;
      if (!await child.stop() || !isCurrent()) return false;
      this.currentRoute = undefined;
      const errorView = new ErrorView({ model: { message: error.message } });
      this.listenTo(errorView, { retry: this.onHashChange });
      region.show(errorView);
      return false;
    }
  },
  onBeforeStop() {
    this.navigation = undefined;
    this.currentRoute = undefined;
    window.removeEventListener('hashchange', this.onHashChange);
  },
});

const mount = document.createElement('div');
document.body.append(mount);
const app = new NavigationApplication({ region: { el: mount } });
await app.start();
```

The URL selects the destination as soon as it changes. A failed request keeps that URL and shows an error View; Retry dispatches the current URL again. An unknown fragment shows a not-found View. Repeating a route that is loading or ready leaves it alone.

The owner stops the outgoing child before starting the next destination. Only the newest navigation may continue after an await. The child's preparation signal cancels its request, and superseded preparation cannot activate even if the transport ignores abort. A rejected start is stopped before error presentation replaces its UI.

`await app.start()` activates the shell; `navigationTask` tracks the separately started page transition. The child loads readiness data in `prepareStart` and renders it in `onStart`.

Stop is unconditional here: `onBeforeStop` ends navigation authority and the Window subscription before child teardown. Stop destroys the shell; restart creates a fresh one and reads the current URL. Destroy also disposes the registered child. See [Application composition](../api/application.md#child-applications) and [consumer testing](testing.md).

## Check navigation

Test direct links, link clicks, Back/Forward, unknown routes, and repeat selection. Verify shell identity survives page changes, outgoing pages are destroyed, and stop/restart removes and reinstalls one URL subscription. Use a real browser for history and focus behavior.
