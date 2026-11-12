# Routing with Marionette v5

Router owns matching and navigation on one shared Driver. RouteApplication owns
feature declarations, branch dispatch and one selectable child group, using
ordinary Application preparation/start/stop/destroy. Views and Regions own UI.
The [source/license reference](PROVENANCE.md) and [MIT notice](license.txt) identify
this package. Application policy still chooses loading/error UI, services,
permissions, independent panes, focus and reporting.

## Responsibilities

| Responsibility | Owner |
| --- | --- |
| Compile/rank one nested route table, generate URLs, follow redirects | Router |
| URL/history event semantics | Injected Driver |
| Current route authority | Match and its AbortSignal |
| Declare feature routes and select mounted children | RouteApplication |
| Async loading and startup readiness | Application.prepareStart |
| Attached presentation and local interactions | Views and Regions |
| Domain errors, reporting, ownership of independent panes | Application policy |

Use one browser Router and explicit Application ownership. A URL mount selects
one registered child within its RouteApplication; it does not discover owners or
create another browser listener. A route-less RouteApplication also supports
selection without a Router. Ordinary Router handlers/controllers remain available
when Application branch dispatch is unnecessary.

## Construction, options and extension

Router and RouteApplication are callable Application constructors. Use normal
`initialize`, `.extend`, `addChildApp` and start/stop/destroy. Custom constructors
may delegate with `Parent.call(this, options)`. Required private state is installed
before core construction invokes consumer hooks; there is no temporary hook swap.

Router options `routes`, `driver`, `handler`, `owns`, `notFound` and `maxRedirects`
use ordinary `getOption` precedence. Constructor options override prototype defaults.
A Router `routes()` factory runs once in its own context. RouteApplication's
`routes` and `childApps` instead describe a static class topology; compilation
reads properties without calling route or child factories or constructing children.
Non-undefined constructor route tables throw before child creation or initialization;
undefined is equivalent to omission. Core can instantiate constructor-supplied
children, but those options do not redefine the class topology read by routeTable.
Set instance declaration properties explicitly before compiling when needed.

Registration snapshots route containers, definitions, children and top-level
metadata without mutating callers. Redirect functions retain identity; nested
metadata and opaque `data` retain their references. In low-level Router tables,
method handlers resolve once at registration through Marionette's `resolveMethod`
(`MN0019` on invalid methods). A mount's `controller` supplies their receiver;
Router is the default controller. Only the matched leaf's own handler runs,
falling back to Router's global handler when absent. Parent handlers are not
inherited by child leaves.

RouteApplication tables instead register `routeTo` as the Router handler. Local
method names resolve on that Application at dispatch, after branch selection. A
handlerless Application leaf completes without a local callback; it does not
fall through to Router's global handler.

## Lifetime and notifications

Router follows Application's `start`, `restart`, `stop`, `destroy` and
`isRunning`. Register it with `owner.addChildApp('router', router)` to make owner
stop/destroy propagate automatically. A field alone does not establish ownership.
Registration does not start the Router or any other child.

`start()` uses ordinary Application preparation and activation. Concurrent initial
starts join preparation; active starts resolve `true` without repeating it.
Preparation and synchronous startup callback failures reject. Stop/destroy cancel
pending preparation with a prompt `false` result under the Application contract.
Driver binding and initial URL/state setup run in the activation notification.
If the Router's own synchronous Driver setup fails, it cancels its partial
binding and attempts, then rejects `start()` with the original setup error.
Application remains activated, as with other post-activation callback failures;
Router does not call `stop()` or schedule a secondary global cleanup error.
Routing is disabled, and an already-active `start()` does not retry binding.
Use `restart()` to repeat preparation and binding, or explicitly stop/start for
ordinary teardown and reactivation. Call `stop()` or `destroy()` when abandoning
the failed activation. Consumer effects and children are not rolled back.

Once activated, the Router acquires one Driver subscription and dispatches the
current URL asynchronously. `start()` does not await that navigation. Current
routing failures emit `route:error`, including initial failures, and leave the
Router enabled. Use `refresh()` to retry the current URL. `route:ready` identifies
successful current route completion; unclaimed and canceled attempts do not emit
it.

`getInitialDispatch()` returns null before activation and the latest activation's
`Promise<InitialDispatchResult>` afterward. The promise is installed before route
notifications, follows synchronous/asynchronous redirects, and always resolves:

| status | Meaning | Fields |
| --- | --- | --- |
| `matched` | Claimed route and awaited work completed. Includes an explicit notFound handler. | `match` |
| `unmatched` | The final URL was not claimed. | — |
| `cancelled` | Stop, destruction, supersession or registration removal invalidated the attempt. | — |
| `failed` | Setup, planning, redirect, handler or notification failed. | `error`, `match` (null before commit) |

Current failures still emit `route:error` once; observing the result adds no error
notification. A synchronous Driver setup failure still rejects `start()` and
leaves routing disabled; it also supplies a failed outcome. Preparation failure
before activation creates no initial dispatch. Retained restart keeps the same
promise; stop/start replaces it upon activation. The settled result remains a
historical snapshot even after later navigation or stop. A Match in that snapshot
can subsequently have an aborted signal. `refresh()` does not replace the initial
outcome.

