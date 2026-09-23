# View resource cleanup

Match each resource to the part of the View that uses it. Marionette destroys
owned child Views, delegated `events` handlers, Behaviors, and outgoing
`listenTo()` subscriptions when a View is destroyed. It does not disconnect an
observer, remove a native DOM listener, cancel a timer, or dispose a widget that
application code created.

The examples below use the default View event monitor and a Region for attachment.
They are browser modules; each class can be used with the mount code at the end.

## Observe the root while attached

`attach` runs each time the same View is shown after a managed detach. Create a
fresh observer for that attachment, and register its matching release exactly
once. `before:detach` also runs when an attached View is destroyed.

<!-- executable-example: root-resize-observer-cleanup -->
```javascript
import { View } from 'marionette';

export const MeasuredView = View.extend({
  template: () => '<p>Resize this panel.</p>',

  onAttach() {
    const observer = new ResizeObserver(entries => {
      console.log(entries[0].contentRect.width);
    });
    observer.observe(this.el);
    this.once('before:detach', () => observer.disconnect());
  }
});
```

Calling `this.on('before:detach', ...)` inside `onAttach` would keep every
callback registered. After several attach/detach cycles, a later detach would
call all of them. `once` removes the callback after its matching detach.

## Release work tied to rendered descendants

The root element can stay attached while `render()` replaces its children.
`dom:refresh` runs after attached content appears; `dom:remove` runs before that
content is replaced or detached. Keep a handle to the exact element and listener
created for that render.

<!-- executable-example: descendant-listener-cleanup -->
```javascript
import { View } from 'marionette';

export const ChildListenerView = View.extend({
  template: () => '<button type="button">Run</button>',

  onDomRefresh() {
    const button = this.el.querySelector('button');
    const onClick = () => console.log('Run');
    button.addEventListener('click', onClick);
    this.once('dom:remove', () => button.removeEventListener('click', onClick));
  }
});
```

For ordinary View interactions, prefer declarative `events`; Marionette manages
those handlers. Use this pattern for native listeners or external widgets that
need a specific descendant. See the [widget recipe](./task-recipes.md#wrap-a-dom-owning-widget)
for a handle with `destroy()`.

## Keep a resource for the View's lifetime

`listenTo()` tracks subscriptions to event emitters and releases them when the
View is destroyed. A browser event listener is outside that system, so remove it
in `onBeforeDestroy`. The same boundary works for a timer, socket, or other
resource meant to survive rerenders and detachments.

<!-- executable-example: view-lifetime-cleanup -->
```javascript
import { View } from 'marionette';

export const StatusView = View.extend({
  template: () => '<p>Status is in the console.</p>',

  initialize({ source }) {
    this.listenTo(source, 'status:changed', this.reportStatus);
    this.onOnline = () => this.reportStatus('online');
    window.addEventListener('online', this.onOnline);
  },

  reportStatus(status) {
    console.log(status);
  },

  onBeforeDestroy() {
    window.removeEventListener('online', this.onOnline);
  }
});
```

To try all three Views in a browser, save the classes as `measured-view.js`,
`child-listener-view.js`, and `status-view.js`. Add `<main id="app"></main>`
to the page and run this module:

```javascript
import { Events, Region } from 'marionette';
import { MeasuredView } from './measured-view.js';
import { ChildListenerView } from './child-listener-view.js';
import { StatusView } from './status-view.js';

const source = Object.assign({}, Events);
const region = new Region({ el: document.querySelector('#app') });
const measured = new MeasuredView();
region.show(measured);
region.detachView();
region.show(measured); // A new ResizeObserver replaces the disconnected one.
region.show(new ChildListenerView()); // Destroys measured.
region.currentView.render(); // Replaces the button and releases its old listener.
region.show(new StatusView({ source })); // Destroys the button View.
source.trigger('status:changed', 'ready');
region.empty(); // Removes the online listener and tracked subscription.
region.destroy();
```

These hooks require Marionette-managed attachment with `monitorViewEvents`
enabled. If a resource can be created while detached, or monitoring is disabled,
release it from the View's destruction path as well. See
[View lifecycle](./view.lifecycle.md) and [lifecycle events](./events.class.md#view-events)
for the event boundaries.
