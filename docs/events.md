# Marionette Events

Marionette provides its own `Events` primitive for communication between
objects. It is exported from `marionette`, mixed into every
[Marionette class](./classes.md), and does not require Backbone. These object
events are separate from [DOM events](./dom.interactions.md#binding-to-user-input).

## Documentation Index

* [Triggering and Listening to Events](#triggering-and-listening-to-events)
  * [Events API](#events-api)
  * [`triggerMethod`](#triggermethod)
  * [Listening to Events](#listening-to-events)
    * [`onEvent` Binding](#onevent-binding)
  * [Backbone interop](#backbone-interop)
  * [Private bookkeeping](#private-bookkeeping)
  * [View events and triggers](#view-events-and-triggers)
  * [View entity events](#view-entity-events)
* [Child View Events](#child-view-events)
  * [Event Bubbling](#event-bubbling)
    * [Using CollectionView](#using-collectionview)
  * [A Child View's Event Prefix](#a-child-views-event-prefix)
  * [Explicit Event Listeners](#explicit-event-listeners)
    * [Attaching Functions](#attaching-functions)
    * [Using `CollectionView`'s `childViewEvents`](#using-collectionviews-childviewevents)
  * [Triggering Events on Child Events](#triggering-events-on-child-events)
    * [Using `CollectionView`'s `childViewTriggers`](#using-collectionviews-childviewtriggers)
* [Lifecycle Events](#lifecycle-events)


## Triggering and Listening to Events

Use the `Events` export directly when a plain object needs Marionette's event
API, or use the same methods already present on a Marionette class.

```javascript
import { Events, MnObject } from 'marionette';

const emitter = Object.assign({}, Events);
const listener = new MnObject();

listener.listenTo(emitter, 'status:changed', status => {
  console.log(status);
});

emitter.trigger('status:changed', 'ready');
listener.stopListening(emitter);
```

### Events API

| Method | Purpose |
| --- | --- |
| `on(name, callback, context?)` | Register a callback on this object. |
| `off(name?, callback?, context?)` | Remove matching callbacks registered with `on`. |
| `trigger(name, ...args)` | Trigger one or more named events. |
| `once(name, callback, context?)` | Register a callback that is removed after its first call. |
| `listenTo(object, name, callback)` | Listen to another emitter while tracking the relationship on this object. |
| `stopListening(object?, name?, callback?)` | Remove relationships created with `listenTo` or `listenToOnce`. |
| `listenToOnce(object, name, callback)` | Listen to another emitter once. |
| `triggerMethod(name, ...args)` | Trigger an event and call its matching `onEventName` method. |

`trigger`, `on`, `off`, `once`, `listenTo`, `listenToOnce`, and
`stopListening` accept space-separated event names. `triggerMethod` delegates
to `trigger` for listener notification, but call it once per event when you
need matching `onEventName` methods. Object-form `trigger` maps each key to the
single value passed to that event's handlers:

```javascript
emitter.on('start stop', value => console.log(value));
emitter.trigger('start stop', 'manual');

emitter.trigger({
  start: 'automatic',
  stop: 'complete'
});
```

### `triggerMethod`

`triggerMethod` fires the named event on the instance and also invokes the
matching `onEventName` method when it exists. If there are no listeners or
matching method, the call still succeeds. All arguments after the event name
are passed to both the method and event handlers.

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  callMethod(myString) {
    console.log(myString + ' was passed');
  }
});

const myView = new MyView();
myView.on('something:happened', myView.callMethod);

/* Calls callMethod('foo'); */
myView.triggerMethod('something:happened', 'foo');
```

[Live example](https://jsfiddle.net/marionettejs/whvgao7o/)

**The `triggerMethod` method is available to [all Marionette classes](./common.md#triggermethod).**

### Listening to Events

Use `on` to register a callback directly on an emitter:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  initialize() {
    this.on('event:happened', this.logCall);
  },

  logCall(myVal) {
    console.log(myVal);
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/90Larbty/)

Use `listenTo` when the listener should own and later clean up the subscription:

```javascript
import { View } from 'marionette';

const OtherView = View.extend({
  initialize(someView) {
    this.listenTo(someView, 'event:happened', this.logCall);
  },

  logCall(myVal) {
    console.log(myVal);
  }
});

const MyView = View.extend();

const myView = new MyView();

const otherView = new OtherView(myView);

myView.triggerMethod('event:happened', 'someValue'); // Logs 'someValue'
```

[Live examples](https://jsfiddle.net/marionettejs/cm2rczqz/)

`listenTo` calls the callback with the listener as its context and records the
relationship for `stopListening`. A direct `on` subscription must be removed
with `off` when it is no longer needed. Marionette view lifecycles also clean up
their tracked `listenTo` relationships during destruction.

### Backbone interop

Backbone is optional. When an application uses Backbone entities, import the
explicit shim before constructing them:

```javascript
import 'marionette/backbone';
import Backbone from 'backbone';
import { View } from 'marionette';

const model = new Backbone.Model();
const view = new View();

view.listenTo(model, 'change', () => {
  // ...
});
```

The shim applies Marionette's `Events` mixin to supported Backbone instance
prototypes. It does not add Marionette event helpers to the `Backbone`
namespace. Import it before creating Backbone instances so all subscriptions
use the same bookkeeping. Handlers registered before the shim import remain in
Backbone's `_events` store and will not fire after the shim replaces the
prototype event methods; recreate those subscriptions after importing the shim.

### Private bookkeeping

Marionette stores event internals under `_rdEvents`, `_rdListeningTo`,
`_rdListeners`, and `_rdListenId`. These fields are private and replace the
Backbone-shaped `_events`, `_listeningTo`, and `_listenId` names. Plugins should
use `on`, `off`, `listenTo`, and `stopListening` instead of reading or writing
either set of private fields.

#### `onEvent` Binding

In addition to triggering listeners, `triggerMethod` can call specially named
methods on the instance. For
example, a view that has been rendered will internally fire `view.triggerMethod('render')`
and call `onRender` - providing a handy way to add behavior to your views.

Determining what method an event will call is easy, we will outline this with an
example using `before:dom:refresh` though this also works with any custom events
you want to fire:

1. Split the words around the `:` characters - so `before`, `dom`, `refresh`
2. Capitalize the first letter of each word - `Before`, `Dom`, `Refresh`
3. Add a leading `on` - `on`, `Before`, `Dom`, `Refresh`
4. Mash it into a single call - `onBeforeDomRefresh`

Using this process, `before:dom:refresh` will call the `onBeforeDomRefresh`
method. Let's see it in action with a custom event:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  onMyEvent(myVal) {
    console.log(myVal);
  }
});

const myView = new MyView();

myView.triggerMethod('my:event', 'someValue'); // Logs 'someValue'
```

[Live example](https://jsfiddle.net/marionettejs/oc8wwcnx/)

As before, all arguments passed into `triggerMethod` after the event name will make
their way into the event handler. Using this method ensures there will be no unexpected
memory leaks.

### View `events` and `triggers`

Views can automatically bind DOM events to methods and View events with [`events`](./dom.interactions.md#view-events)
and [`triggers`](./dom.interactions.md#view-triggers) respectively:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  events: {
    'click a': 'showModal'
  },

  triggers: {
    'keyup input': 'data:entered'
  },

  showModal(event) {
    console.log('Show the modal');
  },

  onDataEntered(view, event) {
    console.log('Data was entered');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/pq4xfchk/)

For more information, see the [DOM interactions documentation](./dom.interactions.md#binding-to-user-input).

### View entity events

Views can automatically bind to its model or collection with [`modelEvents`](./events.entity.md#model-events)
and [`collectionEvents`](./events.entity.md#collection-events) respectively.

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  modelEvents: {
    'change:someattribute': 'onChangeSomeattribute'
  },

  collectionEvents: {
    'update': 'onCollectionUpdate'
  },

  onChangeSomeattribute() {
    console.log('someattribute was changed');
  },

  onCollectionUpdate() {
    console.log('models were added or removed in the collection');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/h9ub5hp3/)

For more information, see the [Entity events documentation](./events.entity.md).

## Child View Events

The [`View`](marionette.view.md) and [`CollectionView`](marionette.collectionview.md)
are able to monitor and act on events on any of their direct children. Any events fired
on a view are automatically propagated to their direct parents as well. Let's
see a quick example:

```javascript
import { View, CollectionView } from 'marionette';

const Item = View.extend({
  tagName: 'li',

  triggers: {
    'click a': 'select:item'
  }
});

const Collection = CollectionView.extend({
  tagName: 'ul',

  childViewEvents: {
    'select:item': 'itemSelected'
  },

  itemSelected(childView) {
    console.log('item selected: ' + childView.model.id);
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/opyfvsfx/)

### Event Bubbling

Events fired on a view bubble up to their direct parent views, calling any
event methods using the `childview:` prefix (more on that shortly) and any
methods bound to the `childViewEvents` attribute. This works for built-in
events, custom events fired with `triggerMethod` and bound events using
`triggers`.

**NOTE** Automatic event bubbling can be disabled by setting
[`childViewEventPrefix`](#a-child-views-event-prefix) to `false`.

When using implicit listeners, the [`childview:*` event prefix](#a-child-views-event-prefix) is used which
needs to be included as part of the handler:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  triggers: {
    click: 'click:view'
  },

  doSomething() {
    this.triggerMethod('did:something', this);
  }
});

const ParentView = View.extend({
  regions: {
    foo: '.foo-hook'
  },

  onRender() {
    this.showChildView('foo', new MyView());
  },

  onChildviewClickView(childView) {
    console.log('View clicked ' + childView);
  },

  onChildviewDidSomething(childView) {
    console.log('Something was done to ' + childView);
  }
})
```

**NOTE** `triggers` will automatically pass the child view as an argument to the parent view, however `triggerMethod` will not, and so notice that in the above example, the `triggerMethod` explicitly passes the child view.

[Live example](https://jsfiddle.net/marionettejs/oquea4uy/)

#### Using `CollectionView`

This works exactly the same way for the `CollectionView` and its `childView`:

```javascript
import { View, CollectionView } from 'marionette';

const MyChild = View.extend({
  triggers: {
    click: 'click:child'
  }
});

const MyList = CollectionView.extend({
  onChildviewClickChild(childView) {
    console.log('Childview ' + childView + ' was clicked');
  }
});
```

[Live examples](https://jsfiddle.net/marionettejs/za27jys1/)

### A Child View's Event Prefix

You can customize the event prefix for events that are forwarded
through the view. To do this, set the `childViewEventPrefix`
on the view or collectionview. For more information on the `childViewEventPrefix` see
[Event bubbling](#event-bubbling).

The default value for `childViewEventPrefix` is `false`. Setting this property to
`false` will disable [automatic event bubbling](#event-bubbling).

```javascript
import 'marionette/backbone';
import Backbone from 'backbone';
import { CollectionView } from 'marionette';
import MyChildView from './my-child-view';

const myCollection = new Backbone.Collection([{}]);

const MyCollectionView = CollectionView.extend({
  childViewEventPrefix: 'some:prefix',
  childView: MyChildView
});

const collectionView = new MyCollectionView({
  collection: myCollection
});

collectionView.on('some:prefix:render', function(){
  // child view was rendered
});

collectionView.render();
```

[Live example](https://jsfiddle.net/marionettejs/as33hnk1/)

The `childViewEventPrefix` can be provided in the view definition or
in the constructor function call, to get a view instance.

### Explicit Event Listeners

To call specific functions on event triggers, use the `childViewEvents`
attribute to map child events to methods on the parent view. This takes events
fired on child views - _without the `childview:` prefix_ - and calls the
method referenced or attached function.

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  triggers: {
    click: 'view:clicked'
  }
});

const ParentView = View.extend({
  regions: {
    foo: '.foo-hook'
  },

  childViewEvents: {
    'view:clicked': 'displayMessage'
  },

  onRender() {
    this.showChildView('foo', new MyView());
  },

  displayMessage(childView) {
    console.log('Displaying message for ' + childView);
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/y92r99p2/)

#### Attaching Functions

The `childViewEvents` attribute can also attach functions directly to be event
handlers:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  triggers: {
    click: 'view:clicked'
  }
});

const ParentView = View.extend({
  regions: {
    foo: '.foo-hook'
  },

  childViewEvents: {
    'view:clicked'(childView) {
      console.log('Function called for ' + childView);
    }
  },

  onRender() {
    this.showChildView('foo', new MyView());
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/pnp1dd8j/)

#### Using `CollectionView`'s `childViewEvents`

```javascript
import { CollectionView } from 'marionette';

// childViewEvents can be specified as a hash...
const MyCollectionView = CollectionView.extend({
  childViewEvents: {
    // This callback will be called whenever a child is rendered or emits a `render` event
    render() {
      console.log('A child view has been rendered.');
    }
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/a2uvcfrp/)

### Triggering Events on Child Events

A `childViewTriggers` hash or method permits proxying of child view events without manually
setting bindings. The values of the hash should be a string of the event to trigger on the parent.

`childViewTriggers` is sugar on top of [`childViewEvents`](#explicit-event-listeners) much
in the same way that [view `triggers`](./dom.interaction.md#view-triggers) are sugar for [view `events`](./dom.interactions.md#view-events).

```javascript
import { View, CollectionView } from 'marionette';

// The child view fires a custom event, `show:message`
const ChildView = View.extend({

  // Events hash defines local event handlers that in turn may call `triggerMethod`.
  events: {
    'click .button': 'onClickButton'
  },

  triggers: {
    'submit form': 'submit:form'
  },

  onClickButton () {
    // Both `trigger` and `triggerMethod` events will be caught by parent.
    this.trigger('show:message', 'foo');
    this.triggerMethod('show:message', 'bar');
  }
});

// The parent uses childViewEvents to catch the child view's custom event
const ParentView = CollectionView.extend({
  childView: ChildView,

  childViewTriggers: {
    'show:message': 'child:show:message',
    'submit:form': 'child:submit:form'
  },

  onChildShowMessage (message) {
    console.log('A child view fired show:message with ' + message);
  },

  onChildSubmitForm (childView) {
    console.log('A child view fired submit:form');
  }
});

const GrandParentView = View.extend({
  regions: {
    list: '.list'
  },

  onRender() {
    this.showChildView('list', new ParentView({
      collection: this.collection
    }));
  },

  childViewEvents: {
    'child:show:message': 'showMessage'
  },

  showMessage(childView) {
    console.log('A child (' + childView + ') fired an event');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/8eq7vca5/)

#### Using `CollectionView`'s `childViewTriggers`

```javascript
import { View, CollectionView } from 'marionette';

// The child view fires a custom event, `show:message`
const ChildView = View.extend({

  // Events hash defines local event handlers that in turn may call `triggerMethod`.
  events: {
    'click .button': 'onClickButton'
  },

  // Triggers hash converts DOM events directly to view events catchable on the parent.
  // Note that `triggers` automatically pass the first argument as the child view.
  triggers: {
    'submit form': 'submit:form'
  },

  onClickButton () {
    // Both `trigger` and `triggerMethod` events will be caught by parent.
    this.trigger('show:message', 'foo');
    this.triggerMethod('show:message', 'bar');
  }
});

// The parent uses childViewEvents to catch the child view's custom event
const ParentView = CollectionView.extend({

  childView: ChildView,

  childViewTriggers: {
    'show:message': 'child:show:message',
    'submit:form': 'child:submit:form'
  },

  onChildShowMessage (message) {
    console.log('A child view fired show:message with ' + message);
  },

  onChildSubmitForm (childView) {
    console.log('A child view fired submit:form');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/edhqd2h8/)

## Lifecycle Events

Marionette Views fire events during their creation and destruction lifecycle.
For more information see the documentation covering the
[`View` Lifecycle](./view.lifecycle.md).