`restart()` repeats preparation while retaining the binding, selected children
and UI. It does not redispatch the URL, reapply child start options, remount routes
or reconstruct pages. Use `refresh()` to redispatch. A later `stop(); start()`
creates a new binding and initial dispatch. Router state events follow Application's
running-state rules.

`stop()` is synchronous, returns `true`, releases the Driver subscription, aborts
navigation authority and stops all registered descendants. `destroy()` also
destroys registered children and owned resources, using ordinary Application
cleanup; repeated destruction returns `true`. Required routing cleanup runs
through the lifecycle binding rather than an overridable `onStop` method.
Synchronous hook failures follow Application's documented failure boundary and
may abort remaining cleanup; there is no rollback or attempt-all guarantee.

Router does not override `prepareStart`, `start`, `restart`, `stop` or `destroy`.
Its internal lifecycle listeners enable and disable routing. A consumer uses
Application preparation normally, without a Router setup super-call:

```js
const CatalogRouter = Router.extend({
  async prepareStart(options, context) {
    await loadCatalogPrerequisites(options, context);
    context.signal.throwIfAborted();
    return options;
  },
});
```

Prepare the shell and required feature prerequisites before starting routing.
The consumer's synchronous `onStart` hook runs before internal `start` listeners,
so it can commit prepared UI before initial route handling begins. Returned hook
Promises are not awaited. Subscribe to `route:error` before calling `start()`;
handle `start()` rejection separately for Application preparation/startup failures.
Application does not roll back children created or started during failed custom
preparation; stop or destroy the owner when abandoning such preparation.

The first preparation and synchronous `onStart` hook run before routing is bound,
so `navigate()` there returns a canceled result. Request navigation after activation.
An already-active binding remains available during retained restart. Restarting a
parent does not restart its child Router; after a parent stop/start, explicitly
start the Router child again, just as for other Applications.

Internal cleanup uses ordinary event subscriptions. Remove your own callbacks by
identity or use `listenTo`/`stopListening`; a broad `off('before:stop')` also removes
the Router's cleanup listeners. The package adds no protected event namespace.

Until routing is enabled, and after stop or destroy, `navigate()` returns canceled committed/finished
Promises; `refresh()` and `back()` resolve false; `canGoBack()` is false. Pure matching, URL
building and route-table inspection/configuration remain available. `getCurrent()` identifies the last committed Match;
its signal is aborted when the run ends.

`canGoBack()` reports whether the previous history entry was marked by this
router package; `back()` returns its navigation readiness or resolves `false`
when no such entry is available. A matched initial entry is marked too; eligibility
is not limited to entries created by `navigate()`. This is a convenience policy
for this helper, not a security boundary or a restriction on the browser Back
button. Native Back can leave the app/document independently of the helper.

| Notification | Hook | Timing |
| --- | --- | --- |
| `route(match)` | `onRoute(match)` | Current Match committed, before the awaited handler |
| `route:ready(match)` | `onRouteReady(match)` | Handler fulfilled and Match remains current |
| `route:error(error, match, context)` | `onRouteError(error, match, context)` | Current routing failed; Match is null when failure precedes Match commitment |

Hooks run before listeners through `triggerMethod`. Notification return values do
not cancel navigation and returned Promises are not awaited. A synchronous hook
exception aborts that operation. Required activation belongs in the explicitly
awaited handler, not an asynchronous notification hook.
If error notification itself throws, that notification failure is reported through
the host's ordinary error mechanism. It does not trigger another `route:error`
or replace the original routing rejection.

The third error argument is `RouteErrorContext`: `{ readonly info: unknown }`.
It exposes that attempt's originating navigation `info`, including when `match`
is null, and preserves the same value/reference through redirect hops. Initial
dispatch and `refresh()` have `info: undefined`; they do not inherit the previous
Match's info. An ordinary Driver navigation supplies its own event info.
Existing two-argument listeners/hooks still receive the same error and Match.
The promise rejects with the original error, without wrapping or attaching context.
Context is captured from the failed attempt before notifications can navigate again;
it is not inferred from the Error identity or the Router's current Match. Applications
can use their own info values to coordinate promise and event error observation.
The package adds no error-reporting or deduplication policy. Driver/setup failures
outside a routing attempt can reject or throw without emitting `route:error`;
continue to observe the requested operation's result. Cancelled/stale work does
not acquire an error notification merely because it had info.

`navigate()` synchronously returns `{ committed, finished }`, each a
Promise<boolean>. Commitment concerns the URL; finished awaits the handler and
redirect destinations. Supersession/cancellation is false; current operational
failure rejects. `refresh()` and `back()` return navigation readiness directly;
`start()` reports only Application activation. Its completion does not imply that
the automatically dispatched initial route has finished.
Redirected back follows its own traversal's readiness rather than an unrelated
navigation result.
When a driver coalesces queued Back calls to the same preceding entry, those
callers share the routing chain's readiness, redirects and operational failures.
The driver still owns traversal scheduling; the helper does not debounce calls.

