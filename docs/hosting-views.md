# Host a Marionette screen inside another framework

Use a Region at the boundary when an existing Vue, React, or other framework
shell hosts a Marionette screen. The shell owns an empty, stable mount element;
Marionette owns the View root and everything below it. Mount only after the host
is connected to the document, and destroy the Region before the host is removed.
Keep attachment monitoring enabled on the Views and their ancestors.

This is a coexistence boundary, not a requirement to replace the existing router,
store, or renderer. Prefer a complete screen with Marionette-owned child Regions
over a host bridge for every field. Give each shared record or query cache one
writer; call its existing persistence and invalidation operations rather than
copying it into a second independently writable state source.

## Mount through a Region

Save this module as `host-screen.js`. Pass a View class configured with the
application's chosen DataApi, StateApi, and DomApi, plus its constructor options.
The host must be an empty, connected DOM element. The shell renderer must leave
its contents to Marionette; it can still own attributes on that host.

<!-- executable-example: external-host-region -->
```javascript
import { Region } from 'marionette';

export function mountScreen(host, Screen, options = {}) {
  const region = new Region({ el: host });
  const view = new Screen(options);
  region.show(view);
  return {
    view,
    destroy() { region.destroy(); }
  };
}
```

Call `mountScreen` from the shell's mounted callback or effect after its host ref
is connected. Return or register `screen.destroy` as that mount's cleanup. In Vue,
use the mounted and before-unmount boundaries; in React, pair effect setup with
its cleanup. Every new mount creates a new View: a destroyed View cannot be reused.
The Region removes its child when destroyed and leaves the shell's host in place.
If using `createMarionette()`, import the Region and View from that same runtime
instead of mixing this example's default Region with isolated runtime classes.

`region.show(view)` renders and attaches the View. Calling `view.render()` and
then `host.replaceChildren(view.el)` does not run the attach lifecycle:
`view.el.isConnected` can be true while `view.isAttached()` is false. Native DOM
movement also bypasses descendant attachment propagation. Calling only
`Dom.notifyAttach` is not a replacement for Region ownership and View lifecycles.
See [attachment state](./view.lifecycle.md#attaching-a-view).

Do not let the shell replace or hide-by-removal an active host behind the Region.
For conditional rendering or a changed host ref, destroy the old mount first,
then mount a new screen after the replacement host connects. Merely applying CSS
such as `display: none` does not detach a View. A keep-alive integration that must
retain a View needs an explicit managed detach/reattach policy; raw DOM movement
does not supply it. The helper assumes valid construction/render callbacks and
follows the [synchronous failure contract](./view.lifecycle.md#synchronous-failures).

## Update without replacing owners

Keep the mount and screen stable for ordinary data, loading, permission, or locale
updates. Call the screen's application-defined update methods or mutate its
configured observable source. Do not remount the whole screen for every store
notification. Preserve unsaved drafts and editable child identity deliberately.

Lit and Morphdom can preserve DOM nodes within a View. They do not preserve child
Views in its Regions across a parent `render()`: Marionette empties those Regions
first. Keep layouts stable and update child owners directly when their drafts must
survive. Lit's directive connection lifecycle also depends on managed attachment;
a detached render followed by raw DOM insertion can leave directives disconnected.
See [DOM adapters](./view.rendering.md#rendering-to-dom) and
[resource cleanup](./resource-cleanup.md).

Destroy owned timers, widgets, store watchers, and listeners with their View.
An external framework's watcher created inside a View is not automatically owned
by Marionette's `listenTo`. Retain its disposer and call it at the corresponding
[resource lifetime](./resource-cleanup.md). Keep host-owned watchers in the host's
cleanup instead. Leave a borrowed shared store alive for other consumers.

A View's destruction does not cancel service promises. Invalidate the mount's
pending completion handlers before teardown, then ignore obsolete success, error,
and cleanup continuations. Preserve required server persistence and shared-cache
updates while preventing an old request from changing a replacement screen.
The [latest-request example](./application-refresh.md#share-one-latest-request-controller)
and [save completion policy](./application-effects.md) show these distinct lifetimes.
Do not add an Application just to mount a synchronous View; use one when the
feature needs asynchronous readiness or start/stop ownership.

## Verify the boundary

The [host fixture](../test/fixtures/docs-hosted-view/validate.mjs) executes
the mounting module with a Lit View, a managed child, and tracked directives. It
checks attach/detach notification, replacement mounts, host survival, and cleanup
without relying on private framework members. It also demonstrates the lifecycle
mismatch caused by raw DOM insertion. This is simulated-DOM evidence, not a
Vue/React integration test or browser acceptance.

In the application's browser tests, enter and leave the route repeatedly, resolve
an old request after replacement, and update data or locale while editing. Check
actual focus, caret, drafts, widget usability, and that one interaction produces
one response. Exercise the real host and selected adapter; a mocked screen or a
passing route still rendered by the old framework does not establish this boundary.
