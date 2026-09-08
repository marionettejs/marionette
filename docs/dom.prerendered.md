# Prerendered Content

View classes can be initialized with pre-rendered DOM.

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


In both of the cases at instantiation the view will determine
its state as to whether the el is rendered
or attached.

**Note** `render` and `attach` events will not fire for the initial
state as the state is set already at instantiation and is not changing.

## Managing `View` children

With `View`, the `render` event is usually the best place to show child views for
efficient nested rendering.

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
  el() {
    return document.querySelector('#base-layout');
  },
  initialize() {
   this.showChildView('header', new HeaderView());
  }
});
```

### Managing a Pre-existing View Tree.

It may be the case that you need child views of already existing DOM as well.
Query the existing DOM for each child's element. A Region declared with a
selector may still hold that selector in `region.el` before its first show;
`getRegion()` does not resolve it. Query from the owning View's concrete `el`:

The page contains this existing markup before the module runs:

```html
<main id="base-layout">
  <div id="header-region"><header><h1>Existing account</h1></header></div>
  <div id="content-region"></div>
</main>
```

<!-- executable-example: prerendered-owned-tree -->
```javascript
import { View } from 'marionette';

export const HeaderView = View.extend({
  tagName: 'header',
  template: () => '<h1>Account</h1>'
});

export const BaseLayout = View.extend({
  regions: {
    header: '#header-region',
    content: '#content-region'
  },
  el() {
    return document.querySelector('#base-layout');
  },
  initialize() {
    this.showChildView('header', new HeaderView({
      el: this.el.querySelector('#header-region').firstElementChild
    }));
  }
});

export const layout = new BaseLayout();
```

The child owns the existing `header` element. Its existing content is retained
when shown because it is already rendered. Destroying the layout destroys its
child and removes the owned tree. The [fixture](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-prerendered-content/validate.mjs)
checks element identity, retained content, parent ownership, and cleanup.


The same can be done with `CollectionView`. This fragment assumes an existing
`#base-table` with a `tbody` containing one row per item, in source order. Supply
the application's `someCollection` and configure its DataApi before construction
when using an observable collection:

```javascript
import { CollectionView } from 'marionette';
import RowView from './row-view';

const MyList = CollectionView.extend({
  el() {
    return document.querySelector('#base-table');
  },
  childView: RowView,
  childViewContainer: 'tbody',
  buildChildView(model, ChildView, childViewOptions) {
    const index = this.Data.models(this.collection).indexOf(model);
    const childEl = this.el.querySelector('tbody').children[index];

    return new ChildView({
      model,
      ...childViewOptions,
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
import { View } from 'marionette';
import HeaderView from './header-view';

const MyBaseLayout = View.extend({
  regions: {
    header: '#header-region',
    content: '#content-region'
  },
  el() {
    return document.querySelector('#base-layout');
  },
  initialize() {
    this.showChildView('header', new HeaderView({
      el: this.el.querySelector('#header-region').firstElementChild
    }));
  },
  template: () => '<div id="header-region"></div><div id="content-region"></div>',
  onRender() {
    this.showChildView('header', new HeaderView());
  }
});
```
