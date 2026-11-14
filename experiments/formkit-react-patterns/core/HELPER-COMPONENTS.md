# Portable FormKit helper factories

This adds exactly three previously absent component factories: `FormKitSummary`,
`FormKitMessages`, and `FormKitIcon`. They use the existing renderer lifecycle,
Core nodes and extracted reactive bindings. Tests and already supported inputs
are not counted as new components. This does not establish full native/Pro parity.

The installed reference contracts are `@formkit/vue@2.5.0` and
`@formkit/react@2.5.0`, inspected in their published `dist/index.mjs` files.
Their helper schema shapes, visible-message context, localization, icon handler
and keyboard contracts are the basis for this module. Source adaptation is
covered by `LICENSE.formkit`.

`createFormKitHelpers({getNode,getComponents,getPlugins})` returns the three
named factories for the existing component registry. The getters are lazy so
registration can precede creation of the owned root node and plugin list.
Each factory is also exported separately for an explicitly managed outlet.
Normal schema usage is `{$cmp:'FormKitSummary',props:{forceShow:true}}` or
`{$cmp:'FormKitIcon',props:{icon:'myIcon'}}`. A helper resolves its Core node
from `props.node`, the nearest factory `parentNode`, the current context node,
or the configured root getter. `$get('id')` returns a context; pass
`$get('id').node` when a Core node prop is needed.

`FormKitMessages` reads `node.context.messages`, so validation visibility follows
Core and the binding rather than exposing every raw store entry. It renders
live add/update/remove changes, classes, message types and IDs, and supports
`sectionsSchema`, `library`, `node`, and `defaultPosition`. As in the installed
helpers, false/omitted/`'false'` defaultPosition suppresses the node's original
message position; true retains it. The portable factory additionally restores
that prior placement on disposal or rebinding, with shared ownership when
multiple outlets target the same node. It supplies the node ID to its schema
so message IDs continue to match field descriptions. The installed helper's
minimal data bag omits that ID; this implementation intentionally supplies it.

`FormKitSummary` gathers descendant contexts, excluding the target node's own
messages as the installed helpers do. It includes only visible string messages,
so hidden validation stays hidden even with forceShow. It supports `node`,
`forceShow`, `sectionsSchema`, and the portable `onShow(summaries)` callback.
It updates for descendant additions/removals, validation, store changes and node
rebinding. Submit reveals the summary, reports its entries, and focuses its
first link when attached. Link activation scrolls/focuses the target field ID.
The header uses official `localize('summaryHeader', ...)`; the container has
`aria-live="polite"`. Summary links use a summary-specific ID prefix to avoid
colliding with the field message IDs. Entries supplied to onShow retain the
installed `{message,id,key,type}` shape. Destruction cancels queued work and
removes root listeners, context subscriptions and rendered scopes.

`FormKitIcon` uses the installed `createIconHandler` and theme registry. Loader
precedence is explicit iconLoader, parent iconLoader, explicit iconLoaderUrl,
then the node/theme plugin handler. Inline SVG, named registry icons, loader
promises and URL resolution are supported. Stale/rejected or post-destruction
loads cannot repaint. The factory does not abort a request shared by the
upstream icon cache; it cancels its right to render that result. Clickable icons
use role button/tabindex 0 by default and activate on Enter/Space/Spacebar unless
a supplied key handler prevents the default. Explicit role/tabindex are honored.
Changed props remove previous listeners and retain the current span when the
icon remains the same.

Upstream writes trusted SVG strings as raw markup. This factory instead parses
SVG in an inert XML document and copies a conservative SVG element/attribute
vocabulary. It strips scripts, HTML/foreignObject, inline event/style attributes,
external references and non-fragment URL values. Ordinary SVG paths, shapes,
groups, gradients, masks and fragment references remain supported. Malformed
markup and malformed icon names are rejected before arbitrary content can be
loaded or mounted. This is intentionally narrower than upstream trusted raw
HTML; it is not a sanitizer API for arbitrary HTML.

Vue component objects, injection symbols, refs/emits, framework configuration
providers and Vue/React slots are framework-specific APIs. They are not native
DOM factories and are not claimed as supported by this patch. Helper sections
can be customized with portable sectionsSchema and explicit factory libraries;
framework named/scoped slots still require adapters. CSS layout, actual browser
scrolling, assistive technology behavior and Pro geometry are not certified by
these JSDOM checks.

Run `node core/helper-components-test.mjs`. It covers public registration,
visibility, validation, dynamic descendants, rebinding, submit/focus navigation,
placement ownership, updates/destruction, icon registry/loaders, promise races,
keyboard semantics and markup filtering. In the isolated handoff only,
`BASELINE=1 node experiment/core/helper-components-test.mjs` demonstrates the
three public missing-factory failures and the independent library gap against
the frozen baseline. No Pro, Mac, publish, merge, push or credential operation
is part of this lane.
