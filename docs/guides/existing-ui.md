# Integrate with existing UI

A page shell, custom element, or another UI framework can host a Marionette feature. Give the host responsibility for a stable mounting element and Marionette responsibility for the content inside it. The host must leave that content alone until the feature ends.

## Mount a View in a host-owned element

This small feature needs local interaction and a lifetime, so a Region owns its View. No Application or data provider is required. Install the rendering packages from [setup](../integrations/setup.md).

```js
import { Region, View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const CounterView = View.extend({
  initialize() { this.count = 0; },
  template: ({ count }) => html`<button type="button">Count: ${count}</button>`,
  templateContext() { return { count: this.count }; },
  events: { 'click button': 'increment' },
  increment() {
    this.count++;
    this.render();
    this.triggerMethod('count:changed', this.count);
  },
}).setDomApi(LitDomApi);

export function mountCounter(el, onCountChanged) {
  const region = new Region({ el });
  const counter = new CounterView();
  region.listenTo(counter, { 'count:changed': onCountChanged });
  region.show(counter);
  return {
    destroy() { region.destroy(); },
  };
}
```

Call `mountCounter` when the host's empty element is available. The callback receives the new count; the feature keeps its local presentation state. Call the returned `destroy()` from the host's cleanup hook **before** removing or replacing that element. Region destruction destroys the View, releases subscriptions, and leaves the mount itself in place. Repeated cleanup is safe. Mounting again creates a new feature with fresh state.

Use the host framework's mount/ref and cleanup hooks to perform these two operations. Keep the mounting element's identity stable across host updates. Give each mount its own Region; do not share a live View between Regions. If the host provides observable data, the View can borrow it through the configured [data provider](../api/providers/data.md); destroying the View does not dispose borrowed data.

## Host a feature with asynchronous readiness

Use an [Application](../api/application.md) for feature readiness or coordinated child Applications. Give it `region: { el }`; the host owns its `start()` and `destroy()` calls and handles their failures. Follow [startup and cancellation](../api/application.md#preparation-cancellation-and-failure) and the executable [pending-start teardown test](testing.md) for the lifecycle contract.

Keep the Application reference available to host cleanup while startup is pending. An asynchronous host cleanup hook can await destruction before reusing its mount; a synchronous hook must arrange completion and failure handling, or use a fresh element for the next mount. Adapt that boundary to the host's actual cleanup guarantees. The Region example above has synchronous teardown.

Removing DOM alone does not destroy a View or Application. Likewise, Marionette does not destroy the surrounding host. For markup whose root itself belongs to Marionette, see [adopting existing HTML](existing-html.md); that View's destruction removes its root.

## Check the boundary

Test a click and callback, cleanup with a retained button reference, and a fresh mount. Confirm cleanup preserves the host element and prevents detached controls from producing callbacks. For asynchronous integrations, extend the consumer cancellation test with your actual host cleanup hook. Use [consumer testing](testing.md) for lifecycle checks and a browser test for the real host's mount/cleanup behavior.
