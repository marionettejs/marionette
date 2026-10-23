# Routing with Marionette v5

This private package uses Marionette's Application ownership and lifecycle
conventions and leaves application-specific policy with its owners. Router owns
routing activity; optional RouteApplication owns feature route registrations and
ChildAppSwitcher owns a selectable child group. Match is plain
typed data. [Source provenance](PROVENANCE.md) records
original revisions and the unresolved publication requirements.

## Responsibilities

| Responsibility | Owner |
| --- | --- |
| Compile/rank nested routes, build URLs, plan redirects | Router and its internal matcher |
| Navigation/history event semantics | Injected Driver |
| Current route decision and cancellation authority | Match and its AbortSignal |
| Prepare/start/restart/stop features and own children | Application, including Router |
| Own and switch one group of child Applications | Optional ChildAppSwitcher Application |
| Register/unregister a feature's declarative routes | Optional RouteApplication |
| Render, place child Views, manage DOM/focus/scroll | Views and Regions |
| Service requests, permissions, loading/errors, analytics | Application policy |

A small application uses one Router handler. A larger application registers the
Router and optional content groups in its Application tree. Use one browser Router
to own navigation; nesting Applications does not create more browser listeners or
automatically mount route definitions; a RouteApplication declares that registration
explicitly. There is no global Radio channel, required
child activation protocol, rendering adapter or parallel lifecycle framework.

See Marionette's [architecture](../../docs/architecture.md),
[Application](../../docs/api/application.md)
and [events](../../docs/api/shared/events.md) contracts.

## Construction, options and extension

Router, RouteApplication and ChildAppSwitcher use callable Application constructors. Marionette's `.extend()` forwards through `parent.apply`; custom
constructors may delegate with `Parent.call(this, options)` when needed.
Ordinary applications should use `initialize` rather than override construction.

Required private routing state exists before `initialize`. Application first merges
class `options` and supplied options; matching/configuration can then be used safely
inside a subclass's initialization. Routes compile before construction returns.
The implementation uses no temporary replacement of the user's `initialize` hook.

Configure `routes`, `driver`, `handler`, `intercept`, `notFound`, `persistParams` and
`maxRedirects` through constructor options or class/prototype defaults. Constructor
options take precedence through `getOption`. Class `options` merge shallowly, as
other Marionette objects do; no second options store or deep-merging system exists.
A `routes()` factory runs in Router context once per instance. Route tables accept
arrays or name-keyed hashes, including in `children` and `mount`. Registration does
not mutate them: it snapshots containers, definitions, children and top-level metadata. Later caller edits do not change registered routes;
register/unregister explicitly. Redirect callbacks retain identity, and nested
metadata values keep their original references (metadata copies remain shallow).

```js
const CatalogRouter = Router.extend({
  routes() {
    return [
      { name: 'home', path: '/' },
      { name: 'item', path: '/items/:id' },
    ];
  },
  handler(match, { signal }) {
    return catalog.activate(match, { signal });
  },
  onRouteReady(match) {
    catalog.announceReady(match);
  },
});
const router = new CatalogRouter();
```

Policy callbacks use the Router as context where specified by the typed options.
A route-specific `handler` is a function or controller method name. The root
Router is its default controller; `mount(routes, { controller })` supplies another
controller. Functions run with that controller as `this`; method names use
Marionette's shared `resolveMethod` contract at registration, including `MN0019`
for a missing or non-callable method. The matched route's handler is awaited. If it has none,
Router's global `handler` is awaited instead; both do not run for one route.

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
If the Router's own synchronous Driver setup fails, it stops through ordinary
Application teardown and rejects `start()` with that original setup error.
This cleanup is scoped to routing setup: a consumer's throwing `onStart` retains
Application's ordinary post-activation callback-failure contract.

Once activated, the Router acquires one Driver subscription and dispatches the
current URL asynchronously. `start()` does not await that navigation. Current
routing failures emit `route:error`, including initial failures, and leave the
Router enabled. Use `refresh()` to retry the current URL. `route:ready` identifies
successful current route completion; unclaimed and canceled attempts do not emit
it. These notifications do not form an all-outcomes initial-readiness Promise.

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
Promises; `refresh()` and `back()` resolve false; `canGoBack()` is false and
`updateState()` returns false without writing browser state. Pure matching, URL
building and route-table inspection/configuration remain available. Active
`updateState()` returns true. `getCurrent()` identifies the last committed Match;
its signal is aborted when the run ends.

