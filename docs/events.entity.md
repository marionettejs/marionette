# Entity events

The [`View`, `CollectionView` and `Behavior`](./classes.md) can bind to events that occur on attached models and
collections - this includes both [standard backbone-events](http://backbonejs.org/#Events-catalog) and custom events.

Event handlers are called with the same arguments as if listening to the entity directly
and called with the context of the view instance.

### Model Events

For example, to listen to a model's events:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  modelEvents: {
    'change:attribute': 'onChangeAttribute'
  },

  onChangeAttribute(model, value) {
    console.log('New value: ' + value);
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/auvk4hps/)

The `modelEvents` attribute passes through all the arguments that are passed
to `model.trigger('event', arguments)`.

The `modelEvents` attribute can also take a
[function returning an object](basics.md#functions-returning-values).

#### Function Callback

You can also bind a function callback directly in the `modelEvents` attribute:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  modelEvents: {
    'change:attribute'() {
      console.log('attribute was changed');
    }
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/zaxLe6au/)

### Collection Events

Collection events work exactly the same way as [`modelEvents`](#model-events)
with their own `collectionEvents` key:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  collectionEvents: {
    sync: 'onSync'
  },

  onSync(collection) {
    console.log('Collection was synchronised with the server');
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/7qyfeh9r/)

The `collectionEvents` attribute can also take a
[function returning an object](basics.md#functions-returning-values).

Just as in `modelEvents`, you can bind function callbacks directly inside the
`collectionEvents` object:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  collectionEvents: {
    'update'() {
      console.log('the collection was updated');
    }
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/ze8po0x5/)

### Listening to Both

If your view has a `model` and `collection` attached, it will listen for events
on both:

```javascript
import { View } from 'backbone.marionette';

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

In this case, Marionette will bind event handlers to both.
