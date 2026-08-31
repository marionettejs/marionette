# Common Marionette Concepts

This document covers the shared configuration patterns used by Marionette's
classes. Class-specific pages remain the authority for when a particular value
is read and whether it is read again.

## Documentation Index

* [Importing Marionette](#importing-marionette)
* [Class-based Inheritance](#class-based-inheritance)
  * [Value Attributes](#value-attributes)
  * [Functions Returning Values](#functions-returning-values)
  * [Binding Attributes on Instantiation](#binding-attributes-on-instantiation)
* [Common Marionette Functionality](./common.md)

## Importing Marionette

Install the v5 `marionette` package and use named imports:

```javascript
import { Application, View } from 'marionette';

const view = new View();
const app = new Application();
```

V5 has no default namespace export. The package also exposes explicit optional
integration subpaths; see [Installing Marionette](./installation.md) for the
current entrypoints and peer-dependency boundaries.

Existing no-bundler applications may serve the published
`dist/marionette.umd.js` artifact. It exposes the named API on the global
`Marionette` object and supports `Marionette.noConflict()`. Package-based named
imports are the canonical path for new applications.

## Class-based Inheritance

Like [Backbone](http://backbonejs.org/#Model-extend), Marionette provides a
pseudo-class `extend` method. [All built-in classes](./classes.md), such as
`View` and `MnObject`, provide this method.

The `protoProps` and `staticProps` hashes passed to `extend` contribute their own
enumerable string keys only. Symbols, non-enumerable properties, and inherited
properties on either input are ignored. Static properties inherited by the parent
constructor remain available on the child constructor.

In the example below, we create a new pseudo-class called `MyView`:

```javascript
import { View } from 'marionette';

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
import { View } from 'marionette';

const MyView = View.extend({
  className: 'bg-success',

  template: () => '<div class="my-region"></div>',

  regions: {
    myRegion: '.my-region'
  },

  modelEvents: {
    change: 'removeBackground'
  },

  removeBackground() {
    this.el.classList.remove('bg-success');
  }
});
```

When `MyView` creates its element, the element receives the `bg-success` class.
When the View renders, the `myRegion` Region targets `.my-region` within that
element. Entity-event behavior is documented separately because it depends on
an attached entity.

### Functions Returning Values

Many configuration attributes accept either a value or a function returning
that value. Attributes documented as value callbacks call the function with
the Marionette instance as `this`. A `template` function is the renderer itself
and instead receives serialized data as its argument; it does not receive the
View as `this`. Resolution timing is part of each attribute's contract; do not
assume every function runs during construction or that every result is cached
for the object's lifetime.

<!-- executable-example: basics-class-configuration -->
```javascript
import { View } from 'marionette';

let cancelCalls = 0;
let defaultCalls = 0;
let overrideCalls = 0;
let templateContext;
let templateData;

const MyView = View.extend({
  options() {
    this.optionsResolutionCount = (this.optionsResolutionCount || 0) + 1;
    return {
      count: 1,
      enabled: true,
      label: 'default',
      tone: 'quiet'
    };
  },

  className() {
    this.classNameResolutionCount = (this.classNameResolutionCount || 0) + 1;
    return `notice-${this.getOption('tone')}`;
  },

  template(data) {
    templateContext = this;
    templateData = data;
    return '<button class="save">Save</button><button class="cancel">Cancel</button>';
  },

  triggers: {
    'click .cancel': 'cancel:default',
    'click .save': 'save:default'
  },
});

const view = new MyView({
  count: 0,
  enabled: false,
  label: null,
  tone: 'urgent',
  triggers: {
    'click .save': 'save:override'
  },
});

const classNameBeforeRender = view.el.className;

view.on('cancel:default', () => {
  cancelCalls += 1;
});

view.on('save:default', () => {
  defaultCalls += 1;
});

view.on('save:override', () => {
  overrideCalls += 1;
});

view.render();
view.el.querySelector('.save').click();
view.el.querySelector('.cancel').click();

export {
  cancelCalls,
  classNameBeforeRender,
  defaultCalls,
  overrideCalls,
  templateContext,
  templateData,
  view
};
```

Here `options()` supplies class defaults, the constructor's `tone` wins, and
`className()` resolves while the View creates its element. The constructor's
`triggers` map replaces the class map rather than merging with it.

### Function Context

Use a normal method when a configuration callback needs the instance context.
An arrow function retains its surrounding lexical `this`, so it is appropriate
only when the callback does not need the Marionette instance.

### Binding Attributes on Instantiation

The documented constructor options for each class can replace matching values
defined on its prototype. This supports runtime configuration such as a View's
events, triggers, model, collection, and Region definitions:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  template: () => '<a href="#details">Details</a>'
});

const myView = new MyView({
  triggers: {
    'click a': 'show:link'
  }
});
```

This will set a trigger called `show:link` that will be fired whenever the user
clicks an `<a>` inside the view.

Constructor values replace matching class values; map options are not
implicitly deep-merged. For example:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  template: () => '<button class="save">Save</button><a href="#details">Details</a>',

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

In this example, `show:link` is the only configured trigger. The constructor's
`triggers` object completely replaces the class-defined object.

## Setting Options

Every Marionette class stores its merged class defaults and constructor values
on `this.options`. `getOption(name)` reads a defined value from `this.options`
before falling back to the instance. A constructor value of `false`, `null`, or
`0` therefore remains an intentional override; only `undefined` falls through.

Resolved class defaults and constructor option hashes contribute their own
enumerable string properties when Marionette builds `options`. Inherited,
symbol, and non-enumerable properties are ignored. `mergeOptions` applies the
same rule to the named options copied onto an instance.

```javascript
import { View } from 'marionette';

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

Constructor/default option merges use own enumerable string properties. See
[`getOption` and `mergeOptions`](./common.md#getoption) for the exact lookup and
copying boundaries.

## Common Marionette Functionality

Marionette has a few methods and core functionality that are common to [all classes](./classes.md).

[Continue Reading...](./common.md).
