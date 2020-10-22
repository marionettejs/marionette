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
* [View Proxy](#view-proxy)
  * [Listening to View Events](#listening-to-view-events)
  * [Proxy Handlers](#proxy-handlers)
  * [Events / Initialize Order](#events--initialize-order)
  * [Using `ui`](#using-ui)
  * [View DOM proxies](#view-dom-proxies)
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

Nested Behaviors act as if they were direct Behaviors of the parent `Behavior`'s
view instance.

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

## View Proxy

The `Behavior` class provides proxies for a selection of `View` functionality.
This includes [listening to events on the view](), being able to [handle events on
models and collections](), and being able to directly [interact with the attached
template]().

### Listening to View Events

Behaviors are powered by an event proxy. This means that any events that are
triggered on a `View` are passed to all attached `behaviors`. This includes:

* Events fired by `triggerMethod`
* Events fired from `triggers`
* Events fired by `childViewTriggers`
* Events fired from `childView`

These handlers work exactly as they do on `View` -
[see the `View` documentation](./marionette.view.md#events)

> Be default all events triggered on the behavior come from the view or the view's entities.
> Events triggered in the behavior instance are not executed in the view. To notify
> the view, the behavior must trigger an event in its view property, e.g, `this.view.trigger('my:event')`

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

### Events / Initialize Order

If both view and behavior are listening for the same event, this will be executed
first in the view then in the behavior as below.

The View + Behavior initialize process is as follows:

1. View is constructed
2. Behavior is constructed
3. Behavior is initialized with view property set
4. View is initialized
5. View triggers an `initialize` event on the behavior.

This means that the behavior can access the view during its own `initialize` method.
The view `initialize` is called later with the information eventually injected by the behavior.
The `initialize` event is triggered on the behavior indicating that the view is fully initialized.

[Live example](https://jsfiddle.net/marionettejs/qb9go1y3/)

#### Using `ui`

As in views, `events` and `triggers` can use the `ui` references in their
listeners. For more details, see the [`ui` documentation](./dom.interactions.md#organizing-your-view).
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

If your `ui` keys clash with keys on the attached view, the view's `ui`
declarations will take precidence over the behavior's `ui`.
This allows for behaviors to be more easily reused without dictating
necessary structures within the view itself.

```javascript
import { Behavior, View } from 'backbone.marionette';

const MyBehavior = Behavior.extend({
  ui: {
    saveForm: '.btn-save'
  },

  events: {
    'click @ui.saveForm': 'saveForm'  // .btn-primary when used with `FirstView`
  },

  saveForm() {
    this.view.model.save();
  }
});

const FirstView = View.extend({
  behaviors: [MyBehavior],

  ui: {
    saveForm: '.btn-primary'
  },

  events: {
    'click @ui.saveForm': 'checkForm'  // .btn-primary
  },

  checkForm() {
    // ...
  }
});
```

### View DOM proxies

The `Behavior` has a number of proxies attributes that directly refer to the
related attribute on a view:

* `$`
* `el`
* `$el`

In addition, each behavior is able to reference the view they are attached to
through the `view` attribute:

```javascript
import { Behavior } from 'backbone.marionette';

const ViewBehavior = Behavior.extend({
  onRender() {
    const shouldHighlight = this.view.model.get('selected');
    this.$el.toggleClass('highlight', shouldHighlight);
    this.$('.view-class').addClass('highlighted-icon');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/8dmk30Lq/)

**Note** in rare cases when a view's `el` is modified via `setElement` if utilizing
these proxies they will need to be manually updated by calling
`myBehavior.proxyViewProperties();`

## Destroying a Behavior

`myBehavior.destroy()` will call `stopListening` on the behavior instance, and it will
remove the behavior from the view.
