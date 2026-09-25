# Quick start

Use this page for an introduction to common API shapes. A View owns a component,
a Region places another component, and a CollectionView manages repeated child
Views. Use child Views when rows need independent identity, state, or cleanup;
simple static or snapshot markup can stay in a View template. See the
[compact reference](./compact-reference.md) for lifecycle contracts.

## A screen with managed rows

This complete module expects an empty, connected `<main id="app"></main>`.
Templates receive serialized data as their argument. They do not receive the
View as `this`. The default renderer accepts a string; escape untrusted values
before inserting them into markup.

<!-- executable-example: quick-start-screen -->
```javascript
import { CollectionView, Region, View } from 'marionette';

function escapeHtml(value) {
  const text = document.createElement('span');
  text.textContent = String(value);
  return text.innerHTML;
}

const Row = View.extend({
  tagName: 'li',
  template: ({ label }) => `<button type="button">${escapeHtml(label)}</button>`,
  triggers: { 'click button': 'select' }
});

const Rows = CollectionView.extend({
  tagName: 'ul',
  childView: Row,
  childViewEvents: {
    select(child) { this.trigger('selected', child.model, child); }
  }
});

const records = [{ label: 'First post' }, { label: 'Second post' }];

const Screen = View.extend({
  template: () => '<h1>Posts</h1><div class="rows"></div><output></output>',
  regions: { rows: '.rows' },
  ui: { status: 'output' },
  onRender() {
    const rows = new Rows({ collection: records });
    this.listenTo(rows, 'selected', record => {
      this.getUI('status')[0].textContent = record.label;
    });
    this.showChildView('rows', rows);
  }
});

export const region = new Region({ el: '#app' });
export const screen = new Screen();
region.show(screen);
// At application teardown: region.destroy();
```

The template escapes labels as text, including values supplied by users. The
Region renders and attaches the screen. The screen owns its rows Region; the CollectionView owns each row.
Destroying the outer Region destroys the entire tree and its managed listeners.
Replacing this managed child container manually bypasses child ownership and
discards its rows' DOM identity. Update through the owning Views or data source.
A View template can render repeated markup directly when separate child lifetimes
and preservation of row state are unnecessary.

The records live outside the render hook, so rendering the screen again uses
the current records. A plain array is a snapshot. Mutating it does not notify the CollectionView;
call `screen.getChildView('rows').render()` after an explicit snapshot change. That full render destroys
and recreates children. When membership changes should preserve surviving rows,
use an observable collection and its supported DataApi. The
[interactive list recipe](./list-composition.md) shows `@mnjs/data` setup,
selection, updates, and cleanup.

See [View](./marionette.view.md), [Region](./marionette.region.md), and
[CollectionView](./marionette.collectionview.md) for their full contracts.

## When a save outlives the screen

Showing a different View in a Region normally destroys the previous View and
cleans up its managed DOM handlers and subscriptions. Destruction does not cancel
arbitrary promises, stop code after an `await`, or undo a server write. Application
code owns those effects. Removing DOM directly is not managed View destruction.

