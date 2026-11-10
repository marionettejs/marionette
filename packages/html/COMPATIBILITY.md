# Runtime contracts

## Supported browser features

- `html`, `svg`, `mathml`, `render`, `nothing`, `noChange`.
- Text, nested templates, arrays/iterables, DOM Nodes, attributes, multi-expression attributes, property bindings, boolean attributes and element directives.
- `renderBefore`, `creationScope`, and initial `isConnected`; `RootPart.setConnected()` controls later connection state. `renderBefore` is required by the integrated adapter. `creationScope` remains useful for a different owner document.
- `Directive`, `directive`, `AsyncDirective`, applicable `PartType` members and directive helpers.
- `repeat`, `cache`, `keyed`, `guard`, `classMap`, `styleMap`, `live`, `ifDefined`, `when`, `choose`, `map`, `range`, `join`, `until`, `asyncAppend`, `asyncReplace`.
- `ref`/`createRef`, including callback host context and disconnect/reconnect behavior.
- Opt-in `templateContent`, `unsafeHTML`, `unsafeSVG`, `unsafeMathML`; static `html`, `svg`, `mathml`, `literal`, and `unsafeStatic` from `@mnjs/html/static`.
- Trusted Types template policy and default text/attribute escaping. Development-only sanitizer diagnostics are optional and are not present in production.
- Default and named `HtmlDomApi`, plus exact named `setContents`, `notifyAttach`, and `notifyDetach`, from `@mnjs/html/marionette`. The DOM API commits to its owned Part directly, preserving bounded rendering and notification semantics.

The directive names use kebab-case file subpaths, for example `@mnjs/html/directives/class-map.js`. Root and support entrypoints use the exports documented in package.json. `.js` aliases are also available for directive, async-directive, directive-helpers, and static. The browser `is-server.js` export is always false. Only exported subpaths are public.

## Template and event ownership

Use Marionette `events`, `triggers` and `ui` for View-owned interactions. Dynamic `@event` and ordinary dynamic `on*` attributes fail synchronously. Browser-known native handler property/boolean bindings are rejected; ordinary data such as `.one`, `.onboarding`, camelCase `.onChange`/`.onClick` callback properties and `?online` remains valid. Properties are case-sensitive; HTML attributes are not. Literal markup is trusted author code and is preserved.

Import templates, directives and helpers consistently from this package and one build condition. Single-expression property bindings may carry foreign template objects by identity as opaque application data, including through a local directive. This does not permit foreign directives or rendering foreign templates. Development diagnoses other foreign engine values; production treats unsupported objects as ordinary values rather than running foreign directive constructors. Normal object coercion and property setters can still execute. This boundary is not an input security sandbox.

The renderer requires a browser DOM at import time. Optional `host` supplies ref callback context. Initial `isConnected` and later `RootPart.setConnected()` are distinct; direct adapter callers must send attach/detach notifications. The integrated DOM API preserves exact named function identities and bounded ownership without a public-render wrapper or an extra empty render.

## State-preserving moves

The retained `repeat`/`insertPart` algorithm feature-detects native `moveBefore` **only for same-parent content moves**. Its own empty start/end comment markers use `insertBefore`; actual content retains native state-preserving movement. Feature/parent checks happen once per range. New nodes and cross-parent/cache transfers continue using `insertBefore`. Same-parent movement satisfies the native equal-root and existing-parent constraints without a new recovery path. Unsupported browsers use the established fallback.

With native support, the focused input and selection survive a keyed move. Custom elements with `connectedMoveCallback` receive a move callback; custom elements without it still receive the native legacy disconnect/connect callbacks. The fallback preserves node identity but does not promise focus or iframe state preservation. No claim is made that ordinary media playback otherwise always resets.

At the time of this prototype's research, MDN browser-compat-data lists moveBefore in Chrome 133+, Firefox 144+, and not Safari. `Symbol.dispose` likewise is not a Baseline widely available prerequisite. This package requires neither feature. Sources: [DOM move algorithm](https://dom.spec.whatwg.org/#concept-node-move), [MDN moveBefore](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore), [MDN compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json).

## Why asynchronous directives stay

A synchronous render can create a placeholder that is updated later. This is compatible with Marionette provided ownership remains within the renderer's range and applications account for later updates not refreshing Marionette UI/Regions. `AsyncDirective` also supports resource/subscription cleanup independently of promises.

An AbortSignal is one-shot. Replacing the disconnect/reconnect protocol with it would need a fresh signal per connection and a specified reconnection contract. That breaking redesign is deferred. Full-container `replaceChildren()` clearing is also inappropriate when Region/CollectionView children lie outside the template's range. Upstream bounded clearing remains.

## Security and import effects

Normal text interpolation uses text nodes; ordinary attribute interpolation cannot break out into additional markup. Template-array validation and the Trusted Types policy remain in both builds. Production removes custom sanitizer hook code and does not expose `render.setSanitizer` or `render.createSanitizer`; their type declarations are optional because only development provides them. This is not a silent no-op policy.

A development sanitizer is diagnostic only. Install it before rendering for complete development coverage; late installation does not revisit existing DOM or unchanged bindings. Production validation belongs in the application at the source of dangerous data or in explicitly chosen sanitizing APIs.

Production minification shares one deterministic private-property map across modules and reserves protocol keys. Generated internal names stay in the `_$` namespace. Build assertions verify the development/security flag counts and reject leaked development hooks. Mixing development and production internals is unsupported.

This package is **not a sanitizer or security sandbox**. Static template markup is trusted author code. Passing Nodes, dangerous URLs, or properties such as `.innerHTML` can still be unsafe. Removing template event bindings does not make arbitrary data safe in every sink. The opt-in unsafe/static/templateContent APIs deliberately accept trusted markup; development sanitizer diagnostics do not sanitize that markup. Use an application policy where those bindings require it.

The Trusted Types policy is named **`mnjs-html`**. A strict CSP must permit that name, for example `require-trusted-types-for 'script'; trusted-types mnjs-html`. A denied policy fails closed on module import. Multiple independent copies under a CSP that disallows duplicate policy names fail on the second policy registration; deduplicate the package. Do not add `allow-duplicates` merely to hide a packaging problem.

Imports capture `document` and register the Trusted Types policy when supported. Ordinary entrypoints install template preparation once and are declared side-effectful for bundlers. Lazy DOM/policy initialization is not provided.

Size results are measured separately from runtime. The performance goal is parity or better against equivalent Lit production workloads, including the same Marionette application in js-framework-benchmark. No universal parity claim follows from a finite workload sample. See VALIDATION.md and the separate benchmark evidence for the current result and limits.
