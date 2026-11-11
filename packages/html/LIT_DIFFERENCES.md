# Differences from lit-html 3.3.3

This inventory describes observable APIs and behavior, not formatting-only edits. Pristine test fixtures and the license remain under vendor/lit-html-3.3.3; sources.json records verified recovery inputs for the unused original implementations. This is an unpublished browser-rendering package for Marionette 5.0.1 and its `baseline widely available` browser target.

## Retained functionality

- Core tags: html, svg and mathml. Normal text escaping, nested templates, Nodes, arrays/iterables, ordinary attributes, multi-expression attributes, property bindings and boolean attributes retain their Lit semantics.
- Root lifecycle/options: renderBefore, creationScope, initial isConnected, RootPart.setConnected and the optional host callback receiver.
- Directives: every browser directive exported by lit-html 3.3.3 is present: asyncAppend, asyncReplace, cache, choose, classMap, guard, ifDefined, join, keyed, live, map, range, ref/createRef, repeat, styleMap, templateContent, unsafeHTML, unsafeMathML, unsafeSVG, until and when.
- Static templates: html/svg/mathml wrappers, literal, unsafeStatic and their type exports.
- Directive and AsyncDirective extension APIs, element directives and directive helpers. Async disconnect/reconnect, subscription cleanup and cached/template identity behavior remain upstream-derived. No AbortSignal redesign was introduced.
- Browser isServer export is false. There is deliberately no server renderer/export condition.
- All standard browser directive subpaths retain the .js suffix. directive.js, async-directive.js, directive-helpers.js and static.js aliases retain Lit-style helper import spelling, alongside the existing extensionless package spellings.
- BSD headers/provenance and complete licenses remain. Unsafe/static/templateContent APIs keep explicit developer-controlled-markup requirements; none becomes a sanitizer.

## Deliberate removals and consequences

1. **Template-owned events:** EventPart, PartType.EVENT and @event bindings are removed. Marionette events/triggers own View interactions. Both builds reject @event, ordinary dynamic on* attributes, and known native event-handler property/boolean bindings. Ordinary on* attributes are reserved because executable content handlers may lack IDL properties (for example WebKit focus/beforeload and older Safari SVG animation handlers). Use data-* for custom attributes. Non-handler properties/booleans such as .one, .onboarding and ?online work. The host option remains for ref callbacks.
2. **ShadyDOM/Web Components polyfill integration:** no wrap/unwrap calls, polyfill-support entrypoint or global polyfill hooks. Marionette v5 targets modern native DOM support. Native custom elements and shadow roots remain supported.
3. **Server rendering/private SSR integration:** no Node DOM shims, private-ssr-support entrypoint, hydration adapter or Node-specific export branches. Importing the renderer requires a document. LitElement is a separate upstream package, not a feature removed from lit-html.
4. **Compiled-template protocol:** not part of the initial runtime package. Experimental compiler/Vite work was preserved separately. Tagged templates, static templates and trusted-markup directives remain available.
5. **Foreign-engine interoperability:** Lit and this package do not share template/directive/root brands or nothing/noChange sentinels. Import all rendering values consistently from one package. A single-expression property slot may carry a foreign template as opaque data by identity. Development diagnoses foreign directives and foreign templates in other positions with MN_HTML_FOREIGN_VALUE; production skips that misuse check while namespaced brands prevent interpreting them as local templates/directives (ordinary string/object/boolean behavior, including normal coercion or property-setter effects, still applies); foreign sentinels are not interchangeable. Mixing independently rebuilt versions or development/production internal protocols is unsupported, as property mappings can differ.
6. **Lit global/debug integration:** no litHtmlVersions global list, duplicate-Lit version warning or litHtmlPolyfillSupport hook. Debug event names are package-scoped. Lit’s development-only special rendering/warning for a host Node rendered into itself is omitted; invalid DOM insertion follows the ordinary synchronous failure path. The host option is retained for ref callback context, not Lit event ownership.

No routine browser directive was removed merely to reduce bundle size. SSR/polyfill compatibility should be revisited only for a concrete use case rather than silently emulating unsupported protocols.

## Changed runtime/build behavior

