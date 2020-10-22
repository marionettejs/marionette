# The DOM API

With the release of Marionette 3.2, developers can remove the dependency on
jQuery and integrate with the DOM using a custom api.

## API Methods

The DOM API manages the DOM on behalf of [each view class and `Region`](./classes.md).
It defines the methods that actually attach and remove views and children.

[The default API](#the-default-api) depends on Backbone's jQuery `$` object however it does not
rely on jQuery-specific behavior. This should make it easier to develop your own
API. You will, however, [need to also handle Backbone's jQuery integration](#backbone-jquery-integration).

### `createBuffer()`

Returns a new HTML DOM node instance. The resulting node can be passed into the
other DOM functions.

### `getDocumentEl(el)`

Look up the top level element of `el`. Used by Marionette to determine attachment.

```javascript
const elIsAttached = this.Dom.hasEl(this.Dom.getDocumentEl(this.el), this.el);
```

### `getEl(selector)`

Lookup the `selector` string withing the DOM. The `selector` may also be a DOM element.
It should return an array-like object of the node.

### `findEl(el, selector)`

Lookup the `selector` string within the DOM node `el`. It should return an array-like object of nodes.

### `hasEl(el, childEl)`

Returns true if the el contains the node childEl

### `detachEl(el)`

Detach `el` from the DOM without removing listeners.

### `replaceEl(newEl, oldEl)`

Remove `oldEl` from the DOM and put `newEl` in its place.

### `swapEl(el1, el2)`

Swaps the location of `el1` and `el2` in the DOM.
Both els must have a parentNode to be able to swap.

### `setContents(el, html)`

Replace the contents of `el` with the HTML string of `html`. Unlike other DOM
functions, this only takes a literal string for its second argument.

### `appendContents(el, contents)`

Takes the DOM node `el` and appends the DOM node `contents` to the end of the
element's contents.

### `hasContents(el)`

Returns a boolean indicating if the `el` has child nodes.

### `detachContents(el)`

Remove the inner contents of `el` from the DOM while leaving `el` itself in the
DOM.

## The default API

The API used by Marionette by default is attached as `Marionette.DomApi`.
This is useful if you [change the API](#providing-your-own-dom-api) globally,
but want to reuse the default in certain cases.

```javascript
import { setDomApi, DomApi } from 'backbone.marionette';

import MyDOMApi from './mydom';

setDomApi(MyDOMApi);

// Use MyDOMApi everywhere but `Marionette.View`
View.setDomApi(DomApi);
```

## Providing Your Own DOM API

To implement your own DOM API use `setDomApi`:

```javascript
import { setDomApi } from 'backbone.marionette';
import MyDOMApi from './mydom';

setDomApi(MyDOMApi);
```

You can also implement a different DOM API for a particular class:

```javascript
import { View } from 'backbone.marionette';

View.setDomApi(MyDOMApi);
```

`CollectionView`, `Region`, and `View`
all have `setDomApi`. Each extended class may have their own DOM API.

Additionally a DOM API can be partially set:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend();

MyView.setDomApi({
  setContents(el, html) {
    el.innerHTML = html;
  }
});
```

### Backbone jQuery Integration

Backbone.js is tied to jQuery's API for managing DOM manipulation. If you want
to completely remove jQuery from your Marionette app, you'll also have to
provide your own versions of the following methods:

* [`_setAttributes`](http://backbonejs.org/docs/backbone.html#section-170)
* [`delegate`](http://backbonejs.org/docs/backbone.html#section-165)
* [`undelegate`](http://backbonejs.org/docs/backbone.html#section-167)

#### See Also

The DOM API takes care of the other DOM manipulation methods for you. The
[Backbone Wiki](https://github.com/jashkenas/backbone/wiki/using-backbone-without-jquery)
has a good reference for removing jQuery from the app, including Browserify and
Webpack configuration hooks.