A navigation requested synchronously by an outgoing route's abort listener keeps
authority over the request that triggered that abort. At this native reentry
boundary the Router defers the newer Driver call to a microtask, cancels obsolete
route work, and observes both result promises. Further Router navigation, Back,
stop, or browser/Driver events after that synchronous dispatch returns can supersede
the deferred request. Controlled redirect hops proceed
immediately; this does not compensate browser history.

Do not synchronously mix raw Driver or native navigation calls into that same
abort/dispatch stack. The Driver contract cannot identify which initiating
request produced a reentrant event; an inner raw event can arrive before the
outer event. Such mixed calls have no guaranteed correlation or winner. Use
Router navigation from route/abort callbacks. Ordinary browser navigation in a
subsequent event retains its normal Driver behavior.

Cancellation invalidates authority immediately, including after readiness. Router
completion settles promptly on cancellation even when a handler/redirect ignores
its signal. That underlying work remains observed and can continue until it
settles; pass/check the signal before effects after awaits. Application startup
has its separate completion contract. A fulfilled handler result, including
`false`, is successful completion when the Match remains current. Router does not
infer cancellation or follow detached replacement work from that value. Cancellation does not
undo arbitrary application effects. There is no constructor rollback, attempt-all
teardown or general synchronous recovery policy.

## Route definitions and matching

An array contains `{ path, name?, handler?, children?, meta?, redirect?, data? }`
definitions. A hash takes its path from each key and its optional name from the
value. Hash values must be plain objects, including null-prototype objects;
malformed values throw a TypeError identifying the offending path before normalization.
Own `path` fields in hash values are rejected to catch legacy declarations.
Both forms can be nested. This pure matching example does not activate routing:

```js
const router = new Router({ routes: {
  '/': { name: 'home' },
  '/items/:id': { name: 'item' },
} });
router.url('item', { id: 42 }); // /items/42
router.match('https://example.test/items/42').name; // item
```

Names are globally unique, nonempty strings. Leading `/` or `scheme://`
forms are reserved for URL navigation. Namespaces in Application mounts explicitly
compose names; engine nesting alone does not invent prefixes.

Internally, `pattern.ts` handles one pathname's grammar, encoding, native
URLPattern execution and prefix patterns. `matcher.ts` owns the route table,
competing-route ordering, nesting, mounts and generated-URL round-trip
checks. Pattern tokens and compiled execution stay internal to the package.

Named and unnamed nodes form a route tree. Relative children append to their
parent; absolute children begin at the root. A leading slash-owning brace group,
such as `{/:id}?`, joins directly to its parent: `/items` plus `{/:id}?` becomes
`/items{/:id}?`. At the root, `{/:lang}?/about` produces `/about` or `/en/about`;
an entirely omitted optional pathname is matched as `/`. Named nodes match themselves;
unnamed nodes provide prefixes and inherited metadata. Names are unique, including
parameter names across all logical ancestors, including absolute-path resets. Metadata merges root to leaf; branch entries
retain their own parameters and metadata.

The pathname grammar is a deliberately small URLPattern subset:

| Form | Example | Meaning |
| --- | --- | --- |
| Static text | `/items/new` | Literal pathname text, including Unicode |
| Named parameter | `/items/:id` | One nonempty value; ASCII identifier names (`id`, `_id`, `$id2`) |
| Embedded parameter | `/file-:id.:ext` | Parameters can share a segment with literal text |
| Required brace group | `/items{/detail/:id}` | Group contents are required |
| Optional brace group | `/items{/:id}?` | Omit the group when none of its parameters is supplied |
| Literal escape | `/literal/\\*` in a JS string | Escape reserved syntax for literal matching |

A brace group may surround one named parameter and literal text. Optional
static-only groups match with or without their text; URL generation omits them.
The tokenizer recursively handles groups, while native URLPattern remains the
syntax authority and rejects nested groups or several parameters in one group.
Adjacent groups are supported. Supplied numeric zero is encoded;
undefined, null and empty-string values omit optional groups.

Literal `?` and `#` delimiters cannot appear in pathname text, even escaped; use
`%3F` and `%23` respectively. The `?` after a brace group remains its optional
marker. Query values belong in the URL-generation `query` option, not in route
pathnames. Parameter values containing `?` or `#` are encoded normally.

Unescaped parentheses (including inline regex constraints and unnamed captures),
wildcards, parameter `?`/`*`/`+` modifiers and group `*`/`+` repetition are rejected
during route compilation. Use `{/:id}?` instead of `/:id?`. There is no catchall
or second URL builder. Quoted and Unicode parameter names are rejected rather
than partially captured. A small identifier regex only tokenizes parameter names;
user-supplied route regex constraints and their build-time validation are removed.
The internal prefix matcher still uses a native wildcard to collect unnamed-branch
parameters for not-found decisions; it is not part of the route-definition grammar.

