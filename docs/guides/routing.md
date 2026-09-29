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

When a destination needs readiness or multiple coordinated panels, let the navigation Application manage a child Application in the content Region. Await stopping the previous child before starting the next one, handle failed preparation, and define which navigation may still commit when requests overlap. Use the child's lifecycle signal to cancel preparation. Replacing its visible View alone does not end the child Application's lifetime.

Choose where loading and errors belong and when the URL becomes authoritative. Keep these decisions in the navigation/feature owner. [Application composition](../api/application.md#child-applications) describes managed children; [consumer testing](testing.md) covers cancellation. This synchronous example does not establish an asynchronous transition or unsaved-change policy.

## Check navigation

Test direct links, link clicks, Back/Forward, unknown routes, and repeat selection. Verify shell identity survives page changes, outgoing pages are destroyed, and stop/restart removes and reinstalls one URL subscription. Use a real browser for history and focus behavior.
