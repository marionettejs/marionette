# Common Marionette Functionality

Marionette has a few methods that are common to [all classes](./classes.md).

## Documentation Index

* [initialize](#initialize)
* [extend](#extend)
* [Events API](#events-api)
* [triggerMethod](#triggermethod)
* [bindEvents](#bindevents)
* [unbindEvents](#unbindevents)
* [bindRequests](#bindrequests)
* [unbindRequests](#unbindrequests)
* [normalizeMethods](#normalizemethods)
* [getOption](#getoption)
* [mergeOptions](#mergeoptions)
* [The `options` Property](#the-options-property)

### `initialize`

Like the backbone classes, `initialize` is a method you can define on any Marionette class
that will be called when the class is instantiated and will be passed any arguments passed
at instantiation.  The first argument may contain [options](#getoption) the class attaches
to the instance.

```js
import { MnObject } from 'backbone.marionette';

const MyObject = MnObject.extend({
  initialize(options, arg2) {
    console.log(options.foo, this.getOption('foo'), arg2);
  }
});

const myObject = new MyObject({ foo: 'bar' }, 'baz'); // logs "bar" "bar" "baz"
```

[Live example](https://jsfiddle.net/marionettejs/1ytrwyog/)

### `extend`

Borrowed from backbone, `extend` is available on all class definitions for
[class based inheritance](./basics.md#class-based-inheritance)

### Events API

The [Backbone.Events API](http://backbonejs.org/#Events) is available to all classes.
Each Marionette class can both `listenTo` any object with this API and have events
triggered on the instance.

**Note** The events API should not be confused with [view `events`](/.dom.interactions.md#view-events)
which capture DOM events.

### `triggerMethod`

Trigger an event and [a corresponding method](./events.md#onevent-binding) on the object.
It is the same as `Backbone`'s [`trigger`](http://backbonejs.org/#Events-trigger)
but with the additional method handler.

When an event is triggered, the first letter of each section of the
event name is capitalized, and the word "on" is prepended to the front
of it. Examples:

* `triggerMethod('foo')` fires the "onFoo" function
* `triggerMethod('before:foo')` fires the "onBeforeFoo" function

All arguments that are passed to the `triggerMethod` call are passed along
to both the event and the method, with the exception of the event name not
being passed to the corresponding method.

`triggerMethod('foo', bar)` will call `onFoo(bar){...})`


```javascript
import { MnObject } from 'backbone.marionette';

const MyObject = MnObject.extend({
  initialize(){
    this.triggerMethod('foo', 'baz');
  },
  onFoo(bar){
    console.log(bar);
  }
});

const myObj = new MyObject(); // console.log "baz"

myObj.triggerMethod('foo', 'qux'); // console.log "qux"
```

More information on `triggerMethod` can be found in the [Marionette events documentation](./events.md#triggermethod).

### `bindEvents`

This method is used to bind any object that works with the [`Backbone.Events` API](#events-api).
This includes all Backbone classes, Marionette classes and [Radio](./backbone.radio.md) channels.

```javascript
import Radio from 'backbone.radio';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  fooEvents: {
    'change:foo': 'doSomething'
  },
  initialize(){
    this.fooChannel = Radio.channel('foo');
    this.bindEvents(this.fooChannel, this.fooEvents);
  },
  doSomething(){
    // the "change:foo" event was fired from the radio channel
    // respond to it appropriately, here.
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/L640ecac/)

The first parameter is the `entity` (Backbone.Model, Backbone.Collection or
any object that has Backbone.Events mixed in) to bind the events from.

The second parameter is a hash of `{ 'event:name': 'eventHandler' }`
configuration. A function can be supplied instead of a string handler name.

**Errors** An error will be thrown if the second parameter is not an object.

### `unbindEvents`

This method is used to unbind any object that works with the [`Backbone.Events` API](#events-api).
This includes all Backbone classes, Marionette classes and [Radio](./backbone.radio.md) channels.

Calling this method without a events hash will unbind all events from the channel.

```javascript
import Radio from 'backbone.radio';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  fooEvents: {
    'change:foo': 'onChangeFoo',
    'stop': 'onStop'
  },
  initialize(){
    this.fooChannel = Radio.channel('foo');
    this.bindEvents(this.fooChannel, this.fooEvents);
  },
  onChangeFoo(){
    // the "change:foo" event was fired from the radio channel
    // respond to it appropriately, here.

    // Doing something
    this.listenTo(this.fooChannel, 'adhoc', this.render);
  },
  onStop() {
    // Removes all fooEvents
    this.unbindEvents(this.fooChannel, this.fooEvents);

    // Removes all bound fooChannel events including `adhoc`
    this.unbindEvents(this.fooChannel);
  }
});
```

The first parameter is the `entity` (Backbone.Model, Backbone.Collection or
any object that has Backbone.Events mixed in) to bind the events from.

The second parameter is a hash of `{ 'event:name': 'eventHandler' }`
configuration. A function can be supplied instead of a string handler name.
If the second paramater is not supplied, all listeners are removed.

[Live example](https://jsfiddle.net/marionettejs/yvsfm65c/)

### `bindRequests`

This method is used to bind any object that works with the [`Backbone.Radio` Request API](https://github.com/marionettejs/backbone.radio#backboneradiorequests).
This includes [Radio](./backbone.radio.md) channels.

```javascript
import Radio from 'backbone.radio';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  channelName: 'myChannelName',
  radioRequests: {
    'foo:bar': 'doFooBar'
  },
  initialize() {
    const channel = Radio.channel(this.channelName);
    this.bindRequests(channel, this.radioRequests);
  },
  doFooBar() {
    console.log('foo:bar');
    return 'bar';
  }
 });

const myView = new MyView();
const channel = Radio.channel('myChannelName');
channel.request('foo:bar'); // Logs 'foo:bar' and returns 'bar'
```

[Live example](https://jsfiddle.net/marionettejs/hmjgkg7w/)

The first parameter, `channel`, is an instance from `Radio`.

The second parameter is a hash of `{ 'request:name': 'replyHandler' }`
configuration. A function can be supplied instead of a string handler name.

**Errors** An error will be thrown if the second parameter is not an object.

### `unbindRequests`

This method is used to unbind any object that works with the [`Backbone.Radio` Request API](https://github.com/marionettejs/backbone.radio#backboneradiorequests).

Calling this method without a radio requests hash will unbind all requests
from the channel.

**NOTE: To avoid memory leaks, `unbindRequests` should be called
in or before `onBeforeDestroy`.**

```javascript
import Radio from 'backbone.radio';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  channelName: 'myChannelName',
  radioRequests: {
    'foo:bar': 'doFooBar'
  },
  onAttach() {
    const channel = Radio.channel(this.channelName);
    this.bindRequests(channel, this.radioRequests);
  },
  onBeforeDetach() {
    const channel = Radio.channel(this.channelName);
    this.unbindRequests(channel, this.radioRequests);
  }
 });
```

[Live examples](https://jsfiddle.net/marionettejs/r5kmwwke/)

The first parameter, `channel`, is an instance from `Radio`.

The second parameter is a hash of `{ 'request:name': 'replyHandler' }`
configuration. A function can be supplied instead of a string handler name.
If the second paramater is not supplied, all handlers are removed.

### `normalizeMethods`

Receives a hash of event names and functions and/or function names, and returns the
same hash with the function names replaced with the function references themselves.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  initialize() {
    const hash = {
      'action:one': 'handleActionOne', // This will become a reference to `this.handleActionOne`
      'action:two': this.handleActionTwo
    };

    this.normalizedHash = this.normalizeMethods(hash);
  },

  do(action) {
    this.normalizedHash[action]();
  },

  handleActionOne() {
    console.log('action:one was fired');
  },

  handleActionTwo() {
    console.log('action:two was fired');
  }

});

const myView = new MyView();
myView.do('action:one');
myView.do('action:two');
```

[Live example](https://jsfiddle.net/marionettejs/zzjhm4p1/)

### `getOption`

To access an option, we use the `getOption` method. `getOption` will fall back
to the value of the same name defined on the instance if not defined in the options.

```javascript
import { View } from 'backbone.marionette';

const View = View.extend({
  classVal: 'class value',
  initialize(){
    this.instanceVal = 'instance value'
  }
});

const view = new View({ optVal: 'option value' });

view.getOption('instanceVal'); // instance value
view.getOption('classVal'); // class value
view.getOption('optVal'); // option value

const view2 = new View({ instanceVal: 'foo', classVal: 'bar', optVal: 'baz' });

view.getOption('instanceVal'); // foo
view.getOption('classVal'); // bar
view.getOption('optVal'); // baz
```

[Live example](https://jsfiddle.net/marionettejs/ekvb8wwa/)

#### Falsey values

The `getOption` function will return any falsey value from the `options`,
other than `undefined`. If an object's options has an undefined value, it will
attempt to read the value from the object directly.

For example:

```javascript
import { MnObject } from 'backbone.marionette';

const MyObject = MnObject.extend({
  foo: 'bar',

  initialize() {
    console.log(this.getOption('foo'));
  }
});

const model1 = new MyObject(); // => "bar"

const myObj = {};
console.log(myObj.foo); // undefined
const model2 = new MyObject({ foo: myObj.foo }); // => "bar"
```

[Live example](https://jsfiddle.net/marionettejs/2ddk28ap/)

In this example, "bar" is returned both times because the second
example has an undefined value for `f`.

### `mergeOptions`

The `mergeOptions` method takes two arguments: an `options` object and `keys` to
pull from the options object. Any matching `keys` will be merged onto the
class instance. For example:

```javascript
import { MnObject } from 'backbone.marionette';

const MyObject = MnObject.extend({
  initialize(options) {
    this.mergeOptions(options, ['model', 'something']);
    // this.model and this.something will now be available
  }
});

const myObject = new MyObject({
  model: new Backbone.Model(),
  something: 'test',
  another: 'value'
});

console.log(myObject.model);
console.log(myObject.something);
console.log(myObject.getOption('another'));
```

[Live example](https://jsfiddle.net/marionettejs/ub510cbx/)

In this example, `model` and `something` are directly available on the
`MyObject` instance, while `another` must be accessed via `getOption`. This is
handy when you want to add extra keys that will be used heavily throughout the
defined class.

### The `options` Property

The Marionette classes accept an `options` property in the class definition
which is merged with the `options` argument passed at instantiation. The
values from the passed in `options` overrides the property values.

> The `options` argument passed in `initialize` method is equal to the passed at
> class instantiation. To get the option inside initialize considering the
> `options` property is necessary to use `getOption`

```javascript
import { MnObject } from 'backbone.marionette';

const MyObject = MnObject.extend({
  options: {
    foo: 'bar',
    another: 'thing'
  },

  initialize(options) {
    console.log(options.foo) // undefined
    console.log(this.getOption('foo')) // 'bar'
    console.log(this.getOption('another')) // 'value'
  }
});

const myObject = new MyObject({
  another: 'value'
});
```

## Marionette Classes

Marionette provides a few classes for building your view tree and
application structure.

[Continue Reading...](./classes.md).