Ranking compares declared segments: exact static text, mixed required literal
text with parameters/optional suffixes, bare parameters, then optional-only segments.
Mount priority breaks specificity ties; stable definition order breaks remaining ties.
Optional groups are not expanded into separately ranked route variants. For example,
`{/:lang}?` can shadow `{/:lang}?/about` at `/about`; use explicit unambiguous
routes rather than relying on the omitted optional prefix to gain static priority.
Query values use URLSearchParams. Matching decodes parameters; generation encodes
each parameter as a single value, including any slash it contains. Matching ignores
trailing path slashes; URL generation omits them except at `/`. Incoming URLs keep
their original slashes: matching does not redirect or rewrite the browser URL.

Named URL generation/navigation inherits only omitted own parameter keys from
identical route nodes shared by current and target branches. Sharing a parameter
name is insufficient. Absolute child paths reset inherited URL parameters.
Explicit null, undefined or empty strings clear values; required values then fail
generation. Prototype properties never supply parameters. Query/hash are not
implicitly inherited by ordinary named navigation.

Generation rejects missing/invalid parameters, destructive whole-path dot segments, static-route collisions
and values that do not round trip through matching. Safe embedded dot values such
as `..` in `/file-:id` are allowed. Parameter values are own properties; prototype
names such as `constructor` and `__proto__` round trip as ordinary data. Pure `match(url)` has null
navigation fields and causes no redirects or history effects. Mount/unmount updates
the route table without dispatch; call active `refresh()` to dispatch it. A child
mount whose parent is removed remains dormant and reactivates when a route with
that parent name is registered again; its owner may explicitly unmount it instead.
Removing a registration aborts its pending/current work and clears a removed current
Match. It does not abort an unrelated newer navigation. Remounting the same name
creates a new registration identity; it cannot revive the earlier attempt or emit
its stale `route:ready`. An unchanged registration survives matcher recompilation.
Cancellation settles routing completion even if a handler ignores its signal;
consumer code must still check that signal after awaits before applying effects.

Registration changes can recompile the full active route table. Mount compiles
immediately; unmount invalidates compilation until the next lookup, which
reconciliation of current/pending work can trigger. Frequent registration changes
across large catalogs can be costly.

## Feature route registration

`routeTable(Source, { namespace? })` compiles a RouteApplication class, instance or
static descriptor into an ordinary readonly route array. Leaves declare
`{ name, handler?, redirect?, meta? }`; mounts declare
`{ mount, namespace?, region?, meta? }`. Hash keys are paths; array entries also
specify `path`. A mount must name a RouteApplication class in a `childApps` object.
Compilation rejects missing mounts/names and cycles in the current ancestor stack;
the same child class may be reused in independent sibling mounts.
Each owner's declaration may use a child mount name only once. Duplicate names
are rejected even when paths, namespaces or Regions differ. Register the same class
under distinct child names for independent placements; those names remain local
to each owner. Mount identity continues to use only that node's own params.

```js
const Item = RouteApplication.extend({
  routes: {
    '': { name: 'item', handler: 'showItem' },
    'reviews': { name: 'reviews', handler: 'showReviews' },
  },
  async prepareStart({ id, load }, { signal }) {
    const item = await load(id, { signal });
    signal.throwIfAborted();
    return item;
  },
  onStart(_app, _options, item) { this.item = item; },
  showItem(match) { /* show a View through this Application's Region */ },
  showReviews(match) { /* this.item is retained for this item identity */ },
});
const Catalog = RouteApplication.extend({
  childApps: { item: Item },
  routes: {
    '/catalog': { name: 'catalog', handler: 'showList' },
    '/catalog/:id': { mount: 'item', namespace: 'catalog' },
  },
  childRouteOptions() { return { load: this.getOption('load') }; },
  showList() { /* parent page; its mounted item has already been stopped */ },
});
const catalog = frame.addChildApp('catalog', new Catalog({ region, load }));
catalog.mountRoutes(router);
await catalog.start();
await router.start();
```

This is a lifecycle configuration fragment; the [complete example](examples/catalog/README.md)
includes real escaped rendering and error observation. Start independently
registered roots before dispatch, not necessarily before mounting. Registration
alone neither activates a root nor rejects stopped handlers. Mounted descendants
are started by branch dispatch; omitting root start skips its preparation and
prevents selection even though a leaf can still run. No automatic root lifecycle
or rollback is implied by `route:ready`.

`mountRoutes(router, { parent? })` calls Router.mount with this Application as
controller and registration owner, returning an explicit unmount function. A
named `parent` composes URL paths without choosing UI ownership. Stop/restart
retain registrations; destroy unmounts them. Mounting does not dispatch an existing
URL: use active `refresh()` after lazy registration. Independently registered roots
need their own explicit start and teardown.

Each compiled table carries a private identity on its opaque branch data, so
mounting one table below another dispatches only the matching table. Each level
calls synchronous `before:route`/`onBeforeRoute(match)`, then rechecks route
authority. A mount selects its child using only that entry's own params as the
key; descendant params do not restart ancestors. Start options contain those
params plus `childRouteOptions(match, mount)` and the selected Region.
`getMountRegion()` defaults to this Application's Region, or a named Region on
its current View. A mount's `namespace` changes descendant names, not paths.

