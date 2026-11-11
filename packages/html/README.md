# @mnjs/html

A browser template renderer for Marionette-owned interfaces, with incremental DOM updates, keyed lists, directives, an integrated DOM API.

Version 1.0.0 is an unpublished package candidate. Publication requires the separate approval and checks in RELEASE.md. It does not change Marionette or other installed adapters.

See the [package reference](guide.md) for entrypoints, template values, render options, directive identity, lifecycle and security contracts. [Repository integration](INTEGRATION.md) explains independent builds and local archive installation.

## Use with Marionette

```js
import { createMarionette } from 'marionette';
import { html } from '@mnjs/html';
import HtmlDomApi from '@mnjs/html/marionette';

const mn = createMarionette();
mn.setDomApi(HtmlDomApi);

const Counter = mn.View.extend({
  initialize() { this.count = 0; },
  templateContext() { return { count: this.count }; },
  template: ({ count }) => html`<button class="increment">${count}</button>`,
  events: {
    'click .increment'() { this.count++; this.render(); },
  },
});

const region = new mn.Region({ el: document.querySelector('#app') });
region.show(new Counter());
```

Use Marionette `events`, `triggers`, and `ui` for View-owned interactions. `@click=${handler}`, `.onclick=${handler}`, and native handler property/boolean bindings throw `MN_HTML_EVENT_BINDING` in both builds. Ordinary dynamic `on*` **attributes** are reserved because browsers can execute them even without a matching JavaScript property. Use `data-*` for custom attributes. Non-handler properties and boolean attributes such as `.one`, `.onboarding`, and `?online` remain supported.

The integrated DOM API has no runtime import of Marionette. It exports `HtmlDomApi` and the exact named `setContents`, `notifyAttach`, and `notifyDetach` functions. The adapter commits directly to its bounded renderer part and is tested against **Marionette 5.0.1**. Its `detachContents` method disconnects and retires that part before clearing all contents. Configure the adapter explicitly before constructing Views.

## Plain templates

```js
import { html, render, nothing } from '@mnjs/html';
import { repeat } from '@mnjs/html/directives/repeat.js';

render(html`
  <input .value=${value} ?disabled=${busy}>
  <ul>${repeat(items, item => item.id, item => html`<li>${item.name}</li>`)}</ul>
  ${visible ? html`<p>${message}</p>` : nothing}
`, container);
```

ESM and TypeScript declarations are included. Use a modern browser or a DOM-enabled test environment. Importing the renderer without `document` is not supported in this initial version. The `development` export condition selects readable diagnostics; the default selects the minified production build. Keep renderer, directives, and helpers on one version and build condition. Mixed development/production internal protocols are not supported. Names beginning `_$` are reserved for library internals, including within custom Directive subclasses.

## Optional directives and static templates

The package keeps `ref`/`createRef`, `templateContent`, `unsafeHTML`, `unsafeSVG`, `unsafeMathML`, and the static-template `html`/`svg`/`mathml`, `literal`, `unsafeStatic` APIs in separate modules. These are not pulled into the core bundle unless imported.

```js
import { ref, createRef } from '@mnjs/html/directives/ref.js';
import { templateContent } from '@mnjs/html/directives/template-content.js';
import { html as staticHtml, literal } from '@mnjs/html/static';
```

Use `ref` for direct element access or custom-element integrations when Marionette `ui` is not enough. Refs follow renderer connection changes. `render(..., {host})` provides the optional ref-callback receiver; it does not enable template events. The Marionette adapter keeps its existing contract and does not implicitly supply a View as host.

`unsafeHTML`, `unsafeSVG`, `unsafeMathML`, `unsafeStatic`, and `templateContent` require developer-controlled or already-sanitized markup. They are explicit escape hatches, **not sanitizers**. The renderer does not sanitize markup passed to these APIs. Prefer ordinary interpolation for untrusted values.

## Lifecycle and DOM ownership

- First adapter render replaces existing contents; it does not hydrate.
- Subsequent renders update one bounded range. An end marker protects child Views appended after that range, including root-level CollectionView children.
- Keep Marionette attachment monitoring enabled. A detached View starts its directives disconnected; attach, detach, re-show and successful destroy forward connection changes.
- Direct adapter callers must send attachment notifications themselves. DOM insertion/removal alone is not a lifecycle notification.
- Do not externally replace the renderer's marker nodes or let a second renderer manage the same range.
- `until`, `asyncReplace`, and `asyncAppend` remain available. Their initial commit is synchronous; later updates do **not** rerun Marionette's render lifecycle, rebind cached UI selectors, or recreate Regions. Do not use them to replace Marionette-owned Region placeholders or cached UI targets.
- Synchronous callback failures abort the operation. This package adds no rollback, attempt-all cleanup, or failed-construction recovery contract.

See [COMPATIBILITY.md](COMPATIBILITY.md) for runtime contracts and security boundaries.

## Security

Text interpolation uses text nodes; ordinary attribute interpolation cannot escape into additional markup. Static template markup and explicit unsafe APIs are trusted author code. Properties such as `.innerHTML`, supplied Nodes and dangerous URLs still require application-level validation. Event restrictions do not make the renderer a sanitizer or security sandbox.

Production has no custom sanitizer hooks. Default escaping and the `mnjs-html` Trusted Types policy remain enabled. The development build exposes optional sanitizer hooks that can transform or reject values; do not rely on a development-only policy to protect production. See the runtime contracts for CSP requirements.

## Develop

Use Node `^22.22.2 || >=24.15.0`. Install development dependencies, then run:

```sh
npm run check
npm run test:browser
npm run size
```

`check` builds the renderer, runs production/development runtime suites, checks consumer types, and verifies the packed package. `test:browser` requires the installed Playwright browsers.

Performance results identify the exact measured source and toolchain. New source changes do not inherit old benchmark results. See [VALIDATION.md](VALIDATION.md).

## License and provenance

The rendering engine is derived from lit-html 3.3.3 under BSD-3-Clause; the Marionette DOM API is derived from MIT-licensed Marionette code. Complete notices and source records are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [PROVENANCE.md](PROVENANCE.md).
