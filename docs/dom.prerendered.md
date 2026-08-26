# Prerendered Content

[View classes](./classes.md) can be initialized with pre-rendered DOM.

This can be HTML that's currently in the DOM:

```javascript
import { View } from 'marionette';

const myView = new View({ el: document.querySelector('#foo-selector') });

myView.isRendered(); // true if '#foo-selector' exists and has content
myView.isAttached(); // true if '#foo-selector' is in the DOM
```

Or it can be DOM created in memory:

```javascript
import { View } from 'marionette';

const inMemoryHtml = document.createElement('div');
inMemoryHtml.textContent = 'Hello World!';

const myView = new View({ el: inMemoryHtml });
```

[Live example](https://jsfiddle.net/marionettejs/b2yz38gj/)

In both of the cases at instantiation the view will determine
[its state](./view.lifecycle.md) as to whether the el is rendered
or attached.

**Note** `render` and `attach` events will not fire for the initial
state as the state is set already at instantiation and is not changing.

## Managing `View` children

With [`View`](./marionette.view.md) in most cases the [`render` event](./events.class.md#render-and-beforerender-events)
is the best place to show child views [for best performance](./marionette.view.md#efficient-nested-view-structures).

However with pre-rendered DOM you may need to show child views in `initialize`
as the view will already be rendered.

```javascript
import { View } from 'marionette';
import HeaderView from './header-view';

const MyBaseLayout = View.extend({
  regions: {
    header: '#header-region',
    content: '#content-region'
  },
  el: document.querySelector('#base-layout'),
  initialize() {
   this.showChildView('header', new HeaderView());
  }
});
```

### Managing a Pre-existing View Tree.

It may be the case that you need child views of already existing DOM as well.
To set this up you'll need to query for `el`s down the tree:

```javascript
import { View } from 'marionette';
import HeaderView from './header-view';

const MyBaseLayout = View.extend({
  regions: {
    header: '#header-region',
    content: '#content-region'
  },
  el: document.querySelector('#base-layout'),
  initialize() {
    this.showChildView('header', new HeaderView({
      el: this.getRegion('header').el.firstElementChild
    }));
  }
});
```

The same can be done with [`CollectionView`](./marionette.collectionview.md):

```javascript
import { CollectionView } from 'marionette';
import ItemView from './item-view';

const MyList = CollectionView.extend({
  el: document.querySelector('#base-table'),
  childView: ItemView,
  childViewContainer: 'tbody',
  buildChildView(model, ChildView) {
    const index = this.collection.indexOf(model);
    const childEl = this.el.querySelector('tbody').children[index];

    return new ChildView({
      model,
      el: childEl
    });
  }
});

const myList = new MyList({ collection: someCollection });

// Unlike `View`, `CollectionView` should be rendered to build the `children`
myList.render();
```

## Re-rendering children of a view with preexisting DOM.

You may be instantiating a `View` with existing HTML, but if you re-render the view,
like any other view, your view will render the `template` into the view's `el` and
any children will need to be re-shown.

So your view will need to be prepared to handle both scenarios.

```javascript
import _ from 'underscore';
import { View } from 'marionette';
import HeaderView from './header-view';

const MyBaseLayout = View.extend({
  regions: {
    header: '#header-region',
    content: '#content-region'
  },
  el: document.querySelector('#base-layout'),
  initialize() {
    this.showChildView('header', new HeaderView({
      el: this.getRegion('header').el.firstElementChild
    }));
  },
  template: _.template('<div id="header-region"></div><div id="content-region"></div>'),
  onRender() {
    this.showChildView('header', new HeaderView());
  }
});
```
