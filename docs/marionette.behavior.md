# Marionette.Behavior

A `Behavior` provides a clean separation of concerns to your view logic,
allowing you to share common user-facing operations between your views.

`Behavior` includes:
- [Common Marionette Functionality](./common.md)
- [Class Events](./events.class.md#behavior-events)
- [DOM Interactions](./dom.interactions.md)
- [Entity Events](./events.entity.md)

`Behavior`s are particularly good at factoring out the common user, model and
collection interactions to be utilized across your application. Unlike the other
Marionette classes, `Behavior`s are not meant to be instantiated directly.
Instead a `Behavior` should be instantiated by the view it is related to by
[attaching the a behavior class definition to the view](#using-behaviors).

## Documentation Index

* [Instantiating a Behavior](#instantiating-a-behavior)
* [Using Behaviors](#using-behaviors)
  * [Defining and Attaching Behaviors](#defining-and-attaching-behaviors)
  * [Behavior Options](#behavior-options)
* [Nesting Behaviors](#nesting-behaviors)
* [The Behavior's `view`](#the-behaviors-view)
* [Host Communication and Event Proxies](#host-communication-and-event-proxies)
  * [Host and Behavior Events](#host-and-behavior-events)
  * [Proxy Handlers](#proxy-handlers)
  * [Initialize Order](#initialize-order)
  * [Using `ui`](#using-ui)
  * [Host DOM Boundary](#host-dom-boundary)
* [Behavior Lifecycle](#behavior-lifecycle)
* [Destroying a Behavior](#destroying-a-behavior)


## Instantiating a Behavior

Unlike other [Marionette classes](./classes.md), `Behavior`s are not meant to
be instantiated except by a view.

## Using Behaviors

The easiest way to see how to use the `Behavior` class is to take an example
view and factor out common behavior to be shared across other views.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  ui: {
    destroy: '.destroy-btn'
  },

  events: {
    'click @ui.destroy': 'warnBeforeDestroy'
  },

  warnBeforeDestroy() {
    alert('You are about to destroy all your data!');
    this.destroy();
  },

  onRender() {
    this.ui.destroy.tooltip({
      text: 'What a nice mouse you have.'
    });
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/pa8ryv03/)

Interaction points, such as tooltips and warning messages, are generic concepts.
There is no need to recode them within your Views so they are prime candidates
to be extracted into `Behavior` classes.

### Defining and Attaching Behaviors

```javascript
import { Behavior, View } from 'backbone.marionette';

const DestroyWarn = Behavior.extend({
  // You can set default options
  // They will be overridden if you pass in an option with the same key.
  options: {
    message: 'You are destroying!'
  },

  ui: {
    destroy: '.destroy-btn'
  },

  // Behaviors have events that are bound to the views DOM.
  events: {
    'click @ui.destroy': 'warnBeforeDestroy'
  },

  warnBeforeDestroy() {
    const message = this.getOption('message');
    window.alert(message);
    // Every Behavior has a hook into the
    // view that it is attached to.
    this.view.destroy();
  }
});

const ToolTip = Behavior.extend({
  options: {
    text: 'Tooltip text'
  },

  ui: {
    tooltip: '.tooltip'
  },

  onRender() {
    this.ui.tooltip.tooltip({
      text: this.getOption('text')
    });
  }
});

const MyView = View.extend({
  behaviors: [DestroyWarn, ToolTip]
});
```

[Live example](https://jsfiddle.net/marionettejs/b1awta6u/)

Each behavior will now be able to respond to user interactions as though the
event handlers were attached to the view directly. In addition to using array
notation, Behaviors can be attached using an object:

```javascript
const MyView = View.extend({
  behaviors: {
    destroy: DestroyWarn,
    tooltip: ToolTip
  }
});
```

Arrays are the only supported list form for `behaviors`. Object maps use own
enumerable string keys in standard JavaScript own-key order. Inherited, symbol,
and non-enumerable properties are ignored, and a numeric `length` property is
an ordinary map entry rather than an array-like signal.

#### Behavior Options

When we attach behaviors to views, we can also pass in options to add to the
behavior. This tends to be static information relating to what the behavior
should do. In our above example, we want to override the message to our
`DestroyWarn` and `Tooltip` behaviors to match the original message on the View:

```javascript
const MyView = View.extend({
  behaviors: [
    {
      behaviorClass: DestroyWarn,
      message: 'You are about to destroy all your data!'
    },
    {
      behaviorClass: ToolTip,
      text: 'What a nice mouse you have.'
    }
  ]
});
```

[Live example](https://jsfiddle.net/marionettejs/vq9k3c69/)

There are several properties, if passed, that will be attached directly to the instance:
`collectionEvents`, `events`, `modelEvents`, `triggers`, `ui`

Using an object, we must define the `behaviorClass` attribute to refer to our
behaviors and then add any extra options with keys matching the option we want
to override. Any passed options will override the values from `options` property.

Behavior options can also provide collaborators that the Behavior needs. These
values are selected during construction and retained by reference. Read an
arbitrary collaborator with `getOption()` so that a class default and an
attachment override follow the same option precedence; arbitrary option names
are not copied directly onto the Behavior instance. A host can explicitly pass
an injected service through a `behaviors()` function:

`initialize(options, hostView)` receives the same host View exposed as
`this.view`.

<!-- executable-example: behavior-collaborator -->
```javascript
import { Behavior, View } from 'marionette';

const SelectionBehavior = Behavior.extend({
  initialize() {
    this.listenTo(
      this.getOption('service'),
      'selection:change',
      this.onSelectionChange
    );
  },

  onSelectionChange(selection) {
    this.view.showSelection(selection);
  }
});

export const SelectionView = View.extend({
  template() {
    return '<output class="selection"></output>';
  },

  ui: {
    selection: '.selection'
  },

  behaviors() {
    return [{
      behaviorClass: SelectionBehavior,
      service: this.getOption('selectionService')
    }];
  },

  showSelection(selection) {
    this.getUI('selection')[0].textContent = selection.label;
  }
});
```

`getOption()` does not fall back to options on the host. Use `this.view` for
dependencies owned by the host, such as its model or collection. A nested
Behavior receives its own definition options while sharing the same host View
as the Behavior that declared it.

When a Behavior is removed directly or its host is destroyed, Marionette removes
subscriptions created by that Behavior with `listenTo()`. It does not destroy or
dispose arbitrary values passed through Behavior options, and unrelated listeners
on those collaborators remain active.

**Errors** An error will be thrown if the `Behavior` class is not passed.

## Nesting Behaviors

In addition to extending a `View` with `Behavior`, a `Behavior` can itself use
other Behaviors. The syntax is identical to that used for a `View`:

```javascript
import { Behavior } from 'backbone.marionette';

const Modal = Behavior.extend({
  behaviors: [
    {
      behaviorClass: DestroyWarn,
      message: 'Whoa! You sure about this?'
    }
  ]
});
```

[Live example](https://jsfiddle.net/marionettejs/7ffnqff3/)

Nesting groups Behavior declarations; it does not transfer cleanup ownership to
the declaring Behavior. Nested Behaviors act as direct Behaviors of the same host
view, so destroying the declarer leaves them active until they are removed
directly or the host is destroyed.

## The Behavior's `view`
The `view` is a reference to the `View` instance that the `Behavior` is attached to.

```javascript
import { Behavior } from 'backbone.marionette';

Behavior.extend({
  handleDestroyClick() {
    this.view.destroy();
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/p8vymo4j/)

## Host Communication and Event Proxies

A Behavior is an event-capable object attached to one host View. It can handle
host events, DOM events, and host entity events while keeping its own events
separate from the host.

### Host and Behavior Events

When the host calls `triggerMethod()`, the host's corresponding `onEvent` method
runs first. The event is then broadcast with the same arguments to every attached
Behavior, where the corresponding method runs with that Behavior as its context.
Nested Behaviors participate directly in the same host broadcast. Do not rely on
an ordering among Behavior handlers.

Host broadcasts include events produced by:

* Calls to `triggerMethod()`
* DOM `triggers`
* `childViewTriggers`
* Child events forwarded through a non-false `childViewEventPrefix`

`childViewEvents` calls the configured host handler directly. It becomes a host
broadcast only if that handler explicitly calls `triggerMethod()`.

A call to `behavior.triggerMethod()` stays local to that Behavior. It does not
invoke the host or sibling Behaviors. To request host work, call an appropriate
public host method or explicitly use `this.view.triggerMethod()`. The latter is a
host broadcast, so every attached Behavior receives it, including the Behavior
that sent it. Do not re-emit the same host event from that Behavior's corresponding
handler, as doing so would recurse.

<!-- executable-example: behavior-host-communication -->
```javascript
import { Behavior, View } from 'marionette';

const SaveBehavior = Behavior.extend({
  ui: {
    save: '.save'
  },

  events: {
    'click @ui.save': 'requestSave'
  },

  requestSave() {
    this.view.requestSave();
  }
});

export const FormView = View.extend({
  behaviors: [SaveBehavior],

  template() {
    return '<button class="save" type="button">Save</button>';
  },

  requestSave() {
    this.triggerMethod('save:requested', this);
  }
});
```

Behavior DOM queries and delegation stay scoped to the host View. A matching
element outside the host does not participate. Literal configuration errors fail
eagerly: an undeclared `@ui` reference throws [MN0018](/errors/MN0018/), and a
string handler that does not resolve to a callable method throws
[MN0019](/errors/MN0019/). For example, declaring the event above without
`ui.save`, or naming `requestSave` without defining that method, is invalid.

A Behavior's DOM [`triggers`](./dom.interactions.md#view-triggers) are emitted on
the host automatically. The host method runs first, and all attached Behaviors,
including the Behavior that declared the trigger, receive the broadcast.

For general event naming and handler conversion, see
[`triggerMethod`](./events.md#triggermethod).

### Proxy Handlers

Behaviors provide proxies to a number of the view event handling attributes
including:

* [`events`](./dom.interactions.md#view-events)
* [`triggers`](./dom.interactions.md#view-triggers)
* [`modelEvents`](./events.entity.md#model-events)
* [`collectionEvents`](./events.entity.md#collection-events)

```javascript
import { Behavior } from 'backbone.marionette';

Behavior.extend({
  events: {
    'click .foo-button': 'onClickFooButton'
  },
  triggers: {
    'click .bar-button': 'click:barButton'
  },
  modelEvents: {
    'change': 'onChangeModel'
  },
  collectionEvents: {
    'change': 'onChangeCollection'
  },
  onClickFooButton(evt) {
    // ..
  },
  onClickBarButton(view, evt) {
    // ..
  },
  onChangeModel(model, opts) {
    // ..
  },
  onChangeCollection(model, opts) {
    // ..
  }
});
```

### Initialize Order

The View + Behavior initialize process is as follows:

1. View is constructed
2. Behavior is constructed
3. Behavior is initialized with view property set
4. Callable Behavior `events` and `triggers` are resolved and delegated
5. View is initialized
6. View triggers an `initialize` event on the behavior.

This means that the behavior can access the view during its own `initialize` method.
Callable `events` and `triggers` may use state established by that method before
the View initializes.
The view `initialize` is called later with the information eventually injected by the behavior.
The `initialize` event is triggered on the behavior indicating that the view is fully initialized.

[Live example](https://jsfiddle.net/marionettejs/qb9go1y3/)

#### Using `ui`

As in views, `events` and `triggers` can use the `ui` references in their
listeners. For more details, see the [`ui` documentation](./dom.interactions.md#organizing-a-view-with-ui).
These can be defined on either the Behavior or the View:

```javascript
import { Behavior } from 'backbone.marionette';

const MyBehavior = Behavior.extend({
  ui: {
    saveForm: '.btn-save'
  },

  events: {
    'click @ui.saveForm': 'saveForm'
  },

  modelEvents: {
    invalid: 'showError'
  },

  saveForm() {
    this.view.model.save();
  },

  showError() {
    alert('You have errors');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/6b8o3pmz/)

### UI resolution and binding

For a host whose `el` is empty at construction, the host constructs each Behavior
before the host's `initialize` and before binding UI elements. During that
construction, the Behavior resolves its own `ui` declaration and the host's `ui`
declaration into one selector map. When both declarations contain the same key, the
host's selector wins. This allows a Behavior to provide reusable defaults without
dictating the host's markup. Marionette establishes this merged map before the
Behavior's first DOM event and trigger delegation, so host-only keys and host
overrides are available immediately.

The merged selector map is available to the Behavior's `initialize`, before either
the Behavior or host has bound UI elements. The map is captured for that Behavior
instance during construction; later changes to values returned by a `ui` function do
not replace its captured selectors. The host evaluates its own `ui` again when it
binds. If a stateful host `ui` function returns a different selector then, the host
binds the later selector while the Behavior continues to bind its construction-time
selector. Keep `ui` functions deterministic when the host and Behavior share keys.

Before binding, `behavior.ui` contains selector strings. A template-rendered `View`
binds those selectors during render, after which the values are array-like element
collections found only within the host's `el`. Its rerender replaces the contents and
rebinds the same Behavior to the replacement elements. Code must read the current
`behavior.ui` or call `behavior.getUI(name)` after binding instead of retaining an
element collection from an earlier render. Calling `getUI()` without a declared
`ui` map, before binding, or after unbinding throws [`MN0023`](/errors/MN0023/).

A `CollectionView` also binds Behavior UI automatically when its render processes a
template. Without a template, `CollectionView#render` leaves Behavior UI as selector
strings; call `collectionView.bindUIElements()` after the expected elements exist to
bind them explicitly.

A `View` initialized around pre-rendered content binds its own UI before it
constructs Behaviors. This contract pins only that construction ordering. It
intentionally leaves the mixed Behavior UI representation for that path unresolved;
do not infer the selector-before-binding sequence above or rely on that representation.

<!-- executable-example: behavior-ui-resolution -->
```javascript
import { Behavior, View } from 'marionette';

const SaveBehavior = Behavior.extend({
  ui: {
    save: '.btn-save'
  },

  events: {
    'click @ui.save': 'requestSave'
  },

  requestSave() {
    this.getUI('save')[0].classList.add('is-saving');
    this.view.requestSave();
  }
});

export const FormView = View.extend({
  behaviors: [SaveBehavior],

  template() {
    return [
      '<button class="btn-save" type="button">Default save</button>',
      '<button class="btn-primary" type="button">Save</button>'
    ].join('');
  },

  ui: {
    save: '.btn-primary'
  },

  requestSave() {
    this.triggerMethod('save:requested', this);
  }
});
```

### Host DOM boundary

The host View or CollectionView owns the DOM boundary for each attached
Behavior. A Behavior's `el` is the host's current `el`, and its `$()` lookup
delegates to the host so that results stay scoped to that element. Behaviors do
not have a `$el` property.

Calling the host's `setElement()` automatically moves its Behaviors to the new
element. Their delegated DOM handlers are removed from the old element and
attached once to the current element, including after repeated calls or swaps.
Destroying the host removes the final delegated handlers. Application code
does not need to retarget the Behavior separately.

Each Behavior can also reference its host through the `view` attribute:

```javascript
import { Behavior } from 'backbone.marionette';

const ViewBehavior = Behavior.extend({
  onRender() {
    const shouldHighlight = this.view.model.get('selected');
    this.el.classList.toggle('highlight', shouldHighlight);
    Array.from(this.$('.view-class')).forEach(element => {
      element.classList.add('highlighted-icon');
    });
  }
});
```

## Behavior Lifecycle

A `Behavior` has a host-managed lifetime rather than the independent rendered,
attached, and destroyed state exposed by a View. In this table, the host view is
either a `View` or `CollectionView`. It constructs its Behaviors, keeps the same
instances through render and attachment transitions, and cleans them up when it
is destroyed. Nested Behaviors participate as Behaviors of the same host view.

| Operation | Host view | Behavior |
| --- | --- | --- |
| Construct the View | Constructs each Behavior before the View's `initialize`. | Receives its `view` and runs its own `initialize`; after the View initializes, receives the View's `initialize` notification. |
| Render or re-render the View | Runs each View lifecycle callback first. | The same instance receives the corresponding lifecycle callback after the View. |
| Show, detach, or re-show the host through a Region with lifecycle monitoring enabled | Changes the host's attachment state. | The same instance receives the corresponding attachment lifecycle after the host. |
| First direct `behavior.destroy()` while the View is alive | Remains alive without the removed Behavior. | Undelegates its events, stops listening, removes itself from the View, and deletes its entity-event handlers. It receives no later host lifecycle notifications. |
| Destroy the View | Runs `before:destroy`, tears down the View, and runs its `destroy` callback. Repeated View destruction is a no-op. | Receives `before:destroy` while the View is alive, is cleaned up after the View enters destroyed, then receives `destroy` after the View's callback. Nested Behaviors follow the same ordering. |

`Behavior` does not expose an independent `isDestroyed()` state. Repeated direct
`behavior.destroy()` calls, reuse after direct cleanup, and other post-cleanup
operations are outside this lifecycle contract. Dependency access, invalid
references, and dynamic replacement semantics are separate Behavior contract
decisions; this table does not add an Application or State lifecycle to Behavior.

If a Region's owning view sets `monitorViewEvents: false`, the shown host does not
receive attachment lifecycle notifications, so its Behaviors do not receive them
either. Separately, setting `monitorViewEvents: false` on the host itself does not
by itself suppress Region attachment lifecycle. It suppresses the host's
`dom:refresh` and `dom:remove` notifications, so its Behaviors do not receive those
notifications.

## Destroying a Behavior

`myBehavior.destroy()` will call `stopListening` on the behavior instance, and it will
remove the behavior from the view.
