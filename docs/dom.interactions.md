# DOM Interactions

Marionette `View` and `CollectionView` instances manage DOM interactions through
a root DOM element, `el`. Core uses the browser DOM API by default: `view.$()`
and bound `getUI()` values are native `NodeList` instances, and delegated
handlers receive native DOM events.

`View`, `CollectionView`, and `Behavior` use the public EventDelegator runtime
adapter described below. Core provides a native DOM adapter by default.

## DOM Ownership Boundaries

Use these boundaries when deciding where DOM work belongs:

* The external shell chooses where a root View is mounted. Pass a concrete DOM
  element as `el`, or append the View's generated `el` to the shell's mount.
* A View owns its `el` and the nodes produced by its template.
* A Behavior borrows its host View's DOM boundary. It does not own a separate
  root; see [Behavior host communication](./marionette.behavior.md#host-communication-and-event-proxies).
* The external shell or owning View owns the DOM element used as a Region mount.
  The Region manages the placement and lifecycle of its current child View at
  that mount. Use the [View Region APIs](./marionette.view.md#laying-out-views---regions)
  to show, access, detach, or empty that child.
* A child View owns its own `el` and handles interactions inside it.

DOM scoping is structural, not ownership-aware. `view.$()`, `ui`, and delegated
selectors are rooted at `view.el`, so they exclude matching elements outside
that root. They can still match a descendant owned by a child View. Do not use a
parent query such as `parentView.$('.child-control')` to manipulate child-owned
DOM. Give each owner distinct selectors and communicate across View boundaries
through public View or Region APIs and
[explicit child events](./events.md#child-view-events).

## Canonical View Interaction

The example below defines selectors once in `ui`, handles a save click through
`events`, and translates a close click into the `form:close` View event through
`triggers`.

<!-- executable-example: view-dom-interactions -->
```javascript
import { View } from 'marionette';

export const FormView = View.extend({
  template() {
    return `
      <form>
        <button class="save" type="button">Save</button>
        <button class="close" type="button">Close</button>
      </form>
    `;
  },

  ui: {
    save: '.save',
    close: '.close'
  },

  events: {
    'click @ui.save': 'onSave'
  },

  triggers: {
    'click @ui.close': 'form:close'
  },

  onSave(event) {
    const [saveButton] = this.getUI('save');

    saveButton.disabled = true;
    this.triggerMethod('form:save', this, event);
  },

  onFormClose(view) {
    view.el.dataset.closed = 'true';
  }
});
```

Create and render the View before accessing its bound UI elements:

```javascript
const formView = new FormView();

formView.render();
document.querySelector('#form-host').append(formView.el);
```

The shell owns `#form-host`; `formView` owns the generated `formView.el` inside
it. Destroy the View when the shell is finished with it so delegated handlers
and other owned resources are cleaned up.

## View `events`

The `events` attribute delegates DOM events from the View's `el` to functions or
methods on the View. A key has this shape:

```javascript
'<dom event> [CSS selector]': 'methodName'
```

The CSS selector is optional. Without one, the handler is bound to the View's
root `el`. Use `@ui.<name>` in place of a literal selector to reference a
declared `ui` key, as the canonical example does with `@ui.save`.

The handler receives the native DOM event as its first argument and runs with
the View as its context. An `events` value must be a function or a string that
resolves to a callable method. Invalid handlers throw `MarionetteError` with
code [`MN0019`](/errors/MN0019/) before Marionette delegates any handler from
that event map.

Delegation sees matching descendants throughout `el`. If a child View contains
the same selector, its bubbling DOM event can reach the parent handler. Prefer
owner-specific selectors; use Marionette events for parent-child communication
instead of relying on DOM bubbling across ownership boundaries.

Call `view.delegateEvents(events)` to refresh delegated DOM handlers after
changing a callable `events`, `triggers`, or `ui` definition. A supplied event
map replaces only the View's configured `events` for that delegation pass;
View triggers and Behavior events and triggers remain active. The method first
removes existing handlers, so repeated calls do not duplicate them.
`view.undelegateEvents()` removes the View and Behavior DOM handlers. Both
methods return the View, and both are no-ops after destruction has started.
Replacing `el` with `setElement()` dispatches through both public methods, so a
subclass override remains responsible for delegating to the base method when it
wants Marionette's cleanup and redelegation.

## EventDelegator Adapter

An EventDelegator owns how one normalized `events` or `triggers` declaration is
registered and removed. Marionette still owns declaration resolution, handler
context, UI normalization, and the timing of registration and cleanup.

Configure every View, CollectionView, and Behavior class with the root setter:

```javascript
import { setEventDelegator } from 'marionette';

setEventDelegator(MyEventDelegator);
```

Or configure one class hierarchy through its static setter:

```javascript
const InstrumentedView = View.extend({});
InstrumentedView.setEventDelegator(MyEventDelegator);
```

The supplied object is a complete adapter, not a partial overlay. It must
provide this method. This example retains native selector and focus behavior;
an instrumentation adapter could record around the same registration:

<!-- executable-example: event-delegator-adapter -->
```javascript
export const CustomEventDelegator = {
  delegate({ eventName, selector, handler, rootEl }) {
    const capture = eventName === 'focus' || eventName === 'blur';
    const listener = selector ? event => {
      const target = event.target.nodeType === 1 ?
        event.target : event.target.parentElement;
      const match = target && target.closest(selector);

      if (match && match !== rootEl && rootEl.contains(match)) {
        event.delegateTarget = match;
        return handler(event);
      }
    } : handler;

    rootEl.addEventListener(eventName, listener, capture);
    return () => rootEl.removeEventListener(eventName, listener, capture);
  }
};
```

The arguments are:

* `eventName`: the first non-whitespace token in the declaration key.
* `selector`: the remaining selector, or an empty string for a direct handler.
* `handler`: Marionette's normalized callback. The adapter must preserve its
  arguments and return behavior.
* `rootEl`: the View or CollectionView's current `el`. A Behavior receives its
  host View's current `el`.

`delegate` must return a cleanup function that removes exactly the
registration it created, including its original root, listener, namespace, and
capture/options policy. Marionette owns and stores that opaque cleanup. The
adapter must not mutate View internals.

Marionette invokes each returned cleanup at most once when `undelegateEvents()` refreshes declarations,
before `setElement()` transfers delegation, during destruction, and when
construction fails. Cleanups run in reverse registration order. Marionette
attempts every cleanup even if one throws, clears its registry before invoking
them, and then throws the first cleanup error. A throwing cleanup violates the
adapter contract; Marionette does not retain it or grow a retry queue. View and
Behavior destruction still completes its remaining lifecycle cleanup before
propagating that error.
Constructor rollback likewise attempts every cleanup but preserves the original
construction error, because the failed instance is not returned to the caller.

Registration must be atomic: if `delegate` throws, that call must not leave a
registration behind. If a later declaration fails, Marionette invokes every
cleanup already returned during that delegation pass and rethrows the original
registration error. An incomplete adapter or a non-function cleanup throws
[`MN0036`](/errors/MN0036/).

Adapter selection occurs at registration time. Changing a global or per-class
adapter does not reinterpret existing registrations; their original opaque
cleanups remain authoritative. The newly configured adapter is used the next
time declarations are delegated, including a new instance, an explicit
`delegateEvents()` call, or `setElement()`. A per-class setter creates an own
adapter override for that class hierarchy, so a later root setter does not
replace it.

The native adapter uses `addEventListener`. Selector declarations walk from a
text or element target to the closest matching descendant of `rootEl` and set
`event.delegateTarget` to that match. Native event names are literal:
namespaces such as `click.menu` are not interpreted, and non-bubbling events
such as `mouseenter` are not emulated.

Delegated native `focus` and `blur` use capture because those events do not
bubble. The delegated handler therefore runs before a target-element listener.
A Marionette trigger stops propagation by default, which prevents the event
from reaching that target listener. Set `stopPropagation: false` on that
trigger when the target must also observe the focus or blur event; the
Marionette trigger still runs first. Marionette does not silently translate
these declarations to `focusin` or `focusout`.

A jQuery adapter can implement the same protocol with paired `.on()` and
`.off()` calls. Compatibility tests exercise that protocol, but v5 does not yet
ship a jQuery EventDelegator; the separately packaged first-party adapters work
will decide whether to publish one through an explicit optional subpath. Such
an adapter can support jQuery-specific namespaces, programmatic dispatch, and
delegated focus behavior without adding jQuery to the core production graph.
React and Vue normally own events within the subtree they
render; integrate those subtrees through explicit DOM and lifecycle ownership
boundaries instead of replacing Marionette's EventDelegator with a React or Vue
adapter.

## View `triggers`

The `triggers` attribute translates a DOM event into a Marionette View event.
In the canonical example, clicking the close button emits exactly
`form:close`. Listeners and the matching `onFormClose` method receive the
triggering View first, followed by the native DOM event.

By default, a trigger calls `preventDefault()` and `stopPropagation()` on the
DOM event. Configure either behavior for one trigger with an object:

```javascript
triggers: {
  'click @ui.close': {
    event: 'form:close',
    preventDefault: true,
    stopPropagation: false
  }
}
```

These settings are local to the configured trigger. Selectors remain scoped only
by the View's root `el`.

For a child owned through a Region, automatic parent handling and forwarding is
opt-in. `childViewEvents` calls a configured parent handler,
`childViewTriggers` re-emits a configured parent event, and a non-false
`childViewEventPrefix` forwards prefixed events. A parent may instead subscribe
directly with public [`listenTo(childView, ...)`](./events.md#listening-to-events),
but that is an explicit subscription rather than automatic bubbling. See
[Child View Events](./events.md#child-view-events) for the configured contracts.

## Organizing a View with `ui`

The `ui` attribute gives frequently used CSS selectors stable names:

```javascript
ui: {
  save: '.save',
  close: '.close'
}
```

When Marionette iterates a UI definition for binding, or a map passed to a UI
normalization helper, it uses own enumerable string keys in standard JavaScript
own-key order. Inherited, symbol, and non-enumerable properties are ignored by
those iterations, and a numeric `length` is an ordinary key rather than an
array-like signal. Arrays, sparse arrays, and other array-like values are not
supported as UI maps. A literal own `__proto__` key remains an own entry in
normalized and bound UI maps without changing either map's prototype. Direct
`@ui.<name>` lookup follows the own-declaration contract described below and
does not require the declared selector property to be enumerable.

When the View renders, Marionette queries each selector within `view.el` and
replaces the configured string with the resulting collection. With the default
DOM API, `view.getUI('save')` and `view.ui.save` are native `NodeList`
instances. Marionette rebinds those collections to replacement nodes after
each render.

Use `getUI(name)` after declaring a `ui` map and binding its elements when
application code needs a named element. Calling it without a declared map,
before binding, or after unbinding throws
`MarionetteError` with code [`MN0023`](/errors/MN0023/). Once bound, a missing
key preserves the existing `undefined` result. Use the `@ui.<name>`
form in `events`, `triggers`, Behaviors, and Regions so a selector change has one
source of truth.

Every `@ui.<name>` reference must contain a non-empty name for an own, declared
key in the applicable `ui` map. Missing, inherited, or `undefined` keys throw
`MarionetteError` with code [`MN0018`](/errors/MN0018/) during normalization.
An explicitly declared empty selector is a known key, though the DOM API may
reject it when the selector is used.

## Optional jQuery DOM Adapter

Applications that explicitly configure
[`marionette/jquery-dom-api`](./installation.md#jquery-dom-adapter-is-optional)
before constructing Views receive jQuery collections from query methods. The
adapter also creates and refreshes `$el` on View and CollectionView instances,
and each Behavior mirrors its host View's `$el`. Core examples use native
collections so the default package remains jQuery-free.