`canGoBack()` reports whether the previous history entry was marked by this
router package; `back()` returns its navigation readiness or resolves `false`
when no such entry is available.

| Notification | Hook | Timing |
| --- | --- | --- |
| `route(match)` | `onRoute(match)` | Current Match committed, before the awaited handler |
| `route:ready(match)` | `onRouteReady(match)` | Handler fulfilled and Match remains current |
| `route:error(error, match)` | `onRouteError(error, match)` | Current routing failed; Match is null when failure precedes Match commitment |

Hooks run before listeners through `triggerMethod`. Notification return values do
not cancel navigation and returned Promises are not awaited. A synchronous hook
exception aborts that operation. Required activation belongs in the explicitly
awaited handler, not an asynchronous notification hook.
If error notification itself throws, that notification failure is reported through
the host's ordinary error mechanism. It does not trigger another `route:error`
or replace the original routing rejection.

`navigate()` synchronously returns `{ committed, finished }`, each a
Promise<boolean>. Commitment concerns the URL; finished awaits the handler and
redirect destinations. Supersession/cancellation is false; current operational
failure rejects. `refresh()` and `back()` return navigation readiness directly;
`start()` reports only Application activation. Its completion does not imply that
the automatically dispatched initial route has finished.
Redirected back follows its own traversal's readiness rather than an unrelated
navigation result.

Cancellation invalidates authority immediately, including after readiness. A
handler or redirect that ignores its signal may keep navigation readiness pending
until it settles. Application startup cancellation has its own prompt completion. Pass/check the signal before effects after awaits. Cancellation does not
undo arbitrary application effects. There is no constructor rollback, attempt-all
teardown or general synchronous recovery policy.

## Route definitions and matching

An array contains ordinary definitions, with optional `name` fields for named
routes. A hash maps each route name to its definition; omit `name` inside that
value. Both forms can be used in `children`:

```js
const routes = {
  home: { path: '/', handler: 'showHome' },
  item: { path: '/items/:id', handler: 'showItem' },
};
router.url('item', { id: 42 });
router.navigate('item', { id: 42 });
```

These are name-to-definition hashes, not pathname-to-action maps. Names remain
globally unique across the table and all mounts; nesting does not invent name
prefixes. One definition supplies matching, reverse URLs, navigation and links.

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

For `persistParams`, only omitted own keys inherit. Explicit `null`, `undefined`
or `''` clears a value; a required parameter then fails generation. Inherited
prototype properties are never supplied or persisted parameters.

Generation rejects missing/invalid parameters, destructive whole-path dot segments, static-route collisions
and values that do not round trip through matching. Safe embedded dot values such
as `..` in `/file-:id` are allowed. Parameter values are own properties; prototype
names such as `constructor` and `__proto__` round trip as ordinary data. Pure `match(url)` has null
navigation fields and causes no redirects or history effects. Mount/unmount updates
the route table without dispatch; call active `refresh()` to dispatch it. A child
mount whose parent is removed remains dormant and reactivates when a route with
that parent name is registered again; its owner may explicitly unmount it instead.

## Feature route registration

`RouteApplication` is an optional ordinary Application for a feature that owns
route registrations. Its constructor requires `{ router }`. It reads `routes`
through `getOption` after `initialize`; arrays, named hashes and a factory in
feature context are accepted. It mounts with the feature as controller, and its
`before:destroy` listener unmounts those registrations. UI stop and retained restart
leave them registered. Adding a feature to an app tree does not start it, its
children or siblings, and does not create another navigation listener.

```js
const Catalog = RouteApplication.extend({
  childApps: { content: ChildAppSwitcher },
  routes: { item: { path: '/items/:id', handler: 'showItem' } },
  async prepareStart(_options, { signal }) {
    await loadCatalogPrerequisites({ signal });
  },
  showItem(match, { signal }) {
    return this.getChildApp('content').switchTo('item', {
      key: { id: match.params.id }, options: { id: match.params.id }, signal,
    });
  },
});
const catalog = frame.addChildApp('catalog', new Catalog({ router }));
const content = catalog.getChildApp('content');
content.addChildApp('item', new ItemApplication());
await catalog.start();
await content.start();
await router.start();
```

