# DOM Interactions

In addition to what Backbone provides the views, Marionette has additional API
for DOM interactions available to all Marionette [view classes](./classes.md).

### DOM Interactions in a Backbone.View

Marionette's Views extend [`Backbone.View`](http://backbonejs.org/#View) and
so have references to the view's `el`, `$el`, and `this.$()` as well as
defining an `events` hash.

These methods provide ways for interacting with the view scoped to it's `el`
_and_ all of the view's children. To restate `events` and `this.$()` will query
the view's template and all of the children. Marionette's added interfaces
attempt to scope interactions with only the view's template, leaving the
children to handle themselves.

### Binding To User Input

Views can bind custom events whenever users perform some interaction with the
DOM. Using the view [`events`](#view-events) and [`triggers`](#view-triggers)
handlers lets us either bind user input directly to an action or fire a generic
trigger that may or may not be handled.

#### Event and Trigger Mapping

The `events` and `triggers` attributes bind DOM events to actions to perform on
the view. They each take a DOM event key and a mapping to the handler.

We'll cover a simple example:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  events: {
    'drop': 'onDrop',
    'click .btn-show-modal': 'onShowModal',
    'click @ui.save': 'onSave'
  },

  triggers: {
    'click @ui.close': 'close'
  },

  ui: {
    save: '.btn-save',
    close: '.btn-cancel'
  },

  onShowModal() {
    console.log('Show the modal');
  },

  onSave() {
    console.log('Save the form');
  },

  onDrop() {
    console.log('Handle a drop event anywhere in the element');
  }
});
```

Event listeners are constructed by:

```javascript
'<dom event> [dom node]': 'listener'
```

The `dom event` can be a jQuery DOM event - such as `click` - or another custom
event, such as Bootstrap's `show.bs.modal`.

The `dom node` represents a jQuery selector or a `ui` key prefixed by `@.`.
The `dom node` is optional, and if omitted, the view's `$el` will be used as the
selector.  For more information about the `ui` object, and how it works, see
[the documentation on ui](#organizing-your-view).

#### View `events`

The view `events` attribute binds DOM events to functions or methods on the
view. The simplest form is to reference a method on the view:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  events: {
    'click a': 'onShowModal'
  },

  onShowModal(event) {
    console.log('Show the modal');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/jfxwtmxj/)

The DOM event gets passed in as the first argument, allowing you to see any
information passed as part of the event.

**When passing a method reference, the method must exist on the View.**

The `events` attribute can also directly bind functions:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  events: {
    'click a'(event) {
      console.log('Show the modal');
    }
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/obt5vt09/)

As when passing a string reference to a view method, the `events` attribute
passes in the `event` as the argument to the function called.

**Note** Backbone `events` are delegated to the view's `el`. This means that
events with a dom node selector will be handled for the view and any decendants.
So if you attach a child with the same selector as the parent event handler, the
parent will handle the event for both views.

#### View `triggers`

The view `triggers` attribute binds DOM events to Marionette events that
can be responded to at the view or parent level. For more information on events,
see the [events documentation](./events.md). This section will just
cover how to bind these events to views.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  triggers: {
    'click a': 'click:link'
  },

  onClickLink(view, event) {
    console.log('Show the modal');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/exu2s3tL/)

When the `a` tag is clicked here, the `link:click` event is fired. This event
can be listened to using the [`onEvent` Binding](./events.md#onevent-binding)
technique discussed in the [events documentation](./events.md).

The major benefit of the `triggers` attribute over `events` is that triggered
events can bubble up to any parent views. For a full explanation of bubbling
events and listening to child events, see the
[event bubbling documentation](./events.md#event-bubbling)..

#### View `triggers` Event Object

Event handlers will receive the triggering view as the first argument and the
DOM Event object as the second followed by any extra parameters triggered by the event.

**NOTE** It is _strongly recommended_ that View's handle their own DOM event objects. It should
be considered a best practice to not utilize the DOM event in external listeners.

By default all trigger events are stopped with [`preventDefault`](./features.md#triggerspreventdefault)
and [`stopPropagation`](./features.md#triggersstoppropagating) methods. This by nature artificially
scopes event handling to the view's template preventing event handling of the same selectors in
child views. However you can manually configurethe triggers using a hash instead of an event name.
The example below triggers an event and prevents default browser behaviour using `preventDefault`.

```js
import { View } from 'backbone.marionette';

const MyView = View.extend({
  triggers: {
    'click a': {
      event: 'link:clicked',
      preventDefault: true, // this param is optional and will default to true
      stopPropagation: false
    }
  }
});
```

The default behavior for calling `preventDefault` can be changed with the feature flag
[`triggersPreventDefault`](./features.md#triggerspreventdefault), and `stopPropagation`
can be changed with the feature flag [`triggersStopPropagation`](./features.md#triggersstoppropagating).

## Organizing Your View

The `View` provides a mechanism to name parts of your template to be used
throughout the view with the `ui` attribute. This provides a number of benefits:

1. Provide a single defined reference to commonly used UI elements
2. Cache the jQuery selector
3. Query from only the view's template and not the children

### Defining `ui`

To define your `ui` hash, just set an object of named jQuery selectors to the
`ui` attribute of your View:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: MyTemplate,
  ui: {
    save: '#save-button',
    close: '.close-button'
  }
});
```

Inside your view, the `save` and `close` references will point to the jQuery
selectors `#save-button` and `.close-button`respectively found only in the
rendered `MyTemplate`.

### Accessing UI Elements

To get the handles to your UI elements, use the `getUI(ui)` method:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: MyTemplate,
  ui: {
    save: '#save-button',
    close: '.close-button'
  },

  onFooEvent() {
    const $saveButton = this.getUI('save');
    $saveButton.addClass('disabled');
    $saveButton.attr('disabled', 'disabled');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/rpa58v0g/)

As `$saveButton` here is a jQuery selector, you can call any jQuery methods on
it, according to the jQuery documentation.

#### Referencing UI in `events` and `triggers`

The UI attribute is especially useful when setting handlers in the
[`events`](#view-events) and [`triggers`](#view-triggers) objects - simply use
the `@ui.` prefix:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: MyTemplate,
  ui: {
    save: '#save-button',
    close: '.close-button'
  },

  events: {
    'click @ui.save': 'onSave'
  },

  triggers: {
    'click @ui.close': 'close'
  },

  onSave() {
    this.model.save();
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/f2k0wu05/)

In this example, when the user clicks on `#save-button`, `onSave` will be
called. If the user clicks on `.close-button`, then the event `close:view` will
be fired on `MyView`.

By prefixing with `@ui`, we can change the underlying template without having to
hunt through our view for every place where that selector is referenced - just
update the `ui` object.