`routeTo(match)` enters the appropriate table, and `routeBranch(match, index)`
awaits selection then delegates to the selected child's next branch. A leaf calls
`clearMountedChild(match)` to clear only a selected child declared as a mount by
that owner's compiled table, then awaits its local handler. The optional Match
context lets the default implementation use that registration's snapshot even
if live declarations later change. A manual no-argument call uses current
declarations. Existing no-argument overrides remain valid; forward Match when
delegating to the default implementation. Independent children/panes are not all stopped when a parent leaf
runs. Local handlers that use manual selection own its explicit `clear()` policy.
No per-route name-to-method forwarding map or second matcher is required.

`handleRouteError(error, match, { mount, phase })` receives a current failure from
this branch (`phase: 'start' | 'route'`). A child's rethrow reaches its parent's
boundary, then Router `route:error` if nobody handles it. Returning a result means
handled completion. Stale canceled errors are suppressed. The authorized async
branch catch provides this error boundary; other synchronous callback failures
still have ordinary failure semantics, with no attempt-all cleanup or recovery.

Router.mount can also register ordinary engine definitions with an independent
controller/owner. Owner destruction unmounts; controller binding alone establishes
no ownership. Router destruction releases registrations and owner listeners.

`match()` preserves a supplied URL object. Absolute URL strings are parsed without
accessing a Driver. Relative strings resolve against the Driver's current URL,
including before `start()` or inside `initialize`; matching itself acquires no
navigation subscription and writes no history. Relative matching requires a Driver
URL even before start. The default Driver requires the document Navigation API;
in Node, inject a memory Driver or pass an absolute URL. No fallback origin is
invented. URL generation and route-table inspection remain Driver-independent.
Importing the package does not construct a URLPattern. Native pattern support is
required when routes are compiled or generated, rather than for unrelated exports.

Generation uses the same native candidate selection as matching and checks decoded
parameter values. A native URLPattern normalizes generated pathname text before
selection, including Unicode, spaces and dot segments. Generated network-path
references (`//host/path`) and literal backslashes are rejected because HTTP URL
parsing can reinterpret them as a host or separators; use `%5C` for literal data.
Backslashes inside parameter values are percent-encoded normally. Query conversion
is shared by named URL generation and raw navigation targets.

`notFound: 'missing'` chooses a fallback name only when no route matches.
The fallback retains the unmatched URL/query and deepest matching unnamed-prefix
params. A registered target supplies its handler and metadata; otherwise Router's
global handler receives the fallback name with an empty branch and metadata. It does not capture
an unmatched tail or borrow the prefix's branch data. Equally deep prefixes use
specificity, mount priority and stable order; malformed winning-prefix encoding
does not fall through. Pure `match()` still returns null. URL generation uses the
registered route's real path, not the unmatched URL.

`owns(url)` limits same-origin claims. Without it, notFound claims all same-origin
URLs, including server endpoints; explicitly exclude those paths. A registered
fallback retains its target branch for dispatch, but its params are not implicitly
forwarded through that target's URL ancestry. Explicitly pass `match.params` when
a subsequent named link needs those prefix values.

Redirect callbacks return a same-origin URL or named target, optionally
asynchronously. Ordinary redirect hops share `maxRedirects` (default 5).
String targets must begin `/`, `?`, `#` or `scheme://`; bare names are rejected.
Query/fragment-only targets resolve
against the captured navigation URL supplied to the redirect callback. This base
is the same for synchronous and asynchronous callbacks; it does not depend on
which entry has committed while a lookup is pending.
An internally followed fragment target runs its destination handler and contributes
to the redirect chain's readiness, including during initial dispatch. Ordinary
navigation reported by the Driver as `hashChange` remains native and does not
dispatch a route. Removing a fragment or navigating to an identical fragment URL
does not set that flag in the native driver and can dispatch a route normally.
If a native `hashChange` navigation supersedes a routed navigation whose handler
is still pending, that route's signal aborts and its completion becomes false.
The Router does not transfer the pending handler to the hash entry or dispatch it
again. Features own coordination between ordinary fragment controls and their
required presentation work.
Synchronous redirects replace the URL before activating the target; an asynchronous
redirect commits its source while its required lookup is pending. Lookup failures
remain associated with that source URL. Cancellation invalidates a stale redirect
result, but application code must pass/check the signal before its own effects.
This authority boundary also applies when synchronous planning callbacks start a
newer navigation, including during initial dispatch.
`refresh()` also abandons its captured entry when its interception preflight
stops routing or requests a newer navigation, including a vetoed request. It does
not turn that obsolete preflight into document navigation.

### Old bookmarks and renamed features

Register an old URL as an ordinary named route with a redirect. Pure `match()`
returns that old route's own name and parameters; URL generation builds the URL of
the requested name. An old route may have different parameters from its target.
Fetch any missing target data in the application's async callback:

```js
const CatalogRouter = Router.extend({
  routes() {
    return [
      { name: 'item', path: '/collections/:collectionId/items/:id' },
      { name: 'oldItem', path: '/legacy/:legacyId',
        redirect: async(match, { signal }) => {
          const item = await lookupItem(match.params.legacyId, { signal });
          if (signal.aborted) return;
          return { name: 'item', params: { collectionId: item.collectionId, id: item.id } };
        },
      },
      { name: 'oldDetails', path: '/legacy/:legacyId/details',
        redirect: { name: 'oldItem' },
      },
    ];
  },
});
```

