# @mnjs/html reference

A separately versioned browser template renderer and Marionette DOM adapter.
Version 1.0.0 is an unpublished package candidate. Publication requires the
separate approval and checks in RELEASE.md. It is optional and does not select or change the
renderer for an application that has already configured one.

## Install and choose an entrypoint

Build and verify the package from its source before packing a local archive.
Install that exact archive into the consuming application, rather than assuming
that this version is available from the registry:

```sh
npm install --save-exact /path/to/mnjs-html-1.0.0.tgz
```

Use Node `^22.22.2 || >=24.15.0` for the package tools. Runtime imports require a
browser DOM, or a DOM-enabled test environment initialized before import. This is
not a server renderer and has no hydration API. The Marionette adapter is tested
with released Marionette 5.0.1 and, in a separate packed integration lane, the
current repository checkout. It has no runtime import or required peer dependency
on Marionette, so standalone rendering does not install the framework.

| Import | Public surface |
| --- | --- |
| `@mnjs/html` | `html`, `svg`, `mathml`, `render`, `nothing`, `noChange`; template, part and render-option types. |
| `@mnjs/html/marionette` | Default and named `HtmlDomApi`; named `setContents`, `notifyAttach`, `notifyDetach`. |
| `@mnjs/html/directive` | `Directive`, `directive`, `PartType`, and directive types. |
| `@mnjs/html/async-directive` | `AsyncDirective` and its types. |
| `@mnjs/html/directive-helpers` | Public directive/part utilities for custom directives. |
| `@mnjs/html/static` | Static-template `html`, `svg`, `mathml`, `literal`, `unsafeStatic`, `withStatic`. |
| `@mnjs/html/directives/<name>.js` | Individually imported directives; filenames use kebab-case. |
| `@mnjs/html/is-server.js` | `isServer`, always `false`. |

The support entrypoints `directive`, `async-directive`, `directive-helpers` and
`static` also accept `.js` aliases. Only package-exported subpaths are public.
Names beginning `_$` are internal, including in custom Directive subclasses.
There is no CommonJS entrypoint.

## Template values and rendering

`html`, `svg` and `mathml` are tagged template functions. They return a template
result rather than HTML text or a DOM element. Keep static structure in the tagged
literal and pass data as interpolations; do not construct template-string arrays
manually. Nested results and arrays/iterables compose directly.

```js
import { html, render, nothing } from '@mnjs/html';

const container = document.createElement('section');
const content = (name, disabled) => html`
  <p>Hello, ${name}</p><input .value=${name} ?disabled=${disabled}>
`;
render(content('<Sam>', false), container);
const input = container.querySelector('input');
render(content('Ada', true), container);
const reusedInput = container.querySelector('input');
render(nothing, container);
```

| Position/value | Behavior |
| --- | --- |
| Child text | Primitives render as text. `null`, `undefined`, `nothing` and the empty string render no child content. Booleans render as text. |
| Nested template / iterable | Renders the result or its items. Plain iterable order is positional; use `repeat` when identity follows a key. |
| DOM Node | Inserts the supplied node. The caller is responsible for its provenance and ownership. |
| `name=${value}` | Sets an attribute. `nothing` removes it; `null`/`undefined` contribute empty strings. Multiple expressions in one attribute are supported. |
| `.name=${value}` | Assigns a property. Validate dangerous sinks such as `innerHTML` in the application. |
| `?name=${value}` | Toggles a boolean attribute according to truthiness. |
| Element directive | `${directive(...)}` in the element's attribute area receives an element part. |
| `noChange` | Leaves the existing committed value unchanged. |

`render(value, container, options?)` commits synchronously and returns the root
part. The first render creates an owned range; later renders update that range.
Do not remove its markers or render into the same range with another engine.
`render(nothing, container)` clears that range. Direct rendering is distinct from
the Marionette adapter's first-render content replacement.

| Render option / root operation | Contract |
| --- | --- |
| `renderBefore` | A boundary node in the container; content is inserted before it. Use a stable boundary. |
| `creationScope` | A document-like scope used when importing template content. |
| `host` | Receiver for optional `ref` callbacks. Does not enable template events. |
| Initial `isConnected` | Initial directive connection state; defaults to connected for direct rendering. |
| `root.setConnected(boolean)` | Explicitly updates directive connection state after rendering. Ordinary DOM movement does not invoke it automatically. |

## Choosing a DOM integration

Use `@mnjs/html/marionette` with this package's template results when Marionette
should own events and lifecycle. Use the existing `@mnjs/adapters/dom/lit-html`
with upstream Lit template results when the application deliberately uses Lit.
Native HTML-string templates can keep the default DomApi; do not install a
template adapter without matching the values it consumes. This package does not
change an application's configured renderer or adapter automatically.

## Marionette integration and ownership

Configure an isolated runtime before constructing its Views. The default renderer
still calls `template(data)` without a View receiver; expose View-derived values
through `templateContext`. The DOM adapter handles the returned template result.

```js
import { createMarionette } from 'marionette';
import { html } from '@mnjs/html';
import HtmlDomApi from '@mnjs/html/marionette';

const mn = createMarionette();
mn.setDomApi(HtmlDomApi);
const Counter = mn.View.extend({
  initialize() { this.count = 0; },
  templateContext() { return { count: this.count }; },
  template: ({ count }) => html`<button type="button" class="increment">${count}</button>`,
  events: { 'click .increment'() { this.count++; this.render(); } }
});
const host = document.createElement('main');
const region = new mn.Region({ el: host });
const counter = new Counter();
region.show(counter);
counter.el.querySelector('button').click();
region.destroy();
```