Separate the result's data owner from its screen owner. A successful save may
still need to clear the original record's retained draft after its editor is gone.
Do that in the longer-lived data owner, then update UI only if the initiating View
and request are still current. A destroyed child View's success event must not be
the only path that commits persistent application state. Keep a newer draft when
an earlier save finishes. The [complete persistence example](./application-effects.md#reconcile-retained-drafts-before-suppressing-ui)
shows both boundaries; use the [form recipe](./forms-and-accessibility.md) when the
work should instead be canceled with the form.

## Read the example without opening every reference

| Question | Contract used above |
| --- | --- |
| Where does instance setup go? | `initialize(options)` receives construction options. Store per-instance state there; DOM-dependent work belongs after rendering. |
| What reaches the template? | Its argument is serialized data plus `templateContext`; a plain row object supplies its attributes directly. The template is not bound to the View. |
| When can a named Region find its element? | The screen's `onRender()` runs after its template creates `.rows`; `showChildView()` renders and places the child there. |
| What does a child event handler receive? | The event's emitted arguments. Here `triggers` supplies the child View, so `select(child)` receives the row. An explicit `trigger('select', record)` would pass only `record`. |
| Is `getUI()` one element? | It returns an array-like query result. `[0]` selects the first match; `ui` names selectors bound during rendering. |
| How do updates reach the DOM? | Plain objects are not observable. Update through the owning View explicitly; use an observable source when multiple owners need notification. |

For exact signatures, follow [View](./marionette.view.md),
[DOM interactions](./dom.interactions.md), or [events](./events.md) only as needed.
For editing, use the [form recipe](./forms-and-accessibility.md): update derived
messages while retaining the focused control. Whole-View rendering replaces its
content with the default renderer and is not an input-event update strategy.

## DOM events and reusable Behavior

Use `events` when the handler needs an input value or keyboard information.
Use `triggers` when a DOM interaction should become a View event, as above.
`ui` names selectors; `getUI(name)` returns an array-like query result.
A Behavior contributes reusable interaction to its owning View. In a delegated
DOM handler, `event.delegateTarget` is the element matched by the event selector;
`event.target` can be a nested icon or span, and `event.currentTarget` is the
listener host. Use `delegateTarget` when you need the matched control.

<!-- executable-example: quick-start-behavior -->
```javascript
import { Behavior, View } from 'marionette';

const ClearInput = Behavior.extend({
  events: { 'click .clear': 'clear' },
  clear(event) {
    this.view.getUI('query')[0].value = '';
    this.view.trigger('query:changed', '', event.delegateTarget);
  }
});

export const Search = View.extend({
  template: () => '<label>Search <input class="query"></label><button class="clear" type="button"><span>Clear</span></button>',
  ui: { query: '.query' },
  behaviors: [ClearInput],
  events: { 'input @ui.query': 'updateQuery' },
  updateQuery() {
    this.trigger('query:changed', this.getUI('query')[0].value);
  }
});
```

Observe this View with the owner's `listenTo(search, 'query:changed', handler)`.
Destroy the owner to stop its subscriptions. A Behavior follows its View's
lifetime. See [DOM interactions](./dom.interactions.md) and
[Behavior](./marionette.behavior.md).

## Application and Radio

Use Application when a feature has asynchronous startup and shutdown. Await
lifecycle results: `true` means the requested state was reached, `false` means
superseded/cancelled, and rejected Promises indicate failure. Radio supplies named
channels when components need communication beyond a direct owner-child link.

<!-- executable-example: quick-start-application -->
```javascript
import { Application, Radio, View } from 'marionette';

const Ready = View.extend({ template: () => '<p>Ready</p>' });
const Feature = Application.extend({
  radioEvents: { refresh: 'refresh' },
  onStart() { this.showView(new Ready()); },
  refresh() {
    if (this.isRunning()) this.showView(new Ready());
  }
});

export async function mountFeature(host, channelName) {
  const application = new Feature({ region: { el: host }, channelName });
  await application.start();
  return {
    application,
    refresh() { Radio.channel(channelName).trigger('refresh'); },
    destroy() { return application.destroy(); }
  };
}
```

Call `const feature = await mountFeature(host, 'my-feature')` with an empty,
connected host and a distinct channel name for each independent feature.
Call `await feature.destroy()` before removing the host. Destruction removes the
owned View and managed Radio bindings. Channel names are shared: use an
application-specific name if multiple independent features coexist. Read
[Application](./marionette.application.md) before adding readiness hooks, child
applications, or cancellation; see [Radio](./radio.md) for request/reply ownership.
Valid synchronous construction/render/cleanup callbacks are required; see the
[synchronous failure boundary](./view.lifecycle.md#synchronous-failures).

## Coming from v4

- Import from `marionette`, not `backbone.marionette`.
- Backbone and Underscore are optional integrations, not required dependencies.
  New applications can use built-in plain data or `@mnjs/data`; preserve a working
  existing integration when it meets the task.
- Pass data into function templates. Supply extra display values with
  `templateContext`; do not depend on template `this` being a View.
- Plain arrays do not emit change notifications. Choose an observable DataApi
  for incremental row updates; calling `render()` is a full rebuild.

Continue with the [migration guide](../upgradeGuide.md),
[integration choices](./choosing-integrations.md), or [task guide](./agents.md).