Here the details bookmark first replaces itself with the legacy lookup URL, then
replaces that URL with the current item URL after the lookup. An error belongs to
the intermediate lookup URL. No fetch policy, data source or lookup cache is built
into the Router.

A named redirect target is `{ name, params?, query?, hash? }`. Omitted fields
forward from the redirecting match for synchronous and asynchronous targets.
Explicit parameter keys override forwarded values; explicit query replaces the
forwarded query. Empty/nullish values clear parameters or query as supported by generation. The
fragment follows the platform URL.hash setter: `details` and `#details` both
produce `#details`, empty string clears it, and `#` keeps an explicit empty fragment.
Unicode is encoded and existing escapes remain. This fragment option belongs to
redirect targets, not ordinary url()/navigate() options. Source entry state and
originating navigation info continue across redirect hops.

Entry state is a plain object (including null-prototype objects), or null/undefined
where permitted. A reserved `@mnjs/router` ownership marker is stripped from Match
state. Nested values follow structured-clone semantics. Same-path replacement
preserves omitted state; pushes/different-path replacements start empty.

The native Driver handles only URLs claimed by the Router. Interception omits
`focusReset` and `scroll` for ordinary navigations, using native after-transition
defaults. `navigate()` accepts those native-named options independently, each as
`'manual'` or `'after-transition'`. Invalid values synchronously throw a TypeError
before resolving the target or invoking Driver navigation. For example:

```js
await router.navigate('/items?filter=open', {
  history: 'replace',
  focusReset: 'manual',
  scroll: 'manual',
}).finished;
```

Ordinary navigation has no query/hash inheritance; named redirects forward as described above. Options are snapshotted for that operation and
its redirect hops; later independent navigations, links and history traversal use
their own defaults. Policy does not enter history state or user `info`. It applies
only to events intercepted by this Router; ordinary `hashChange` and document
navigations remain native. `refresh()` always requests manual focus and scroll while re-dispatching
the current URL with replacement history, including its redirect hops. Preserving
focus still requires the application to retain the focused DOM element. Its handler
Promise includes returned route work and synchronous `route:ready` notifications.
Await child activation and required feature work in the route handler: Application
`prepareStart` is awaited, but `onStart`/event hook Promises are not. Rendering into
an attached Region can complete synchronously; this is not a paint, image, font or
late-layout guarantee.

With after-transition defaults, successful native completion resets focus unless it actually changed during the
navigation, and scrolls to a fragment/top or restores history positions. Calling
`focus()` on an already focused element may not count as a change. Native rejection
can reset focus without automatic scrolling. Actual native cancellation or
supersession aborts that transition; `Router.stop()` instead invalidates local route
work and does not itself abort the browser's event. Required work should observe
its signal. Direct initial dispatch has no intercepted event, but initial redirect
hops and `refresh()` use real native navigations (refresh preserves focus/scroll).
An initial fragment may be processed before asynchronously rendered content exists;
direct startup does not retry that fragment scroll. Applications own any required
initial-fragment positioning after their content is ready. Views retain application-specific
pane/focus policy; replacement of scrollable DOM needs application-level validation.
No custom restoration machinery or global focus/scroll policy is added.

Initial Match metadata reads `driver.activation?.navigationType`, falling back to
`push` when activation is absent or null. The native adapter reads activation live;
it describes how this Document was entered, not the latest same-document event.
`memoryDriver({ url, activation: { navigationType: 'traverse' } })` can simulate it;
later memory navigations do not rewrite this document metadata. Initial redirect
hops retain `initial: true` and report the hop's `replace` type.

The standalone Driver interface also exposes `reload()` and
`traverseTo()`. Router uses `currentEntry`, optional activation metadata, `entries()`,
`navigate()`, `back()`, `updateCurrentEntry()` and the `navigate` subscription;
its own `back()` checks the preceding entry's ownership and invokes Driver `back()`, and
`refresh()` uses replace navigation rather than Driver `reload()`. Implement the
full public Driver contract, not only that Router-used subset. Shared automated
Driver conformance runs against memory and History adapters. Separate installed
Chromium specifications exercise native behavior; they are not a run of the
entire shared conformance suite against the native adapter.
Use each event's `cancelable` and `canIntercept` fields for that navigation;
Driver does not expose separate static capability flags.

The Router does not prescribe loading/error UI, authentication, service access or
server fallback policy. Node tests use the same public contracts
with `memoryDriver({ url })`. Its initial URL is required and must be absolute;
relative navigation then resolves from its current entry. Native-browser
conformance is separate evidence.
Memory's settled signals are not retroactively aborted by later navigation;
pending handlers remain supersedable until `finished` settles. Completed attempts
are then released by the Driver.

## History API driver

