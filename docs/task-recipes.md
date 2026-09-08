# Task recipes

Start with the resource that must survive or be cleaned up. These recipes use
Marionette ownership to keep application behavior predictable. Preserve an
existing compatible integration; each task identifies when another one is needed.

| Task | Start here | Owner and decision |
| --- | --- | --- |
| Save a draft without losing focus | [Forms](./forms-and-accessibility.md) | The form View owns input DOM and its pending save; update status without rerendering. |
| Change pages while requests overlap | [Routing](./routing.md) | The application owns URL handling and cancellation; the Region owns the active page. |
| Refresh a root class or ARIA state | [Root attributes](./marionette.view.md#refreshing-root-attributes) | Call `renderAttributes()` when only declared root attributes changed. |
| Keep surviving list rows editable | [Collection reconciliation](./marionette.collectionview.md#managing-children) | Keep the observable collection and surviving source objects; do not rebuild the entire CollectionView on every change. |
| Reuse server-provided markup | [Prerendered content](./dom.prerendered.md) | Give an existing element to its View; establish child ownership explicitly. |
| Observe a shared model | [DataApi](./data.api.md) | Use the existing provider, or native observable data for a new application; plain objects do not emit changes. |
| React to local owner state | [State](./marionette.state.md) | Choose StateApi separately from DataApi; use owner cleanup for subscriptions. |
| Wrap a widget that owns DOM | [The example below](#wrap-a-dom-owning-widget) | The View owns the widget handle and tears it down before DOM removal. |

## Wrap a DOM-owning widget

Use this seam for a chart, editor, map, or other widget that renders inside a
Marionette-owned host. The widget factory receives a DOM element and returns a
synchronous `destroy()` handle. Its own library decides rendering and data updates.
Do not let Marionette and the widget both own the same descendants.

<!-- executable-example: widget-owned-lifecycle -->
```javascript
import { View } from 'marionette';

export const WidgetView = View.extend({
  template: () => '<div data-widget-host></div>',
  initialize({ createWidget }) {
    this.createWidget = createWidget;
    this.widget = null;
  },
  onDomRefresh() {
    if (!this.widget) {
      this.widget = this.createWidget(this.el.querySelector('[data-widget-host]'));
    }
  },
  releaseWidget() {
    const widget = this.widget;
    this.widget = null;
    widget?.destroy();
  },
  onDomRemove() {
    this.releaseWidget();
  },
  onBeforeDestroy() {
    this.releaseWidget();
  }
});
```

Here is a complete factory for trying the ownership contract without installing
another library. A real widget adapter supplies the same handle.

```javascript
import { Region } from 'marionette';
import { WidgetView } from './widget-view.js';

const mount = document.createElement('main');
document.body.append(mount);
const region = new Region({ el: mount });
region.show(new WidgetView({
  createWidget(host) {
    const button = document.createElement('button');
    button.type = 'button';
    let count = 0;
    button.textContent = 'Count: 0';
    const increment = () => { button.textContent = `Count: ${++count}`; };
    button.addEventListener('click', increment);
    host.append(button);
    return {
      destroy() {
        button.removeEventListener('click', increment);
        button.remove();
      }
    };
  }
}));
// When leaving: region.destroy(); mount.remove();
```

With default lifecycle monitoring, `dom:refresh` runs after attached rendering
and attachment of rendered content. `dom:remove` runs before that content is
rerendered or detached. Thus a rerender destroys the previous widget before a new
host appears. Detaching destroys the widget but retains the View; showing that
View again creates a fresh widget. Destruction releases any remaining handle.

Keep `monitorViewEvents` enabled for this pattern and use Marionette-managed
attachment. Direct `append()`/`remove()` calls outside the lifecycle do not become
Marionette attachment events. If the widget must retain expensive state across
navigation, persist that state outside its disposable DOM handle or deliberately
choose a different attachment policy.

The factory must clean up partially acquired resources if initialization throws.
An asynchronous widget loader also needs a cancellation/generation check before
it attaches; follow the [navigation cancellation pattern](./routing.md). A View
lifecycle callback does not automatically await arbitrary third-party promises.

The [executable fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-application-guides/validate.mjs)
checks one widget per attachment, teardown before rerender, detach/reshow, and
final destruction. See [lifecycle](./view.lifecycle.md) for event ordering.

## Preserve an edited row during collection changes

A stable model object and a stable child View are different from matching IDs in a
new array. For an observable collection, perform the provider's supported
incremental operations. Then verify the unaffected child View and its input node
are the same objects. Avoid calling `collectionView.render()` after every provider
notification: that explicitly rebuilds children.

If data arrives as an immutable replacement, use a provider/reconciliation policy
that defines how source identity changes are handled. Do not assume `trackBy` or
ID matching preserves the existing View's `model` object under every adapter.
The [integration guide](./choosing-integrations.md) identifies supported contracts;
[testing](./testing.md) explains the input identity and stale-subscription assertions
that catch this failure.