- Template/directive/root brands and sentinel names are package-scoped. Static-value keys and debug event names also use the package namespace.
- Trusted Types policy is named mnjs-html, so CSP must permit that name. Disallowed policies fail closed. Independent copies fail under a policy that forbids duplicate registration; deduplicate rather than bypassing CSP.
- Production removes optional sanitizer hooks, matching upstream production. Development-only hooks remain diagnostic and are typed as optional; default escaping and the Trusted Types policy stay in both builds. Application validation must protect dangerous production sinks.
- Same-parent keyed content moves optionally use native moveBefore, preserving focus/selection and supported native state. The renderer's own empty boundary markers use insertBefore; the feature/parent check is hoisted once per range. New nodes and cross-parent/cache transfers retain insertBefore. Unsupported browsers use insertBefore. Detached same-parent moves and fallback paths are covered. Native movement may have a runtime cost; see measured evidence rather than assuming newer means faster.
- Production output has exact development-flag assertions, debug-output checks and one deterministic shared private-property map. Mangled internal names stay in the _$ namespace, avoiding collisions with custom Directive subclass fields. Quoted protocol keys remain stable. End users should not use _$ names for their own fields.
- TypeScript uses upstream-compatible assignment-style class field emission, avoiding extra empty type-only fields while retaining the ES2022 target.
- Distribution is ESM, with separate development/default conditions, TypeScript declarations and source-map inputs. The package has no runtime dependency on Lit or Marionette. @types/trusted-types is declared for public type consumers. The package remains unpublished.

## Focused correctness corrections

- `keyed` invalidates only its own slot in a compound binding, preserving sibling
  `noChange` values. Replacing template content with an iterable disposes the old
  template before replacing its committed-value record.
- Static template caches follow individual string segments with separate caches
  per tag wrapper, so HTML, SVG and MathML parsing cannot alias. `literal` checks
  the static-value brand before accepting nested content; a JSON-shaped object
  is not a trusted static value.
- `styleMap` normalizes camelCase names for CSSOM `!important` updates. `classMap`
  consistently uses only own enumerable keys. `range` throws for a zero step
  rather than yielding indefinitely or silently producing an empty range.
- Template preparation recognizes abrupt empty HTML comments (`<!-->` and
  `<!--->`) as closed comments. Runtime diagnostics provide package-specific
  guidance without linking users to Lit's diagnostic pages; upstream attribution
  and reference links are retained in documentation and pristine fixtures.

These changes do not add work to ordinary template update/attribute loops.
Static cache traversal occurs only when composing static values, comment
recognition runs during template preparation, and directive-specific validation
stays within the affected directive. Measurements and verification limits must
still accompany any performance claim. The segment cache avoids serialized keys
while retaining a Map for each distinct prefix; this can use more memory for
large numbers of unique static templates. Both cache designs retain templates.

## First-class Marionette DOM API

The package exports HtmlDomApi plus named setContents, notifyAttach and notifyDetach from @mnjs/html/marionette. The default API remains compatible with runtime.setDomApi(HtmlDomApi). It does not mutate a global Marionette instance. Its detachContents override disconnects and retires the cached part before clearing contents, preserving Marionette’s explicit remove-all contract without adding checks to ordinary template updates.

Before: Marionette attachElContent → adapter setContents → public render → ChildPart commit. The adapter already looked up its WeakMap, then render looked up the root Part again and required a fresh renderBefore options object. First render called render(nothing) and render(value).

Now: Marionette attachElContent → setContents → ChildPart commit. The integrated DOM API owns the bounded ChildPart directly. First render creates both markers and the part once; subsequent calls reuse the part without the public-render wrapper or duplicate lookup/options allocation. Named exports are the exact functions on HtmlDomApi, not additional wrappers.

Preserved contracts:

- First render replaces initial markup. Two markers bound all template updates, protecting Region/CollectionView-owned children after the end marker.
- WeakMap keys do not retain destroyed elements. WeakSet records explicit attachment notifications, including attach-before-first-render.
- The part is stored before any user directive runs, so later detach can clean up subscriptions created before a synchronous failure. There is no rollback or automatic retry layer.
- Attachment/detachment/re-show/destroy continues to forward AsyncDirective connection state. Direct DOM callers must send notifications; physical DOM connectivity is not a substitute.
- Marionette events, triggers, cached UI and Region contracts are unchanged. Async templates still do not rerun Marionette's render lifecycle.

Intentional low-level differences: adapter calls no longer emit public render's unstable begin/end debug events (part-level debug events remain), and first marker insertion is one replaceChildren mutation instead of separate end/start insertions. These are not lifecycle/ownership guarantees. Removing calls/allocations is structural evidence, not a measured speedup claim; performance must be judged against the paired runs.

## Verification limits

See VALIDATION.md and the benchmark report for exact commands, versions, samples, statistical uncertainty, regressions and remaining blockers. A finite benchmark suite cannot prove universal parity. The earlier local full install was limited by registry access/missing offline cache. A subsequent clean Linux CI install and all HTML checks passed at commit 6dc959622556ebfdbf0fe391015bd3b388cec423 ([run 42575612610](https://github.com/marionettejs/marionette/actions/runs/42575612610)); this does not establish a clean install on every platform. See UPSTREAM.md for the concise local-patch inventory and integrity workflow.

