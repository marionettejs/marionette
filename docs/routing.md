# Connect routing to a feature

Keep the project's existing router. A route handler can call an application
function that loads data and shows a View. Marionette does not export a router
or require a routing adapter.

## Choose the boundary

| Responsibility | Owner |
| --- | --- |
| Match URLs, parse parameters, update browser history | Your router |
| Validate route input, load data, handle errors, cancel superseded navigation | Application code |
| Display and replace the feature's View tree | A Marionette Region |
| Start, stop, and destroy the feature | A Marionette Application |

Use a Region directly when navigation only replaces Views. Add an Application
when the feature also needs a start/stop boundary or owns other Applications.
A route change does not inherently require a new Application instance.

If the project has no router, first determine whether it needs URLs at all.
Local selection can be ordinary application state. For URL navigation, choose a
router against the required URL, history, and deployment behavior. That decision
is independent of the [data, state, and DOM integrations](./choosing-integrations.md).

## Load the latest page and discard stale work

This example keeps one Application alive while routes replace its root View.
It retains the previous page during loading and on a current request failure.
A later navigation aborts the previous request. Stopping or destroying the
Application also aborts pending work and removes its displayed View.

Save this module as `page-navigation.js`. `loadPage(id, { signal })` is an
application dependency: it returns a Promise for an object with `title` and
`body` strings. The element must already exist. No data adapter is needed for
these plain objects.

<!-- executable-example: routing-latest-navigation -->
```javascript
import { Application, View } from 'marionette';

const PageView = View.extend({
  template: () => '<h1></h1><p></p>',
  onRender() {
    this.el.querySelector('h1').textContent = this.model.title;
    this.el.querySelector('p').textContent = this.model.body;
  }
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

  async function navigate(id) {
    if (!application.isRunning()) return false;

    cancelPending();
    const request = new AbortController();
    pending = request;

    try {
      const page = await loadPage(id, { signal: request.signal });
      if (request.signal.aborted || !application.isRunning()) return false;

      application.showView(new PageView({ model: page }));
      return true;
    } catch (error) {
      if (request.signal.aborted || !application.isRunning()) return false;
      throw error;
    } finally {
      if (pending === request) pending = undefined;
    }
  }

  return { application, navigate };
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

## Connect an existing router

Create the feature once, then call `navigate(id)` from the router's existing
matched-route handler. For an application already using `Backbone.Router`,
that can look like this:

```javascript
import Backbone from 'backbone';
import { createPageNavigation } from './page-navigation.js';

const status = document.querySelector('#route-status');
const { application, navigate } = await createPageNavigation({
  el: document.querySelector('#page'),
  async loadPage(id, { signal }) {
    const response = await fetch(`/api/pages/${encodeURIComponent(id)}`, { signal });
    if (!response.ok) throw new Error(`Page request failed: ${response.status}`);
    return response.json();
  }
});

const Router = Backbone.Router.extend({
  routes: { 'pages/:id': 'page' },
  page(id) {
    status.textContent = '';
    void navigate(id).catch(() => {
      status.textContent = 'Could not load this page. Try again.';
    });
  }
});

const router = new Router();
Backbone.history.start();

// When the owning application leaves this feature:
// await application.stop();
// When that owner permanently releases it:
// await application.destroy();
```

The page supplies `<main id="page"></main>` and
`<p id="route-status" role="status"></p>`. The server supplies the page endpoint.
Register this route within the project's existing router when one is already
present; start browser history once at the application entry point. Route
registration and history teardown remain the router owner's responsibility.
Stop the feature on routes that leave it, and restart it with `start()` before
sending it more navigation requests.

Using Backbone for routing alone does not require `BackboneApi`, `setDataApi`,
or `setStateApi`. Configure those only when Marionette owners consume Backbone
data or state. Backbone's URL matching and history behavior remain
[Backbone contracts](https://backbonejs.org/#Router).

## Verify the integration

Check the behavior at the route boundary:

- Navigate from a slow request to a fast one. The fast page must remain visible
  when the slow request later resolves or rejects.
- Navigate away or destroy the feature during loading. No late View may appear.
- Fail the current load. Surface the error and allow a later navigation to succeed.
- Replace a displayed page. Its old View must be destroyed through its Region.
- Follow a direct URL and use browser back/forward. Those checks exercise the
  router and hosting configuration, beyond the Marionette example.

The executable example fixture tests replacement, cancellation, load failure,
stop/restart, and destruction using deferred loaders, including loaders that
ignore abort. It does not test a particular router or server deployment.
