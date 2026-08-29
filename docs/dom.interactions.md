# DOM Interactions

Marionette `View` and `CollectionView` instances manage DOM interactions through
a root DOM element, `el`. Core uses the browser DOM API by default: `view.$()`
and bound `getUI()` values are native `NodeList` instances, and delegated
handlers receive native DOM events.

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

The global defaults are controlled by
[`triggersPreventDefault`](./features.md#triggerspreventdefault) and
[`triggersStopPropagation`](./features.md#triggersstoppropagation). These DOM
settings do not create an ownership boundary; selectors are still scoped only
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

When the View renders, Marionette queries each selector within `view.el` and
replaces the configured string with the resulting collection. With the default
DOM API, `view.getUI('save')` and `view.ui.save` are native `NodeList`
instances. Marionette rebinds those collections to replacement nodes after
each render.

Use `getUI(name)` after UI elements have been bound when application code needs
a named element. Calling it before binding or after unbinding throws
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
receive jQuery collections from query methods. The adapter does not add `$el`.
Core examples use native collections so the default package remains jQuery-free.
