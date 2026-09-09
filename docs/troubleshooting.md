# Troubleshoot an application

Start with the installed package's documentation and a small reproduction. An npm
version identifies a published release; an unpublished candidate also needs its
source commit. [The development starter](development.md) keeps these together.

| Symptom | Check first | Contract |
| --- | --- | --- |
| An import or method in an example is missing | Compare the installed manifest with the example's source revision. Use all five matching tarballs for a development candidate. | [Installation](installation.md), [public exports](public-api.md) |
| TypeScript loses option or state inference | Type `initialize` options and `createState`'s return value; use the generated package declarations. Run the starter's strict typecheck. | [TypeScript](typescript.md) |
| Nothing appears in a Region | Verify its element exists within the parent; render the parent before direct Region operations. | [Region](marionette.region.md) |
| A model changes but the UI does not | Configure an observing DataApi or StateApi, declare the matching event map, and update the DOM in its handler. Mutating a plain object does not emit an event. | [DataApi](data.api.md), [state sources](marionette.state.md) |
| A draft or focus disappears when a list changes | Keep stable unique keys and surviving child Views. Avoid rendering the whole parent to update one row. | [CollectionView](marionette.collectionview.md), [forms](forms-and-accessibility.md) |
| An old request replaces the selected screen | Give navigation a cancellation owner and reject stale completion before committing. | [Routing](routing.md), [Application](marionette.application.md) |
| Click handlers multiply after editing a module | Destroy the previous owner in HMR disposal; release application listeners too. The starter demonstrates this boundary. | [Development](development.md), [lifecycle](view.lifecycle.md) |
| A stack frame points to bundled JavaScript | Enable source maps and retain dependency maps in the bundler. The starter config does both. | [Debug authored source](development.md#debug-the-authored-source) |

## Follow a diagnostic code

Framework errors expose stable `MNxxxx` codes and a documentation URL. Match the
code, rather than exact error prose. The [diagnostic catalog](diagnostic-catalog.md)
records active and retired codes. The examples below reproduce common failures
and show separate corrected operations. They are executed against installed
packages by the documentation fixture.

### MN0020: define the named Region

An element in a template does not register a Region. In a browser module:

<!-- troubleshooting-example: MN0020 -->
```javascript
import { View } from 'marionette';

const missing = new View({ template: () => '<section></section>' });
missing.render();
export function fail() { missing.detachChildView('detail'); }
export function fix() {
  const layout = new View({
    template: () => '<section></section>',
    regions: { detail: 'section' }
  });
  layout.showChildView('detail', new View({ template: () => 'Ready' }));
  const result = layout.el.textContent;
  layout.destroy();
  return result;
}
export function cleanup() { missing.destroy(); }
```

`fail()` throws MN0020. `fix()` returns `Ready` after displaying a child in the
registered Region. For optional lookup, use `hasRegion` or `getRegion` before an
operation. See [named Regions](marionette.view.md#laying-out-views---regions).

### MN0003: transfer ownership explicitly

A live View has one owner. Detaching transfers it without destroying it.

<!-- troubleshooting-example: MN0003 -->
```javascript
import { Region, View } from 'marionette';

const first = new Region({ el: document.createElement('main') });
const second = new Region({ el: document.createElement('main') });
const child = new View({ template: () => 'Shared screen' });
first.show(child);
export function fail() { second.show(child); }
export function fix() {
  second.show(first.detachView());
  return second.currentView === child;
}
export function cleanup() { first.destroy(); second.destroy(); }
```

`fail()` throws MN0003. `fix()` returns `true`: the same child now belongs to the
second Region. Use a new View when both places must display content simultaneously.
See [detaching a View](marionette.region.md#detaching-existing-views).

### MN0023: bind UI after rendering

A selector declaration is available before render; its matching elements are not.

<!-- troubleshooting-example: MN0023 -->
```javascript
import { View } from 'marionette';

const view = new View({
  template: () => '<button>Save</button>',
  ui: { save: 'button' }
});
export function fail() { view.getUI('save'); }
export function fix() {
  view.render();
  return view.getUI('save')[0].textContent;
}
export function cleanup() { view.destroy(); }
```

`fail()` throws MN0023. `fix()` returns `Save`. Access bound UI in `onRender` or
after rendering; after explicitly unbinding, bind it again before lookup.
See [UI bindings](dom.interactions.md#organizing-a-view-with-ui).

### MN0007: replace a destroyed instance

Destruction ends a View's lifetime. Create another instance for a new screen.

<!-- troubleshooting-example: MN0007 -->
```javascript
import { Region, View } from 'marionette';

const region = new Region({ el: document.createElement('main') });
const old = new View({ template: () => 'Old' });
old.destroy();
export function fail() { region.show(old); }
export function fix() {
  region.show(new View({ template: () => 'New' }));
  return region.currentView.el.textContent;
}
export function cleanup() { region.destroy(); }
```

`fail()` throws MN0007. `fix()` returns `New`. A stopped Application may restart;
a destroyed View may not. See [View destruction](view.lifecycle.md).

## Report an unresolved problem

Include the exact package/source identity, browser and bundler, selected adapters,
the smallest public-API reproduction, and expected versus observed behavior.
[Open an issue](https://github.com/marionettejs/marionette/issues/new/choose).
Do not include private application data.

Synchronous construction, registration, rendering, and cleanup failures abort the
operation. Fix the source of the failure; do not rely on automatic rollback or
catch an exception and continue a partially completed operation. The ownership
checks illustrated here and Application's documented asynchronous cancellation
are existing contracts. See the [synchronous failure boundary](view.lifecycle.md#synchronous-failures).