`historyDriver()` is an optional named export, like `memoryDriver()` and
`navigationDriver()`. The application chooses a Driver and passes it to Router;
the package does not detect capabilities, load drivers, or install polyfills.
The native Navigation API adapter remains the default. Install a URLPattern
polyfill before constructing Router when the runtime lacks URLPattern; the other
documented built-in requirements still apply.

The History adapter's supported boundary is deliberately smaller than native
Navigation:

- `entries()` exposes a dense window of entries known to this Driver instance;
  `currentEntry.index` indexes that array. It cannot enumerate arbitrary browser
  history. A new instance/document reload or an unknown entry starts a new window. Unknown
  keys reject traversal, and `Router.back()` cannot promise access to prior
  unknown entries. Foreign writes without a recognized stamp, or with a changed
  URL, reset this window on the next Driver read/event and cancel the previous
  local transition and traversal receipts. Copying a Driver stamp
  into another entry at the same URL cannot be detected and is unsupported.
  Use this Driver as the History writer; it does not patch global History methods.
  Ordinary fragment navigation can also reset this instance-local window; it
  does not erase actual browser history. Unobserved joint-history changes in other frames are outside this ownership
  boundary too: relative `go()` can traverse a frame without a top-window pop.
- Same-origin intercepted push/replace operations commit History state and await
  required route work. Browser Back/Forward commits before `popstate` and is not
  cancelable (`event.cancelable` is false). Stale work is canceled; the Driver does not
  undo traversal or compensate history. Live duplicate same-target helper calls share
  readiness. A different non-current helper destination rejects with
  InvalidStateError while a live request awaits commitment, without issuing
  another relative traversal. Current-key no-ops and invalid keys do not cancel
  an existing request. Once the known destination commits, a distinct
  traversal can start even while that destination's handler is pending.
  A new owned push/replace cancels older local traversal receipts with
  AbortError; the browser may still deliver their physical traversal later. That
  later pop is handled as a fresh event and is not attached to the canceled
  receipt's readiness/error. The adapter cannot observe whether the browser
  canceled a queued `go()`, and does not add a timeout or retry queue to infer it.
  Canceling a local receipt permits a new helper request. Every observed traversal
  reconciles actual location and settles the live receipt: it succeeds only at
  its requested key and cancels on a different key. An earlier canceled `go()`
  can interfere with the newer request; the adapter does not pretend to identify
  which call caused the arrival or leave a permanent physical-traversal gate.
  `popstate` cannot identify user intent, so traversal reports `userInitiated: false`;
  intercepted clicks use the original click's trusted-input flag.
  Successful completion is terminal for the Driver event's signal: later
  navigation, fragments or `pagehide` do not retroactively abort it. Pending work
  remains cancellable. Router separately invalidates its Match signal on a matched
  replacement, stop or registration removal.
- Entry keys use reserved `@mnjs/router/history` metadata in native History state.
  Plain object fields, including Router's ownership marker, remain intact; other
  state values use an envelope. Driver `getState()` returns caller state with normal
  structured-clone semantics. A proposed navigation destination reads its new
  snapshot during dispatch; the committed current entry reads live state, while
  earlier entry objects retain their snapshots. A previous instance's state is decoded but its keys
  are not treated as known. Plain object state reserves the metadata key.
- Unmodified same-origin links can be intercepted; modifiers, downloads, other
  targets, forms and cross-origin links stay browser-owned. Unclaimed, uncanceled
  clicks retain browser default behavior. Ordinary fragment links remain native;
  controlled Router fragment redirects still participate in route readiness.
  Ordinary same-URL anchor clicks can push duplicate entries; programmatic
  `history: 'auto'` replaces when the URL is unchanged.
- Unclaimed programmatic navigation/reload hands off to the document and rejects
  its local promises with AbortError. This does not claim cross-document readiness.
  Provided state is retained for reload; cross-document state delivery is not
  provided by Location navigation. Programmatic History navigation accepts only
  HTTP(S) URLs; other schemes reject both promises with NotSupportedError before
  dispatch or Location handoff. Ordinary mailto, tel and other non-HTTP anchor
  links remain browser-owned. This restriction belongs to the History adapter;
  the native adapter continues to delegate to the Navigation API.
  The adapter does not emulate native focus/scroll restoration or transition
  policies; applications retain presentation policy.
- Window/document listeners are acquired by the first Driver subscription and
  released when its last subscription signal aborts. Detachment cancels pending
  local work and traversal receipts. Non-current `back()`/`traverseTo()` calls
  without an active `navigate` subscription reject both promises with
  InvalidStateError before issuing `history.go()`. Current-key no-ops still
  succeed without a subscription. Rebinding permits normal traversal again;
  Router maintains its subscription while routing runs. Share one Driver with
  the browser Router.

These are implementation requirements, not additional browser certification.
The installed-package tests name the engines actually exercised.
The tested `urlpattern-polyfill@10.1.0` does not reproduce native URLPattern for
`__proto__` parameter groups or unfinished/literal-backslash patterns. It can
produce `[object Object]` parameter values, accept an unfinished escape, or accept
a generated path that native URLPattern rejects. Ordinary names, parameters and
groups have separate passing evidence; this is not a claim of complete polyfill
compatibility. The Router's native grammar contract is unchanged.

