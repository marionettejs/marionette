# The DOM API

Marionette uses a small DOM adapter for element creation, selection, attributes,
content, and attachment operations. The default `DomApi` uses native browser
APIs and does not require Backbone or jQuery.

`View`, `CollectionView`, and `Region` expose their adapter as `Dom`. A custom
adapter can replace only the operations an application needs; all omitted
methods continue to use the inherited adapter.

A renderer evaluates templates; `Dom.setContents` applies their output. The optional
[Morphdom and Lit HTML DOM adapters](./view.rendering.md#rendering-to-dom)
preserve the selected DomApi; installing one does not select a data or state
adapter.

## Element and selector boundaries

`View` and `CollectionView` own a concrete DOM element. Their `el` option must
be a DOM element. Resolve a selector
at the call site when a View should reuse existing markup:

```javascript
import { View } from 'marionette';

const view = new View({
  el: document.querySelector('#content')
});
```

`Region` retains selector resolution because a Region locates its managed
element relative to its `parentEl` or the document. `View#$()` and Region
selector lookup both delegate to `DomApi.findEl`. With the native adapter,
`View#$()` returns a `NodeList`. `Region#getEl` selects the first result and
returns that native DOM element. This Region return contract does not change
when `findEl` is supplied by the optional jQuery adapter.

The v4 `DomApi#getEl` method is removed. DOM adapter overrides should implement
`findEl(context, selector)` with an array-like result. Region `getEl` overrides
are a separate extension point and must return one native DOM element.

## Native API methods

The exported `DomApi` contains the following methods. This list is checked
against the shipped package in CI.

### `createElement(tagName)`

Creates and returns a DOM element with `document.createElement(tagName)`.
Marionette uses it when a View does not receive an `el`.

### `createBuffer()`

Creates and returns a `DocumentFragment` for collecting DOM nodes before one
append operation.

### `getDocumentEl(el)`

Returns `el.ownerDocument.documentElement`. Marionette uses that document root
when determining whether a View is attached. Elements inside template content may
have an owner document without a document element; Marionette treats that missing
root as detached.

### `findEl(el, selector)`

Finds descendants of `el` matching `selector`. The native adapter returns the
`NodeList` produced by `el.querySelectorAll(selector)`.

### `hasEl(el, childEl)`

Reports whether `childEl` is attached beneath `el`. Marionette uses this for
attachment-state checks.

### `detachEl(el)`

Removes `el` from its parent when it has one. Native listeners attached to the
element remain on the detached element.

### `replaceEl(newEl, oldEl)`

Replaces `oldEl` with `newEl` when `oldEl` has a parent. Passing the same
element twice or an unattached `oldEl` is a no-op.

### `moveEl(el, parent, before)`

Moves `el` within `parent` before the optional reference node. The native
adapter uses `moveBefore` for already-attached children when available so
CollectionView reordering and swapping preserve focus, selection, media, and custom-element
connection state. It falls back to `insertBefore` for initial attachment and
older DOM implementations; the CollectionView render pass restores focused text selection after
that fallback, while older platforms may still run custom-element connection
callbacks for the move. `swapChildViews()` does not restore focus or selection
when it uses the `insertBefore` fallback without a child-render pass.

### `setContents(el, html)`

Replaces the contents of `el` by assigning `html` to `el.innerHTML`.
`null` and `undefined` produce empty contents.

### `setAttributes(el, attrs)`

Applies own enumerable string keys from `attrs` as DOM attributes using
`setAttribute`. Use attribute names such as `class` and `for`. View-level
`className` is converted to `class` before this method is called.

An explicit `null` removes an attribute. An `undefined` value or omitted key
leaves the existing attribute untouched. Other values use the browser's string
conversion, including `false`, `0`, and an empty string. For boolean HTML
attributes, use `disabled: isDisabled ? '' : null`: the string `"false"` still
means the attribute is present. ARIA and data attributes can use `false` to set
`"false"`.

This method does not assign JavaScript properties. Set live form values or
custom element properties explicitly on the element; `value` and `checked`
attributes describe input defaults. Attribute changes still have the browser's
normal effects on reflected properties.

When `View` or `CollectionView` creates an element, `id` and `className`
declarations override matching entries in `attributes`.
[`View#renderAttributes()`](./marionette.view.md#refreshing-root-attributes)
applies the current declarations to an existing element without tracking prior
keys. Custom DomApi adapters must preserve explicit-null removal and leave
undefined and omitted entries untouched.

### `appendContents(el, contents)`

Appends the DOM node or `DocumentFragment` in `contents` to `el`.

### `hasContents(el)`

Returns whether `el` exists and has child nodes.

### `detachContents(el)`

Removes all children by assigning an empty string to `el.textContent`. This is
the fast, jQuery-free default.

### `notifyAttach(el)`

Notify the adapter that its element's contents are active. Called through View
attachment monitoring and when construction adopts an attached root. The
native implementation does nothing; Lit reconnects its directives.

### `notifyDetach(el)`

Notify the adapter that its element's contents are inactive. Called through View
detachment monitoring. This notification does not remove or empty the element.
The native implementation does nothing; Lit disconnects its directives while retaining its rendered contents.

These hooks receive only the element. They follow the existing attachment
monitoring opt-out: with `monitorViewEvents: false` or monitoring handlers
removed, applications must deliver the notifications they need themselves.
This includes destruction: `destroy()` still removes the View and its owned
resources, but does not separately disconnect adapter-managed contents when
attachment monitoring is disabled. An application rendering Lit into an attached
root with monitoring disabled must notify `notifyDetach(el)` when releasing that root.
`detachContents(el)` remains the operation for physically emptying an element.

## Using the default API

The native adapter is exported for direct use and for restoring native methods
inside a customized class:

```javascript
import { DomApi, View } from 'marionette';

const NativeView = View.extend();
NativeView.setDomApi(DomApi);
```

## Providing a custom API

The root `setDomApi` function overlays methods for `View`, `CollectionView`,
and `Region`:

```javascript
import { setDomApi } from 'marionette';
import MyDomApi from './my-dom-api.js';

setDomApi(MyDomApi);
```

Use a class setter when only one class or subclass needs the override. The
setter creates a shallow adapter overlay for that class, so a partial override
retains every other currently configured method. The current adapter and supplied overlay
contribute own enumerable string and symbol properties. Inherited and
non-enumerable properties are ignored.

<!-- executable-example: dom-api-partial-override -->
```javascript
import { View } from 'marionette';

export const PlainTextView = View.extend({
  template() {
    return '<strong>Literal markup</strong>';
  }
});

PlainTextView.setDomApi({
  setContents(el, html) {
    el.textContent = html;
  }
});

export function renderPlainText() {
  const view = new PlainTextView();
  view.render();
  return view;
}
```

`PlainTextView` uses the custom `setContents`, while `View` and unrelated View
subclasses retain their existing adapters. `CollectionView`, `Region`, and
`View` each support this class-level pattern.

## Optional jQuery adapter

Applications that rely on jQuery DOM bookkeeping can install jQuery and opt in
at application boot:

```javascript
import { setDomApi } from 'marionette';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';

setDomApi(JQueryDomApi);
```

The optional adapter overrides `findEl`, `detachEl`, `setContents`,
`appendContents`, and `detachContents`. `View#$()` consequently returns a jQuery
collection. If application code also needs `$el`, initialize it once:

```javascript
import $ from 'jquery';
import { View } from 'marionette';

const JQueryView = View.extend({
  initialize() {
    this.$el = $(this.el);
  }
});
```

The root is fixed at construction, so the wrapper remains valid through rendering
and detach/reattach. CollectionViews and Behaviors can initialize `$el` the same
way. `$el` is application-owned; the adapter has no wrapper or View setup API.

The native adapter does not create `$el`. The jQuery adapter does not replace
Marionette's event delegator, restore Backbone.View inheritance, or allow
selector strings as a View `el`. Configure those concerns separately when an
application actually requires them.

Prefer the native adapter for new applications. Use
`@mnjs/adapters/dom/jquery` only for an existing integration that depends on
jQuery selection, content, or detach semantics.
