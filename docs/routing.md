# Routing with Marionette

Marionette provides Views, Regions, and feature lifecycle. URL matching and browser
history belong to the application. No Marionette router or routing adapter is needed.

## Choose an approach

| Application | Starting point |
| --- | --- |
| New application with a browser policy that supports Navigation API and URLPattern | [Native browser navigation](#use-the-navigation-api) |
| Application using Backbone.Router | [Backbone routing](#connect-backbonerouter) |
| Application requiring a different browser or routing contract | [Other routers](#other-routers) |

The [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
and [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) are
newer than Marionette's Baseline Widely available browser target. Check the
application's minimum browsers before choosing them. Select one routing
implementation for the application.

## Start with a Region

A route handler can simply show a View. This complete module assumes the page
contains `<main id="page"></main>`:

```javascript
import { Region, View } from 'marionette';

const Home = View.extend({ template: () => '<h1>Home</h1>' });
const Help = View.extend({ template: () => '<h1>Help</h1>' });
const page = new Region({ el: '#page' });

export function showPage(name) {
  const Page = name === 'help' ? Help : Home;
  page.show(new Page());
}

export function destroy() {
  page.destroy();
}
```

Connect the matched route to `showPage('home')` or `showPage('help')`.
The Region renders the new View and destroys the previous one. A route change
does not require a new Application.

Add an [Application](./marionette.application.md) when a feature needs a
start/stop boundary or owns child Applications. The following example uses that
boundary to cancel pending page loads on stop and destruction.

## Load the latest page and discard stale work

Save this module as `page-navigation.js`. Supply an existing element and a
`loadPage(id, { signal })` function returning a Promise for `{ title, body }`.
The loader may use fetch, a cache, or local data. Data loading is defined once and
shared by either routing integration below.

This example uses Underscore's template compiler with escaped interpolation
(`<%- ... %>`). Install `underscore` to run it, or use the application's existing
template engine with its HTML escaping enabled. Template choice is independent
of router choice; see [rendering templates](./view.rendering.md).

<!-- executable-example: routing-latest-navigation -->
```javascript
import { Application, View } from 'marionette';
import { template } from 'underscore';

const PageView = View.extend({
  template: template('<h1><%- title %></h1><p><%- body %></p>')
});

export async function createPageNavigation({ el, loadPage }) {
  let pending;

  function cancelPending() {
    pending?.abort();
    pending = undefined;
  }

  const Pages = Application.extend({
    onBeforeStop: cancelPending,
    onBeforeDestroy: cancelPending
  });
  const application = new Pages({ region: { el } });
  await application.start();

  async function navigate(id, { signal } = {}) {
    if (!application.isRunning() || signal?.aborted) return false;

    cancelPending();
    const request = new AbortController();
    pending = request;
    const abort = () => request.abort();
    signal?.addEventListener('abort', abort, { once: true });

    try {
      const page = await loadPage(id, { signal: request.signal });
      if (request.signal.aborted || !application.isRunning()) return false;

      application.showView(new PageView({ model: page }));
      return true;
    } catch (error) {
      if (request.signal.aborted || !application.isRunning()) return false;
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (pending === request) pending = undefined;
    }
  }

  return { application, navigate, cancel: cancelPending };
}
```

`navigate()` resolves `true` after displaying the requested page and `false`
when navigation was canceled or the Application was not running. A current
load or render failure rejects. Catch that rejection at the route boundary and
show an error appropriate to the application. Render failures do not promise
that the previous View survives; Region replacement is not transactional.

The check after `await` is required even when the loader accepts an
`AbortSignal`: a cache or another provider may finish work after cancellation.
It also prevents a stale rejection from becoming the current page's error.
The identity check in `finally` keeps an older request from clearing the newer
request's cancellation handle.

This controller owns cancellation for page requests. It does not make every
View lifecycle asynchronous. Use Application readiness hooks for work that
must finish before the *feature* can start; see
[Application lifecycle](./marionette.application.md#application-lifecycle).
Repeated in-flight `start()` or `restart()` calls share their operation Promise,
so changing their options is not a substitute for navigation cancellation.

The optional `signal` connects an external navigation cancellation to the page
request. `cancel()` aborts pending work without removing the displayed View.
These functions belong to this example, not Marionette's public API.

## Use the Navigation API

Save this integration as `browser-navigation.js`. It accepts the feature created
above and a synchronous `onError(error)` callback supplied by the application.
That callback should present the current failure and a retry action in the
application's UI. It must not throw. There is no required status element.

```javascript
export function connectNavigation(feature, onError) {
  const listeners = new AbortController();
  const route = new URLPattern({ pathname: '/pages/:id' });

  function match(url) {
    const destination = new URL(url);
    return destination.origin === location.origin && route.exec(destination.href);
  }

  async function display(result, signal) {
    try {
      return await feature.navigate(
        decodeURIComponent(result.pathname.groups.id), { signal }
      );
    } catch (error) {
      if (!signal?.aborted && !listeners.signal.aborted) onError(error);
      return false;
    }
  }

  navigation.addEventListener('navigate', event => {
    // Leave downloads, forms, and fragment-only navigation to the browser.
    if (event.hashChange || event.downloadRequest !== null) return;
    feature.cancel();
    if (!event.canIntercept || event.formData) return;
    const result = match(event.destination.url);
    if (!result) return;

    event.intercept({
      handler: () => display(result, event.signal)
    });
  }, { signal: listeners.signal });

  // The initial document load does not emit a navigate event to this listener.
  const initial = match(location.href);
  const ready = initial ? display(initial, listeners.signal) : Promise.resolve(false);

  return {
    ready,
    async destroy() {
      listeners.abort();
      feature.cancel();
      await feature.application.destroy();
    }
  };
}
```

Create the feature once, then call `connectNavigation(feature, onError)` and await
its `ready` Promise. The returned object owns the listener and feature; call and
await its `destroy()` when the application releases this integration, including
during hot replacement.

Use ordinary links such as `<a href="/pages/notes">Notes</a>`. For programmatic
navigation, use `navigation.navigate('/pages/notes')`; its `finished` Promise
can reject on cancellation. Back/forward also enters the same handler.

This example intercepts only `/pages/:id`. Other URLs use normal document
navigation, and pending page work is canceled before leaving. The server owns
those destinations and 404 responses. To keep other features in the same
document, extend the application's route dispatcher and explicitly stop the old
feature before starting the new one.

The browser's [navigation signal](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/signal)
cancels the loader when navigation is superseded or stopped. The shared controller
also checks cancellation after loading, so providers that ignore abort cannot
commit stale Views or report stale failures. A current load failure keeps the
previous View and invokes `onError`; the URL has already changed. The application
must make that failure visible and allow retry. This example handles the error,
so a fulfilled browser navigation Promise does not itself prove that loading succeeded.

### Focus, scroll, and direct URLs

The [interception defaults](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/intercept)
let the browser manage focus reset and scroll after the handler settles. Preserve
ordinary fragment links and verify back/forward scroll restoration with real page
content. If the application needs heading focus or a different scroll policy,
implement that explicitly and test it with keyboard navigation.

Serve the application entry at valid `/pages/:id` URLs so reloads and shared links
work. Keep API endpoints and missing assets out of that rewrite. See
[deployment URL policy](./production-and-performance.md#deploy-the-routers-url-policy).

## Connect Backbone.Router

Use this alternative when the application already uses Backbone. Save it as
`backbone-navigation.js`; pass the same feature and `onError` callback used above.
This example owns browser history for the document and uses hash URLs such as
`#/pages/notes`. Call it only when this integration owns history startup and
shutdown. For a shared, already-started history, integrate the handlers into its
existing route table instead of calling this factory.

```javascript
import Backbone from 'backbone';

export function connectBackbone(feature, onError) {
  const Router = Backbone.Router.extend({
    routes: { 'pages/:id': 'page', '*path': 'leave' },
    page(id) {
      void feature.navigate(id).catch(onError);
    },
    leave() {
      feature.cancel();
      feature.application.getRegion().empty();
    }
  });
  const router = new Router();
  Backbone.history.start();

  return {
    router,
    async destroy() {
      Backbone.history.stop();
      await feature.application.destroy();
    }
  };
}
```

The catch-all releases the current page on unmatched hash routes; a complete
application would display its home, another feature, or a not-found View there.
The Application stays running so another matching route can load a page.

If the project already starts history, add these handlers to its route table and
leave history startup/shutdown with that existing owner. Backbone.Router has no
public per-router disposal method; keep the route table for the document lifetime
rather than registering new Routers whenever a feature starts.

Backbone does not intercept ordinary links automatically. Its
`router.navigate('pages/notes', { trigger: true })` updates the URL and dispatches
the handler. Use `Backbone.history.start({ pushState: true })` for path URLs only
when the server serves direct client routes. Implement and test the application's
focus and scroll behavior; this example does not supply either policy.

Routing alone does not require `BackboneApi`, `setDataApi`, or `setStateApi`.
Select those independently when consuming Backbone data or state. URL matching,
parameter decoding, and history remain [Backbone contracts](https://backbonejs.org/#Router).

## Other routers

A callback router such as [Navigo](https://github.com/krasimir/navigo) can call the
same feature's `navigate(id)`. Consider one when its browser support or URL
semantics meet a requirement the first two approaches do not. Check initial
dispatch, parameter decoding, history, failure handling, and listener cleanup.
Keep rendering and View replacement with the Region. No third-party router is
bundled or required by Marionette.

## Verify the integration

Test the documented modules together, through browser navigation:

- Open a direct URL, follow a link, then use back, forward, and reload.
- Supersede a slow load with a fast one, including a loader that ignores abort.
  Only the current page may appear; stale failures must stay silent.
- Cancel navigation, leave the feature, and destroy the integration during loading.
  Pending work must not commit, and destruction must release the listener and View.
- Fail a current load, surface the failure, and successfully retry.
- Check keyboard focus, fragment navigation, scroll restoration, and server 404s.

The [routing fixture](../test/fixtures/docs-routing/validate.mjs) exercises the
shared controller's Region ownership, cancellation, failure, and stop/restart
behavior. The [browser integration checks](../test/docs/routing-browser.test.mjs)
extract the modules on this page and exercise them in Chromium, Firefox, and
WebKit. Maintainers can run them after building with
`node --test test/docs/routing-browser.test.mjs`. These checks use local package
builds and a simulated server; focus, scroll, and the application's real hosting
configuration still require application-level verification.