Handlers still choose their activation policy explicitly. The example starts the
feature and content group before routing. A handler may instead call and await a
normal feature `start()` or a keyed child-selection operation when that is needed;
registration alone never does that work. A stopped feature's routes remain in the
table until its registration is unmounted.

For an ordinary Application, mount directly and retain the returned cleanup:

```js
const unmount = router.mount(catalogRoutes, { parent: 'catalog', controller: catalog });
// When the registration is retired:
unmount();
```

The caller owns explicit-mount cleanup. Use that form to choose a registration
lifetime other than RouteApplication destruction. Mounting/unmounting does not
dispatch the current URL; use active `refresh()` when it needs handling again.

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

`notFound: { name, within(url) }` supplies a navigation-only fallback when no
route matches and `within` accepts the URL. The Router's normal interception
rules still apply. The handler receives the configured name, the unchanged URL
and query, and parameters from the deepest matching unnamed branch prefix (or
none). Equally deep prefixes use specificity, mount priority and stable definition
order. A winning prefix with malformed parameter encoding yields no parameters;
it cannot fall through to a shallower prefix. Its metadata and branch are empty. A fallback does not capture an unmatched
tail or inherit a registered route's metadata/redirect.
It does not register a route: pure `match()` still returns null, and `url(name)`
requires a separately registered named route. Use this fallback to show a missing
page within an explicitly owned URL scope; it does not replace wildcard routing.

Redirect callbacks return a same-origin URL or named target, optionally
asynchronously. Ordinary redirect hops share `maxRedirects` (default 5).
Synchronous redirects replace the URL before activating the target; an asynchronous
redirect commits its source while its required lookup is pending. Lookup failures
remain associated with that source URL. Cancellation invalidates a stale redirect
result, but application code must pass/check the signal before its own effects.

### Old bookmarks and renamed features

Register an old URL as an ordinary named route with a redirect. Pure `match()`
returns that old route's own name and parameters; URL generation builds the URL of
the requested name. An old route may have different parameters from its target.
Fetch any missing target data in the application's async callback:

```js
const CatalogRouter = Router.extend({
  routes() {
    const forward = (name, match, params = match.params) =>
      this.url(name, params, { query: match.query }) + match.url.hash;
    return [
      { name: 'item', path: '/collections/:collectionId/items/:id' },
      { name: 'oldItem', path: '/legacy/:legacyId',
        redirect: async(match, { signal }) => {
          const item = await lookupItem(match.params.legacyId, { signal });
          if (signal.aborted) return;
          return forward('item', match, { collectionId: item.collectionId, id: item.id });
        },
      },
      { name: 'oldDetails', path: '/legacy/:legacyId/details',
        redirect: match => forward('oldItem', match),
      },
    ];
  },
});
```

Here the details bookmark first replaces itself with the legacy lookup URL, then
replaces that URL with the current item URL after the lookup. An error belongs to
the intermediate lookup URL. No fetch policy, data source or lookup cache is built
into the Router.

Query and hash forwarding are explicit application choices. A named redirect
without `query` does not inherit the source query. Named targets have no hash
option; return a URL string with the hash when it must survive, as `forward` does.

To migrate from route aliases, replace each `aliases` entry with a separately named
redirect route. Remove `getAliases()` and `Match.alias` consumers; those APIs and
the alias types/policies are removed. Keep retirement dates and bookmark policy
with the application, using ordinary registration/mount/unmount as appropriate.
There is no automatic alias metadata or `preserve` rendering mode.

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
router.navigate('/items?filter=open', {
  history: 'replace', focusReset: 'manual', scroll: 'manual',
});
```

There is no query/hash inference. Options are snapshotted for that operation and
its redirect hops; later independent navigations, links and history traversal use
their own defaults. Policy does not enter history state or user `info`. It applies
only to events intercepted by this Router; hash-only/document navigations remain
native. `refresh()` always requests manual focus and scroll while re-dispatching
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

The Router does not prescribe loading/error UI, authentication, service access or
server fallback policy. Node tests use the same public contracts
with `memoryDriver({ url })`. Its initial URL is required and must be absolute;
relative navigation then resolves from its current entry. Native-browser
conformance is separate evidence.

## Child Applications

ChildAppSwitcher is an Application that owns one selectable child group. It does
not render, borrow a Region to manipulate, or read Match. Register its pages beneath
it; persistent sidebars and other independent features stay outside this group:

```text
Frame Application
├─ Router
└─ Catalog Application
   ├─ Sidebar Application
   └─ ChildAppSwitcher (content)
      ├─ Item Application
      └─ Search Application
