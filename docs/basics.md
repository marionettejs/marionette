# Common Marionette Concepts

This document covers the basic usage patterns and concepts across Marionette.
This includes things like calling conventions, setting attributes, common option
patterns etc.

## Documentation Index

* [Using ES6 Modules](#using-es6-modules)
* [Class-based Inheritance](#class-based-inheritance)
  * [Value Attributes](#value-attributes)
  * [Functions Returning Values](#functions-returning-values)
  * [Binding Attributes on Instantiation](#binding-attributes-on-instantiation)
* [Common Marionette Functionality](./common.md)

## Using ES6 Modules

Marionette still supports using the library via an inline script.
The UMD build supports `noConflict()`.

```html
<script src="./backbone.marionette.js"></script>
<script>const MyMarionette = Marionette.noConflict();</script>
<script>new MyMarionette.View({ el: 'body' });</script>
```

The recommended solution is to choose a solution like a [package manager](./installation.md)
to allow for ES6 module importing of the library. The best way to import is using name imports.

```javascript
import { View } from 'backbone.marionette';
import * as Mn from 'backbone.marionette';

new View({ el: 'body' });
new Mn.Application();
```

However to support backwards compatibility Marionette exports all of its classes and
functions on a default object. This default export may be removed in a future version of
Marionette and it is recommend to migrate to a named imports.

```javascript
import Marionette from 'backbone.marionette';

new Marionette.Application();
```

## Class-based Inheritance

Like [Backbone](http://backbonejs.org/#Model-extend), Marionette utilizes the
[`_.extend`](http://underscorejs.org/#extend) function to simulate class-based
inheritance. [All built-in classes](./classes.md), such as `Marionette.View`, `Marionette.MnObject`
and everything that extend these provide an `extend` method for just this purpose.

In the example below, we create a new pseudo-class called `MyView`:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({});
```

You can now create instances of `MyView` with JavaScript's `new` keyword:

```javascript
const view = new MyView();
```

### Value Attributes

When we extend classes, we can provide class attributes with specific values by
defining them in the object we pass as the `extend` parameter:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  className: 'bg-success',

  template: '#template-identifier',

  regions: {
    myRegion: '.my-region'
  },

  modelEvents: {
    change: 'removeBackground'
  },

  removeBackground() {
    this.$el.removeClass('bg-success');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/k93pejyb/)

When we instantiate `MyView`, each instance will be given a `.bg-success` class
with a `myRegion` region created on the `.my-region` element.

### Functions Returning Values

In almost every instance where we can set a value, we can also assign a function
to figure out the value at runtime. In this case, Marionette will run the
function on instantiation and use the returned value:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  className() {
    return this.model.successful() ? 'bg-success' : 'bg-error';
  },

  template: '#template-identifier',

  regions() {
    return {
      myRegion: '.my-region'
    };
  },

  modelEvents() {
    const wasSuccessful = this.model.successful();
    return {
      change: wasSuccessful ? 'removeBackground' : 'alert'
    };
  },

  removeBackground() {
    this.$el.removeClass('bg-success');
  },

  alert() {
    console.log('model changed');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/nn1754fc/)

As we can see, almost all of the attributes here can be worked out dynamically.
In most cases, Marionette will call the function once at instantiation, or first
render, and preserve the value throughout the lifetime of the View. There are
some exceptions to this rule - these will be referred to with their respective
documentation.

### Function Context

When using functions to set attributes, Marionette will assign the instance of
your new class as `this`. You can use this feature to ensure you're able to
access your object in cases where `this` isn't what you might expect it to be.

### Binding Attributes on Instantiation

In Marionette, most attributes can be bound on class instantiation in addition
to being set when the [class is defined](#class-based-inheritance). You can use
this to bind events, triggers, models, and collections at runtime:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: '#template-identifier'
});

const myView = new MyView({
  triggers: {
    'click a': 'show:link'
  }
});
```

This will set a trigger called `show:link` that will be fired whenever the user
clicks an `<a>` inside the view.

Options set here will override options set on class definition. So, for example:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: '#template-identifier',

  triggers: {
    'click @ui.save': 'save:form'
  }
});

const myView = new MyView({
  triggers: {
    'click a': 'show:link'
  }
});
```

In this example, the trigger for `save:form` will no longer be fired, as the
trigger for `show:link` completely overrides it.

## Setting Options

Marionette can set options when you instantiate a class. This lets you override
many class-based attributes when you need to. You can also pass new information
specific to the object in question that it can access through special helper
methods.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  checkOption() {
    console.log(this.getOption('foo'));
  }
});

const view = new MyView({
  foo: 'some text'
});

view.checkOption();  // prints 'some text'
```

[Live example](https://jsfiddle.net/marionettejs/6n02ex1m/)

## Common Marionette Functionality

Marionette has a few methods and core functionality that are common to [all classes](./classes.md).

[Continue Reading...](./common.md).
