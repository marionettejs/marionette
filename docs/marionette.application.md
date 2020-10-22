# Marionette.Application

The `Application` provides hooks for organizing and initiating other elements
and a view tree.

`Application` includes:
- [Common Marionette Functionality](./common.md)
- [Class Events](./events.class.md#application-events)
- [Radio API](./backbone.radio.md#marionette-integration)
- [MnObject's API](./marionette.mnobject.md)

In addition to `MnObject`'s API, Application provides two significant additions.
A simple lifecycle hook with [`start`](#starting-an-application) and a [single region](#application-region)
for attaching a view tree.

One additional difference is the `Application` [`cidPrefix`](./marionette.mnobject.md#unique-client-id) is `mna`.

## Documentation Index

* [Instantiating An Application](#instantiating-an-application)
* [Starting An Application](#starting-an-application)
* [Application Region](#application-region)
* [Application Region Methods](#application-region-methods)

## Instantiating an Application

When instantiating a `Application` there are several properties, if passed,
that will be attached directly to the instance:
`channelName`, `radioEvents`, `radioRequests`, `region`, `regionClass`

```javascript
import { Application } from 'backbone.marionette';

const myApplication = new Application({ ... });
```

## Starting An Application

Once you have your application configured, you can kick everything off by
calling: `myApp.start(options)`.

This function takes a single optional argument to pass along to the events.

```javascript
import Bb from 'backbone';
import { Application } from 'backbone.marionette';

const MyApp = Application.extend({
  region: '#root-element',

  initialize(options) {
    console.log('Initialize');
  },

  onBeforeStart(app, options) {
    this.model = new MyModel(options.data);
  },

  onStart(app, options) {
    this.showView(new MyView({model: this.model}));
    Bb.history.start();
  }
});

const myApp = new MyApp();

myApp.start({
  data: {
    id: 1,
    text: 'value'
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/k05dctyt/)

## Application Region

An `Application` provides a single [region](./marionette.region.md) for attaching a view tree.
The `region` property can be [defined in multiple ways](./marionette.region.md#defining-regions)

```javascript
import { Application } from 'backbone.marionette';
import RootView from './views/root';

const MyApp = Application.extend({
  region: '#root-element',

  onStart() {
    this.showView(new RootView());
  }
});

const myApp = new MyApp();
myApp.start();
```

[Live example](https://jsfiddle.net/marionettejs/uzc8or6u/)

This will immediately render `RootView` and fire the usual triggers such as
`before:attach` and `attach` in addition to the `before:render` and `render`
triggers.

`region` can also be passed as an option during instantiation.

### `regionClass`

By default the [`Region`](./marionette.region.md) is used to instantiate the `Application`'s region.
An extended Region can be provided to the `Application` definition to override the default.

```javascript
import { Application, Region } from 'backbone.marionette';

const MyRegion = Region.extend({
  isSpecial: true
});

const MyApp = Application.extend({
  regionClass: MyRegion
});

const myApp = new Application({ region: '#foo' });

myApp.getRegion().isSpecial; // true
```

`regionClass` can also be passed as an option during instantiation.

## Application Region Methods

The Marionette Application provides helper methods for managing its attached region.

### `getRegion()`

Return the attached [region object](./marionette.region.md) for the Application.

### `showView(view)`

Display a `View` instance in the region attached to the Application. This runs the [`View lifecycle`](./view.lifecycle.md).

### `getView()`

Return the view currently being displayed in the Application's attached
`region`. If the Application is not currently displaying a view, this method
returns `undefined`.