Use View `events`, `triggers` and `ui` for interactions. Dynamic `@event` bindings,
ordinary dynamic `on*` attributes, and browser-known native handler property or
boolean bindings throw `MN_HTML_EVENT_BINDING`. Ordinary data properties such as
`.one`, case-sensitive callback properties `.onChange`/`.onClick`, and boolean
attributes such as `?online` remain valid. Lowercase native `.onchange`/`.onclick`
and case-insensitive HTML `?onClick`/`onClick` bindings remain rejected. Static markup is
trusted author code; these restrictions are not a security sandbox.

`setContents(element, result)` first replaces existing contents, without hydration.
Subsequent calls update one bounded range; children appended after its end marker
remain outside renderer ownership. This supports root-level CollectionView child
Views. Keep Region placeholders under the correct owner, and let Regions own
child View replacement rather than overwriting their DOM externally.

Keep Marionette attachment monitoring enabled. `notifyAttach` and `notifyDetach`
forward directive connection changes; direct adapter users must call them.
The adapter does not implicitly pass the View as `host`. It preserves the
configured event delegator and the root element. Synchronous callback failures
abort the operation; no rollback or failed-construction recovery is added.

## Directives and identity

```js
import { html, render, nothing } from '@mnjs/html';
import { repeat } from '@mnjs/html/directives/repeat.js';
import { live } from '@mnjs/html/directives/live.js';

const list = document.createElement('section');
const rows = items => html`<ul>${repeat(items, item => item.id,
  item => html`<li data-id=${item.id}><input .value=${live(item.label)}></li>`)}</ul>`;
render(rows([{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }]), list);
const firstRow = list.querySelector('[data-id="a"]');
render(rows([{ id: 'b', label: 'Two' }, { id: 'a', label: 'Updated' }]), list);
const movedRow = list.querySelector('[data-id="a"]');
render(nothing, list);
```

Use unique stable keys for `repeat`; changing a key means a different item.
Node identity is preserved through supported keyed moves. Native same-parent
`moveBefore` is used when available; the fallback preserves identity but does not
promise focus, selection, iframe or playback-state preservation.

| Directive group | Exports and purpose |
| --- | --- |
| Identity and work | `repeat` for keyed lists; `keyed` to reset content when its key changes; `cache` to retain alternative template DOM; `guard` to skip work while dependencies are unchanged. |
| Values and attributes | `classMap`, `styleMap`, `ifDefined`; `live` compares a binding with the live DOM value. |
| Composition | `when`, `choose`, `map`, `range`, `join`. |
| Async values | `until`, `asyncReplace`, `asyncAppend`. |
| Element access | `ref`, `createRef`; refs follow renderer connection changes. |
| Trusted markup | `templateContent`, `unsafeHTML`, `unsafeSVG`, `unsafeMathML`; opt-in APIs, not sanitizers. |

Async directives can update after the initial synchronous commit. Those updates
do not rerun Marionette rendering hooks, rebind cached UI selectors or recreate
Regions. Do not let them replace owned Region placeholders or cached UI targets.
Custom `AsyncDirective` implementations must release and reacquire their own
resources on disconnect/reconnect; an AbortSignal is not a substitute for that
reconnectable lifetime. Renderer connection state does not cancel arbitrary
application requests.

## Security and build conditions

Ordinary text and attribute interpolation cannot escape into extra markup.
Supplied Nodes, dangerous URL schemes, property sinks, static template markup and
explicit unsafe APIs still require application-level validation. `unsafeHTML`,
`unsafeSVG`, `unsafeMathML`, `unsafeStatic` and `templateContent` accept only trusted
or already-sanitized input. Do not interpolate user data through them.

Imports capture `document` and register the `mnjs-html` Trusted Types policy when
supported. A strict CSP must permit that policy name, for example
`require-trusted-types-for 'script'; trusted-types mnjs-html`. Policy denial fails
closed during import. Deduplicate package copies instead of allowing duplicate
policy names to mask a bundle problem.

The default export condition selects production output; `development` selects
readable diagnostics. Keep templates, directives and helpers on one package
version and one condition. Mixing engines or build conditions is unsupported.
Production preserves escaping and Trusted Types, but has no custom sanitizer
hooks. Development-only sanitizer hooks can transform or reject values; they are not production protection.

A single-expression property binding such as `.footer=${foreignTemplate}` may
pass an upstream Lit template object unchanged to a custom-element setter in both
builds. This is opaque application data, not shared renderer interoperability.
Foreign directives and foreign templates in child, attribute or compound property
positions remain unsupported and diagnosed in development.

`keyed(newKey, noChange)` clears the old key's content and ownership; `noChange`
does not preserve content across a changed key. With the same key it retains the
existing content. Use a stable key when retaining the existing subtree is intended.

## Types and verification

The root exports `TemplateResult`, HTML/SVG/MathML result types, `RenderOptions`,
`RootPart` and supported Part types. Declarations accompany the ESM exports;
`@types/trusted-types` is a production type dependency. TypeScript consumers must
provide DOM library declarations. No SSR, hydration or template compiler API is
exported.

The independent package check builds both conditions, exercises public behavior,
checks declarations and inspects the packed file list. Its documentation tests
execute the JavaScript examples in this reference. Browser tests cover lifecycle,
keyed movement and CSP/Trusted Types across Chromium, Firefox and WebKit. Size
measurements are not runtime-performance guarantees. License and upstream source
notices remain in the package archive.