```

```js
import { Application } from 'marionette';
import { Router, ChildAppSwitcher } from '@mnjs/router';

const CatalogPages = ChildAppSwitcher.extend({
  async showRoute(match, region) {
    if (match.name !== 'item') {
      this.clear();
      return;
    }
    const { id } = match.params;
    if (!this.hasChildApp('item')) {
      const { default: ItemApplication } = await import('./item-application.js');
      if (match.signal.aborted) return;
      if (!this.hasChildApp('item')) this.addChildApp('item', new ItemApplication());
    }
    if (match.signal.aborted) return;
    const page = await this.switchTo('item', {
      key: { id }, options: { id, region }, signal: match.signal,
    });
    if (!page || match.signal.aborted) return;
    return page.showDetails(match);
  },
});

const frame = new Application();
const catalog = frame.addChildApp('catalog', new Application());
const sidebar = catalog.addChildApp('sidebar', new SidebarApplication());
const pages = catalog.addChildApp('content', new CatalogPages());
const router = frame.addChildApp('router', new Router({
  routes: [{ name: 'item', path: '/items/:id' }],
  handler: match => pages.showRoute(match, contentRegion),
}));
router.on('route:error', (error, match) => {
  console.error('Route failed:', match?.name, error);
});
await frame.start();
await catalog.start();
await sidebar.start({ region: sidebarRegion });
await pages.start();
await router.start(); // enables routing; route:ready reports completed route work
// pages.stop() stops content descendants; sidebar remains active.
// frame.stop()/destroy() also stop/destroy Router and the Catalog subtree.
```

`switchTo(name, { key, options, reconstruct, signal })` is an explicit operation
on a running group. Before start, after stop and during/after destruction it resolves
undefined without activating a child. Group start does not choose or automatically
start a page. Registering a page does not start it either.

Selection returns the authoritative running Application, or undefined when
superseded/canceled. Reuse requires the same registered instance, name and
structural key. Same-key calls join pending Application preparation; only the
latest selection request returns the child. A running child ignores new start
options, including `region`. Update an already-running feature explicitly, or pass
`reconstruct: true` when a rebuilt host requires stop/start. A changed key also
stops the selection and starts the same registered instance. This rebuilds UI
without removing/recreating an Application. Inherited `restart()` retains the
group's active children and does not repeat selection.

`clear()` invalidates pending selection and stops the selected child while keeping
the group running. Use it for a fallback that leaves this content level. `stop()`
disables the group and stops all registered children; `destroy()` destroys them.
Independent sidebar Applications remain outside the group's stop scope. Do not
make two groups own the same page: Application ownership permits one owner/name.

The optional signal is checked before selection and before exposing its result.
Aborting it does not stop child preparation; a newer same-key route must be able
to join that work. Check route authority after every lazy import or other await,
then pass the current signal to selection. Returning from an obsolete handler
cannot undo a selection it already made. Every route handler must select or clear
each content level it leaves; Application ownership alone does not choose a page.

The returned child is authoritative. Do not re-read registration to bypass an
undefined result. Return/await required detail activation. Application `onStart`
is a synchronous notification, not an awaited child-start hook. Pages need no
`showDetails` method when their preparation supplies all required readiness.

If a child supersedes its own first start with restart, the original selection
returns undefined and leaves the replacement running. Explicitly await that
child-owned replacement when its readiness is required. `getCurrent()` identifies
selection, not guaranteed running state; an independently stopped child can remain
selected. Removed, replaced or self-destroyed registrations are no longer current.

Startup failure cleans up the failed selection and rejects with the original error.
An optional `onCleanupError(error, app)` reports a cleanup failure separately.
Synchronous cleanup failures retain Application's normal failure boundary.

### Migrating the former helper

Remove the former `{ owner }` option. Register the switcher as a child Application,
move its selectable pages under it, and await its start before selection. Replace
helper `stop()` calls that meant only "clear this content" with `clear()`; reserve
Application `stop()` for disabling the group. Destroy now destroys the group's
registered pages instead of leaving them with an external owner. Application
`destroy()` returns `true`, rather than the former MnObject return value.

## Typing and JavaScript

The declarations model `RouteTable`, route callbacks, controllers, mount options
and ordinary Application extension. `defineRoutes()` is an identity helper that
preserves a table's literal names and paths for bounded inference:

```ts
import { Router, defineRoutes } from '@mnjs/router';

