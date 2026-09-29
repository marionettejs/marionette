# Integrate an imperative control

Keep a control's DOM and cleanup with the View that owns its element. A one-off control can stay in that View. Use a [Behavior](../api/behavior.md) when multiple Views genuinely share the same integration.

This example uses the browser's native dialog API. It needs no renderer, data package, Application, or widget wrapper. Show the View through a Region before opening the dialog: [`showModal()` requires a connected element](https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-showmodal).

```js
import { Region, View } from 'marionette';

const HelpView = View.extend({
  template: () => `
    <button type="button" class="open-help">Help</button>
    <dialog aria-label="Help">
      <h2>Help</h2>
      <p>Choose a record to see its details.</p>
      <form method="dialog"><button autofocus>Close</button></form>
    </dialog>
  `,
  ui: { open: '.open-help', dialog: 'dialog' },
  events: { 'click @ui.open': 'openDialog' },
  openDialog() {
    this.getUI('dialog')[0].showModal();
  },
  closeDialog() {
    const dialog = this.el.querySelector('dialog');
    if (dialog && dialog.open) dialog.close();
  },
  onDomRemove() {
    this.closeDialog();
  },
  onBeforeDestroy() {
    this.closeDialog();
  },
});

const mount = document.body.appendChild(document.createElement('section'));
const region = new Region({ el: mount });
const help = new HelpView();
region.show(help);
```

The native dialog owns modal display, focus handling, Escape dismissal, and its closing form. The View owns the interaction that opens it and closes it before its markup is removed. This is local presentation; no broader feature lifecycle is needed.

## Match the control to the View lifecycle

With normal View monitoring, `onDomRemove` runs before an attached View re-renders or detaches. Closing there releases the modal while its element is still connected. `onBeforeDestroy` also covers terminal disposal, including a View already detached. Cleanup can run more than once; closing an already closed dialog does nothing.

For an external editor, chart, or other package, follow that package's actual API instead of treating the dialog as its adapter:

- Create DOM-independent resources in `initialize`. Bind to freshly rendered elements in `onRender`.
- Create or measure controls that require a connected element in `onAttach`, or `onDomRefresh` if they also need updating after an attached render. An adopted, already attached element gets no construction-time attach event; initialize that case explicitly.
- Dispose or release bindings before the renderer replaces their elements. Suspend work on detachment if the View can return; re-establish it when attached again.
- Release terminal resources in `onBeforeDestroy`, even when the View was never attached. Let the package's ownership rules determine whether disposal may be repeated.

Keep the renderer and external control from both updating the same subtree. Use the package's documented change events to update local data or emit user intent, and release its subscriptions or global handlers when its owner ends. See the [View lifecycle reference](../api/view.md#lifecycle-hooks-and-events) for hook arguments and ordering.

## Reuse through a Behavior

A Behavior receives its host's render, attach, detach, and destroy notifications, so the same integration hooks can be reused when their assumptions match each host. The host still owns its DOM.

Direct `behavior.destroy()` emits no independent destroy notification. If an integration can be removed separately from its host, release its external resources in an override of `destroy` and delegate to `Behavior.prototype.destroy.call(this)`. Make that cleanup repeat-safe; relying only on forwarded `onBeforeDestroy` leaves direct removal uncovered. See [Behavior disposal](../api/behavior.md#destruction-and-nested-behaviors) for the full contract.

## Check the actual browser behavior

Open Help and verify focus enters the dialog. Close it with the form button and with Escape. Open it again before rendering, detaching, or destroying the View and verify it closes before removal. A detached View remains reusable: re-show it through the Region and verify Help opens again. `region.empty()` destroys the View; destroy the Region when its owner finishes.

Run these modal checks in a browser. JSDOM can check the mounted markup and Marionette ownership transitions, but it does not supply the dialog's modal methods here. See [consumer testing](testing.md) for testing boundaries.