## Child Applications

RouteApplication has one selectable child group, also useful without routes or a
Router. Register ordinary Application children and start the owner, then call
`switchTo(name, { key, options, signal, restart })`. The implementation is private;
there is no separate public selection class or child-routing language.

Equal keys retain or join the same registered child. Same-key callers share an
outcome and startup failure; a new joined call does not supersede the earlier one.
A changed key or per-call `restart: true` stops/starts that same instance. Restart
is not a class/constructor default. Running Application.start ignores new options;
choose a changed key/restart when loading must repeat. Reconstructing an instance
requires explicit owner registration replacement.

Selection keys are undefined/null/string/number/boolean or flat plain records
(including null-prototype records) of those values. Own enumerable string keys are
copied before any outgoing stop/incoming start callback. Missing fields differ
from present undefined; values use Object.is, including NaN equality and signed
zero distinction. Copies preserve own __proto__ fields as data. Nested containers,
arrays, class instances, symbols, bigint and functions are unsupported. Hidden and
symbol properties do not contribute identity. Use small resource identities.
Invalid keys reject before selection side effects.

The optional caller signal limits that caller's result; it never aborts shared
child preparation. Aborted callers promptly fulfill undefined while preparation
continues for other callers; late failures remain observed. Superseded callers
also fulfill undefined. Owner stop/destroy
still invalidates selection and cancels owned lifecycle work. Late failures remain
observed, and obsolete work cannot clear a newer selection. Check authority after
awaiting work before application effects. An undefined result does not prove all
underlying feature work stopped.

A failed current startup rejects its original error and cleans that preparation
once for all joined callers. A later preparation has its own cleanup. Once a
current failure is observed, successful cleanup selecting another child does not
hide that original error. A failure already obsolete before observation is
suppressed. Optional onCleanupError(error, child) observes a secondary cleanup
failure; without it that secondary error is discarded. The primary startup error
wins when that observer returns normally. Normal synchronous stop/notification errors propagate through the ordinary
failure boundary; no rollback or attempt-all cleanup is promised. clear() returns
nothing and is idempotent, including when there is no selection or the owner is stopped.
Method hooks run before internal lifecycle event listeners. A same-key selection
from a child's before-stop hook receives Application's blocked-start result and
can retain that stopped child as the selection; use an explicit later selection
to activate it. A child's onStop can start the next run. Throwing synchronous
hooks still abort ordinary teardown without recovery guarantees.

Application preparation, route completion and feature presentation have distinct
lifetimes. A page that replaces its own startup before first presentation can keep
a feature-owned stable presentation promise; a fulfilled false start result does
not complete that required replacement work. The [Desk example](examples/desk/README.md)
shows this policy with loading/content/handled-error Views, late rejection and
owner teardown. Later local refresh is a separate operation.

## Typing and JavaScript

Authored ESM/CJS declarations support TypeScript and CheckJS. defineRoutes retains
path-keyed names/params for engine tables; routeTable recursively infers mounted
class names, namespaces and composed paths. Numeric object keys stringify as in
JavaScript. Absolute child paths reset URL params but preserve namespace prefixes.
Optional namespace values/options include both possible name sets. Dynamic tables
fall back to string/Params. mountRoutes does not widen an existing Router catalog:
use an explicit `Router<typeof table>` generic for the compiled catalog, then
mount with the root Application as controller/owner (normally root.mountRoutes).
Passing a compiled table directly as Router constructor routes resolves routeTo
on the Router, which has no such method.

RouteApplication.extend preserves ordinary Application required initializer/custom
constructor arguments, state, static methods and preparation-result inference.
Routes/childApps declarations retain literals without freezing unrelated state.
BranchEntry.data is unknown; engine users must narrow their own opaque data.
Required URL params remain required in types even when a shared current branch
could supply them at runtime. SelectionKey and SwitchOptions are exported types;
the selection implementation is private.

## Marionette runtime family

Router and RouteApplication extend Marionette's named default Application family.
An isolated createMarionette() runtime cannot register these instances as children;
extend() does not change that identity. Use the default family for this package's
Application tree. No global provider or Radio bridge is installed.

## Package and validation boundary

The root named driver factories are application-selected and tree-shakable in
optimized ESM consumers. Router's native default may remain in a live Router bundle
with an explicit alternative driver; no automatic fallback or internal loader is
present. Consumer bundlers control conditional imports/network chunks. The source
build requires core declarations first (`npm run build` on a clean checkout).

Browser validation targets Chromium, Firefox and Playwright WebKit, with the
actual Navigation API for the default and an explicit History adapter/polyfill
path on each engine. Passing exact-archive receipts establish tested coverage;
capability presence and configured projects are not certification. Playwright
WebKit does not certify every shipping Safari/iOS version. Actual bfcache
restoration remains unverified. Node minimum
is 24.15; source toolchain pins and core's separate consumer floor remain distinct.
Installed archives test runtime, ESM/CJS declarations, dependencies, documentation,
shipped examples and optimized consumers. Public API and behavior have separate
unit/native evidence; pass counts alone are not a release decision.
