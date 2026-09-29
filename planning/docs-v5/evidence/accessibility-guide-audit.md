# Accessibility and rendering guide audit

Date: 2026-09-30

## Bounded guidance

The guide covers native control semantics, keyboard activation, retained focus during local updates, explicit focus placement after a Region replaces a View, and text/raw-HTML rendering boundaries. The single runnable example uses a plain local state object and a class-scoped Lit adapter. It adds no Application, service injection, data dependency, renderer helper, sanitizer shim, or persistence claim.

`focusHeading` expresses the incoming View's focus destination; the transition owner decides when to call it. The View does not steal focus on every render or attachment. The toggle label stays stable while `aria-pressed` changes.

## Verified implementation contracts

- `src/modules/region.ts` successful `show` empties the outgoing owned View, renders/attaches the incoming View, and emits `show`; it contains no focus policy.
- `src/modules/view.ts` and `src/mixins/view.ts` retain the root while rendering and remove it during destruction.
- `src/runtime/dom-api.ts` native `setContents` uses `innerHTML`; a template string therefore has an HTML trust boundary.
- `packages/adapters/src/dom/lit-html.ts` replaces contents on first render, then renders into the same marked range. Stable template nodes can remain through subsequent updates; conditional removals or template changes still require actual focus testing.

The actual guide fence ran against the built public exports with JSDOM. Outcome checks passed for native button attributes, click delivery, pressed state/visible feedback, same-button focus through re-render, HTML-like text as literal text, Region replacement/destruction, explicit new-heading focus, old-handler teardown, and Region cleanup. The assertion module passed focused ESLint.

These are local author checks. Installed-package and real-browser checks are integrated by the parent task and must be reported separately.

## Authoritative guidance consulted

- [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/): keyboard activation, stable toggle label, pressed state, focus appropriate to action.
- [WAI keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_discernable_predictable): predictable, discernible focus and managing focus when active content is removed.
- [WCAG Focus Order explanation](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html): meaningful focus sequence.
- [Lit expressions](https://lit.dev/docs/templates/expressions/#primitive-values): primitive child expressions render as text.
- [Lit unsafeHTML](https://lit.dev/docs/templates/directives/#unsafehtml): raw HTML insertion requires developer-controlled content.

## Browser validation plan

Execute the actual installed guide fence, exposing its `settings`, `region`, `mount`, and `NotificationSettings` bindings to the test.

1. Tab to the native button; Enter must toggle to pressed, update feedback, and retain the focused DOM node.
2. Space must toggle back and retain focus and identity.
3. Change the title to an HTML-like string and render; it remains literal text, with the same focused button.
4. Show a fresh instance through the Region, then call its `focusHeading`; the outgoing instance is destroyed and focus reaches the new heading.
5. Tab from the heading should reach the incoming button, following document order. Destroy the Region and verify owned View teardown.

Browser key presses establish native keyboard activation; synthetic JSDOM clicks cannot establish that result. These checks also do not establish assistive-technology behavior or application-wide accessibility conformance.
