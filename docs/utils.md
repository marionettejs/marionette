# Marionette Utility Functions

Marionette provides a set of utility / helper functions that are used to
facilitate common behaviors throughout the framework. These functions may
be useful to those that are building on top of Marionette, as they provide
a way to get the same behaviors and conventions from your own code.

## Documentation Index

* [extend](#extend)
* [Common Method Utilities](#common-method-utilities)
* [VERSION](#version)

## extend

Backbone's `extend` function is a useful utility to have, and is used in
various places in Marionette. To make the use of this method more consistent,
Backbone's `extend` has been exported `extend`. This allows you to get the
extend functionality for your object without having to decide if you want to
use Backbone.View or Backbone.Model or another Backbone object to grab the
method from.

```javascript
import { extend } from 'backbone.marionette';

const Foo = function(){};

// use Marionette.extend to make Foo extendable, just like other
// Backbone and Marionette objects
Foo.extend = extend;

// Now Foo can be extended to create a new class, with methods
const Bar = Foo.extend({

  someMethod(){ ... }

  // ...
});

// Create an instance of Bar
const b = new Bar();
```

[Live example](https://jsfiddle.net/marionettejs/w5avq89r/)

## Common Method Utilities

These [common utilities](./common.md) are available to all Marionette classes and exported
so that the functionality can be used elsewhere. Each method has the same arguments as documented
in [common utilities](./common.md) except that the target of the method is added as the first argument.

For instance:
```javascript
import { View, triggerMethod, getOption } from 'backbone.marionette';

const MyView = View.extend({
  initialize() {
    this.triggerMethod('foo', this.getOption('foo'));
  },
  onFoo() {
    console.log('bar');
  }
});

// logs "bar"
const myView = new MyView({ foo: 'bar' });

// Same as initialize, logs "bar"
triggerMethod(myView, 'foo', getOption(myView, 'foo'));
```

* [triggerMethod](./common.md#triggermethod)
  - Trigger an event and a corresponding method on the target object.
* [bindEvents](./common.md#bindevents)
  - This method is used to bind a backbone "entity" to methods on a target object.
* [unbindEvents](./common.md#unbindevents)
  - This method can be used to unbind callbacks from entities' events.
* [bindRequests](./common.md#bindrequests)
  - This method is used to bind backbone radio replies to methods on a target object.
* [unbindRequests](./common.md#unbindrequests)
  - This method can be used to unbind radio reply handler from entities' events.
* [normalizeMethods](./common.md#normalizemethods)
  - Receives a hash of event names and functions and/or function names,
    and returns the same hash with the function names replaced with the function references themselves.
* [getOption](./common.md#getoption)
  - Retrieve an object's attribute either directly from the object, or from the object's `this.options`.
* [mergeOptions](./common.md#mergeoptions)
  - A handy function to pluck certain `options` and attach them directly to an instance.

## VERSION

Maintains a reference to the version of a Marionette instance.
`VERSION` is used to direct users to the correctly versioned documentation when errors are thrown.