const routes = defineRoutes({
  item: { path: '/items/:id' },
  search: { path: '/search{/:term}?' },
});
const router = new Router({ routes });
router.url('item', { id: 42 });
router.url('search');
router.navigate('search', { term: 'open' });
```

For a preserved literal table, named calls check declared names, required pathname
parameters and optional brace-group parameters. Required values are string/number;
optional values can also be null/undefined. Nested definitions are included, and
absolute children reset the URL parameter prefix. No second handwritten name map
or runtime route registry is added. Literal inference does not replace native
grammar, encoding, route precedence or generated-URL round-trip checks. Correlation
between parameters in one optional group remains a runtime generation constraint.

`.extend()` retains ordinary initializer options, methods and preparation results.
It does not automatically infer a route catalog from subclass prototype defaults
in this first pass. Constructor-supplied literal routes support inference; an
explicit `RouterInstance<typeof routes>` can preserve the same catalog at a call
boundary, without a handwritten parameter map. Full automatic subclass/catalog
inference is deferred. Use `defineRoutes` or `satisfies RouteTable` to check a
prototype declaration's shape. Preserve literal definitions when typed named calls are wanted; a broad
`RouteTable` annotation or string pathname cannot supply literal inference.
Route callbacks still receive the common `ActiveMatch` and `{ signal }`, rather
than a per-handler inferred Match shape. Method-name strings use runtime
`resolveMethod` checks. Callback `this` is not inferred from a separate mount's
controller; named methods retain their normal `.extend()` context.

Dynamic mounts do not grow a static route-name union or prove registration
availability. Code working with arbitrary dynamically registered names can use a
general `RouterInstance` reference and the shared `Params` contract; runtime
validation still applies. Literal parameter inference also does not make a
required parameter optional because `persistParams` may supply it at runtime;
pass it explicitly for a strict literal call or use the general runtime contract.
Inferring names through arbitrary Radio payloads or
template engines is outside this bounded API.

JavaScript uses the same hashes, arrays, callbacks and `defineRoutes()` helper.
Optional JSDoc/checkJs can check the declared table and named calls; it is not
required to run the router. Existing Radio callbacks explicitly call
`router.navigate(name, params)` without a package-defined channel/event map.
Templates can call the same `router.url('item', { id })` to generate an anchor URL;
there is no separate template route registry or builder.

## Marionette runtime family

Router, RouteApplication and ChildAppSwitcher are ordinary subclasses of Marionette's named
`Application` export and belong to that default family. Their parent, registered
children and borrowed Regions must belong to the same family. An isolated
`createMarionette()` Application tree cannot register these classes as children.

Use `.extend()` and normal Application provider configuration to customize them.
Changing Radio or State providers does not change Application runtime identity,
and subclassing does not rebase a class into another runtime. This package exposes
no runtime-bound constructor factory. Radio/state behavior remains opt-in; the
package declares no Radio channels.

## Package and validation boundary

`marionette` is a required exact-version peer, following the family integration
convention. The package does not embed a second framework copy or import an
application repository, external data layer or renderer. The three Application classes
are exported from the root. There are no old-name aliases or separate adapter entry.

Authored TypeScript generates ESM/CJS and declarations. Public tests cover class
options/initialization, notifications, cleanup, navigation concurrency, switching,
UI reconstruction, configured providers and the default runtime family boundary. Package fixtures verify installed ESM/CJS
behavior with the required peer. Focused headless native-navigation tests exercise
the built router with packed Marionette peers; these do not certify the entire
Driver contract, minimum browser versions or any consuming application UI.

A History API Driver, reflection, richer refresh intent and additional coordination
hooks require concrete requirements; they are not prerequisites for this package's
existing behavior. Resolve source rights, release versioning/inventory and native
browser evidence before publication.
