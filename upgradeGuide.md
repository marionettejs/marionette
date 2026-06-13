# Upgrading from Marionette v4 to v5

This is the ordered, procedural guide for moving an application from Marionette
v4 (`backbone.marionette`) to Marionette v5 (`marionette`). It complements the
[v4-to-v5 compatibility ledger](docs/migration-from-v4.md), which is the
authoritative reference for the public behavior boundary. Where this guide
gives steps and before/after examples, the ledger gives the per-area status
(Preserved, Changed, Removed, Optional, Renamed, Documented).

Older upgrade notes remain available:

- [Upgrading from v3 to v4](docs/upgrade-v3-v4.md)
- [Upgrading from v2 to v3](docs/upgrade-v2-v3.md)

## Contents

- [Overview](#overview)
- [Install and package name](#install-and-package-name)
- [Named imports instead of a default namespace import](#named-imports-instead-of-a-default-namespace-import)
- [`Mn.Object` / `Object` alias becomes `MnObject`](#mnobject--object-alias-becomes-mnobject)
- [Backbone is optional](#backbone-is-optional)
- [Explicit Backbone shim and import order](#explicit-backbone-shim-and-import-order)
- [Peer dependency requirements](#peer-dependency-requirements)
- [jQuery is optional](#jquery-is-optional)
- [Optional jQuery DomApi adapter](#optional-jquery-domapi-adapter)
- [Native DomApi customization](#native-domapi-customization)
- [View `el` is element-only](#view-el-is-element-only)
- [Region `el` policy](#region-el-policy)
- [jQuery DOM compatibility](#jquery-dom-compatibility)
- [`detachContents` policy](#detachcontents-policy)
- [Radio is now built in](#radio-is-now-built-in)
- [Event bookkeeping rename for plugin authors](#event-bookkeeping-rename-for-plugin-authors)
- [Removed or not-restored APIs](#removed-or-not-restored-apis)
- [Compatibility ledger](#compatibility-ledger)

## Overview

v5 is primarily a packaging and dependency change. The class APIs you use day
to day — `Application`, `View`, `CollectionView`, `Region`, `Behavior`,
`MnObject` — keep their public contracts. What changes is how Marionette is
named, imported, and wired to Backbone, jQuery, and the DOM.

Migrate in this order. Earlier steps are mechanical and unblock the rest:

1. Update the package name and install command.
2. Replace the default namespace import with named imports.
3. Replace `Mn.Object` usage with the `MnObject` named export.
4. Decide whether you still need Backbone and jQuery, and opt in explicitly.
5. Resolve `View`/`CollectionView` selector-string `el` at the call site.
6. Audit `$el`, `view.$(selector)`, and detach-and-reinsert code.
7. Adopt the built-in `Radio` and stop reaching into private event fields.

Each section below ends with a small before/after example. All v5 examples use
named imports. The full per-area status table lives in the
[compatibility ledger](docs/migration-from-v4.md).

## Install and package name

v5 publishes under the name `marionette` (not `backbone.marionette`). Underscore
is a required peer; Backbone and jQuery are optional peers you install only when
you use them. See [Installing Marionette](docs/installation.md#install) and
[peer dependencies](docs/installation.md#peer-dependencies).

```sh
# v4 (before)
npm install backbone.marionette

# v5 (after)
npm install marionette underscore
```

## Named imports instead of a default namespace import

v5 ships **named exports only**. There is no default namespace export, so the
`import Mn from 'backbone.marionette'` pattern no longer resolves to an object
you can dot into. Import exactly what you use from `marionette`. UMD script
builds keep the `Marionette` global with the same named properties, so global
consumers read `Marionette.View` instead of a default import.

```js
// v4 (before)
import Mn from 'backbone.marionette';

const RootView = Mn.View.extend({ /* ... */ });
const region = new Mn.Region({ el: someEl });

// v5 (after)
import { Application, View, Region, MnObject } from 'marionette';

const RootView = View.extend({ /* ... */ });
const region = new Region({ el: someEl });
```

Do not reintroduce a namespace object as a v5 recommendation — neither
`import Mn from 'marionette'` nor `Backbone.Marionette`. If you previously read
classes off the `Backbone.Marionette` global, read them off the `Marionette`
global instead:

```js
// v4 (before) — global/UMD usage
const view = new Backbone.Marionette.View();

// v5 (after) — UMD still exposes the `Marionette` global with named properties
const view = new Marionette.View();
```

## `Mn.Object` / `Object` alias becomes `MnObject`

v4's default namespace exposed an `Object` alias (`Mn.Object`) for the Marionette
object class. v5 does not restore that alias
([#59](https://github.com/marionettejs/marionette/issues/59) is closed as not
planned). Use the `MnObject` named export, which has always been the canonical
name for this class.

```js
// v4 (before)
const Controller = Mn.Object.extend({
  initialize() { /* ... */ }
});

// v5 (after)
import { MnObject } from 'marionette';

const Controller = MnObject.extend({
  initialize() { /* ... */ }
});
```

See [MnObject](docs/marionette.mnobject.md) for the class reference.

## Backbone is optional

Marionette core no longer imports Backbone. Install Backbone only when your app
actually uses Backbone models, collections, or views. Marionette's own
`View`, `CollectionView`, `Region`, and `MnObject` work without it. See
[Optional Backbone](docs/optional-backbone.md).

```js
// v4 (before) — Backbone was always present as a hard dependency
import Mn from 'backbone.marionette';

// v5 (after) — install and import Backbone only where you use it
//   npm install backbone
import { Model, Collection } from 'backbone';
import { View } from 'marionette';

const list = new Collection();
const ListView = View.extend({ /* ... */ });
```

## Explicit Backbone shim and import order

In v4, Marionette's relationship with Backbone meant Backbone constructors were
patched as part of loading Marionette. In v5 that patching is explicit and opt-in
through the `marionette/backbone` subpath, which extends
`Backbone.Model`, `Backbone.Collection`, `Backbone.View`, and `Backbone.Router`
prototypes with Marionette's `Events` (so `triggerMethod`, Marionette-style
`listenTo`, etc. are available on Backbone objects).

**Import order matters.** Run the shim at your application entry point, before
any module that constructs Backbone objects expecting the Marionette event
helpers. Because Backbone is a singleton module, importing the shim once patches
every later `import Backbone from 'backbone'`. See
[Using the bundled Backbone shim](docs/optional-backbone.md#using-the-bundled-backbone-shim).

```js
// v4 (before) — Backbone was patched implicitly
import Mn from 'backbone.marionette';

// v5 (after) — patch Backbone explicitly, first, at the app entry point
import 'marionette/backbone';        // side-effect: patch Backbone prototypes
import './app';                      // modules here can rely on patched Backbone
```

`marionette/backbone` also default-exports the patched `Backbone`, so you can
import the shimmed constructor directly where that reads more clearly:

```js
// v5 (after)
import Backbone from 'marionette/backbone';

const model = new Backbone.Model();  // has Marionette's Events mixed in
```

## Peer dependency requirements

- Underscore must be `1.13.0` or later; the supported peer range is
  `underscore@^1.13.0`. v5 publishes named ESM imports from `underscore`, and
  Underscore versions before 1.13 are CJS-only with no package `exports` map, so
  modern Node and bundler ESM resolution cannot satisfy the named imports.
  Upgrade Underscore before installing v5.

```sh
# v4 (before) — Underscore 1.11 / 1.12 were acceptable
npm install underscore@^1.11.0

# v5 (after)
npm install underscore@^1.13.0
```

## jQuery is optional

Marionette core does not import jQuery and does not create `view.$el`. jQuery is
an optional peer used **only** through the `marionette/jquery-dom-api` subpath.
Install jQuery solely when you opt into that adapter. See
[jQuery DOM adapter is optional](docs/installation.md#jquery-dom-adapter-is-optional).

```js
// v4 (before) — jQuery commonly backed view/DOM behavior implicitly
import Mn from 'backbone.marionette';

// v5 (after) — install jQuery only if you opt into the adapter
//   npm install jquery
import { setDomApi } from 'marionette';
import JQueryDomApi from 'marionette/jquery-dom-api';
```

## Optional jQuery DomApi adapter

If you depend on jQuery-backed DOM operations (for example, `view.$(selector)`
returning a jQuery collection, or jQuery's listener-preserving detach), opt into
the adapter once at app boot with `setDomApi`. The adapter is the default export
of `marionette/jquery-dom-api`.

```js
// v5 (after) — at app boot, before constructing views
import { setDomApi } from 'marionette';
import JQueryDomApi from 'marionette/jquery-dom-api';

setDomApi(JQueryDomApi);
```

This configures the DomApi globally for `View`, `CollectionView`, and `Region`.

## Native DomApi customization

The native DOM API is the default in v5 — no jQuery required. It remains
customizable. `setDomApi` **merges** your overrides over the native defaults, so
you can override only the methods you need, globally or per class. See
[Providing Your Own DOM API](docs/dom.api.md#providing-your-own-dom-api).

```js
// v4 (before) — DOM operations were jQuery-backed by default
import Mn from 'backbone.marionette';

// v5 (after) — native by default; override individual methods as needed
import { setDomApi, View } from 'marionette';

// Globally, merged over the native defaults:
setDomApi({
  setContents(el, html) { el.innerHTML = html; }
});

// Or per class, leaving other classes on the native default:
const CustomView = View.extend({});
CustomView.setDomApi({
  appendContents(el, contents) { el.appendChild(contents); }
});
```

## View `el` is element-only

- `View` (and `CollectionView`) accept a DOM element for `el` in v5. Selector
  strings are no longer resolved.
- v4 inherited string-`el` resolution from `Backbone.View._ensureElement`, which
  used jQuery to look up the selector. v5 drops `Backbone.View` inheritance and
  the default jQuery dependency, so the string-resolution path goes with them.
- v5 throws a `ViewError` with a migration hint on construction (or
  `setElement`/`CollectionView#setElement`) when a string is passed, instead of
  silently storing the raw string as `view.el` and failing later in DOM code.
- Migration: resolve the selector at the call site.

```js
// v4 (before)
new View({ el: '#app' });

// v5 (after)
new View({ el: document.querySelector('#app') });
```

The same rule applies to `CollectionView#setElement`:

```js
// v4 (before)
collectionView.setElement('#list');

// v5 (after)
collectionView.setElement(document.querySelector('#list'));
```

## Region `el` policy

`Region` continues to accept **selector strings or DOM elements**. The Region
abstraction is Marionette-native ("where to mount"), not inherited from
Backbone, so its string-`el` support is preserved. No change is required.

```js
// v4 (before)
new Region({ el: '#region' });

// v5 (after) — still supported, unchanged
new Region({ el: '#region' });
```

## jQuery DOM compatibility

- v5 core does not create `view.$el`.
- `view.$(selector)` delegates to `DomApi.findEl`, which returns a native
  `NodeList` by default (`el.querySelectorAll(selector)`), or a jQuery collection
  when you opt into `marionette/jquery-dom-api`.
- Prefer native collection APIs, or opt into the adapter (see
  [Optional jQuery DomApi adapter](#optional-jquery-domapi-adapter)).

```js
// v4 (before) — jQuery collection by default
view.$('.item').addClass('active');
view.$el.attr('id', 'root');

// v5 (after) — native NodeList by default
view.$('.item').forEach(el => el.classList.add('active'));
view.el.setAttribute('id', 'root');
```

The optional adapter intentionally does **not** add `$el`. If legacy code still
expects `view.$el`, set it in your own view layer:

```js
// v5 (after) — restore $el in an app-specific base view if you truly need it
import $ from 'jquery';
import { View } from 'marionette';

const LegacyView = View.extend({
  initialize() {
    this.$el = $(this.el);
  }
});
```

## `detachContents` policy

- The default native DomApi `detachContents(el)` clears the element via
  `el.textContent = ''`. Children are removed from `el` and Marionette no longer
  holds references to them.
- v4 used jQuery's `$(el).contents().detach()`, which removes children from `el`
  while preserving jQuery's internal handler/data bookkeeping on those elements.
- For most apps the user-visible difference is small — `Region.empty()` discards
  the detached content in both cases, and DOM listeners attached via
  `addEventListener` survive either way. The difference matters for apps that
  detach-then-reinsert children externally and rely on jQuery's `.on()` handlers,
  `.data()` cache, or other jQuery-internal element bookkeeping surviving that
  cycle.
- Legacy code that depends on the v4 jQuery semantics can opt into the optional
  jQuery DomApi adapter at app boot; its `detachContents(el)` calls
  `$(el).contents().detach()`, matching v4.

```js
// v4 (before) — jQuery detach preserved .on()/.data() bookkeeping implicitly

// v5 (after) — opt back into jQuery detach only if you rely on that bookkeeping
import { setDomApi } from 'marionette';
import JQueryDomApi from 'marionette/jquery-dom-api';

setDomApi(JQueryDomApi);
```

The native default is also described in [docs/dom.api.md](docs/dom.api.md).

## Radio is now built in

Marionette exports its own `Radio` implementation as a named export. You no
longer add a separate `backbone.radio` package for Marionette's internal
request/event channels. See [Backbone.Radio](docs/backbone.radio.md).

```js
// v4 (before)
import Radio from 'backbone.radio';

const channel = Radio.channel('app');

// v5 (after)
import { Radio } from 'marionette';

const channel = Radio.channel('app');
```

## Event bookkeeping rename for plugin authors

Marionette's built-in `Events` implementation stores its private bookkeeping
under `_rdEvents`, `_rdListeningTo`, `_rdListeners`, and `_rdListenId` — not the
Backbone-compatible `_events`, `_listeningTo`, and `_listenId` fields. Code or
plugins that read or write those private fields directly will not find them.

This is private API. Use the public `on`, `off`, `listenTo`, `listenToOnce`,
and `stopListening` methods instead. See [Events docs](docs/events.md) for the
public surface.

```js
// v4 (before) — reaching into private Backbone event fields
const count = Object.keys(obj._events || {}).length;

// v5 (after) — use the public API; do not read private `_rd*` fields
obj.on('some:event', handler);
obj.stopListening();
```

## Removed or not-restored APIs

| Removed / not restored | Use instead |
| --- | --- |
| Default namespace export (`import Mn from 'marionette'`) | Named imports: `import { View, Region } from 'marionette'` |
| `Mn.Object` / `Object` alias ([#59](https://github.com/marionettejs/marionette/issues/59), not planned) | `import { MnObject } from 'marionette'` |
| `Backbone.Marionette` global namespace usage | The `Marionette` UMD global with named properties, or named ESM imports |
| `view.$el` created by core | Use `view.el`, or set `$el` yourself via the jQuery adapter / a base view |
| Implicit jQuery-backed DOM | Native DomApi by default; opt into `marionette/jquery-dom-api` |
| Private `_events` / `_listeningTo` / `_listenId` fields | Public `on`/`off`/`listenTo`/`stopListening` |

`onShow` is **not** removed — the `Region` `show`/`before:show` events and the
`onShow(region, view, options)` convention are preserved. See
[Region `show` events](docs/events.class.md#show-and-beforeshow-events).

## Compatibility ledger

For the complete per-area status table (Preserved / Changed / Removed /
Optional / Renamed / Documented) and the precise public behavior boundary, see
the [v4-to-v5 compatibility ledger](docs/migration-from-v4.md).
</content>
</invoke>
