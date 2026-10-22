# Routing with Marionette v5

This private package uses Marionette's nonvisual object conventions and leaves
application-specific policy with its owners. Router and ChildAppSwitcher are
MnObjects; Match is plain typed data. [Source provenance](PROVENANCE.md) records
original revisions and the unresolved publication requirements.

## Responsibilities

| Responsibility | Owner |
| --- | --- |
| Compile/rank nested routes, build URLs, plan redirects | Router and its internal matcher |
| Navigation/history event semantics | Injected Driver |
| Current route decision and cancellation authority | Match and its AbortSignal |
| Prepare/start/restart/stop features and own children | Ordinary Application |
| Switch one group of registered child Applications | Optional ChildAppSwitcher |
| Render, place child Views, manage DOM/focus/scroll | Views and Regions |
| Service requests, permissions, loading/errors, analytics | Application policy |

A small application uses one Router handler. A larger application composes ordinary
Applications and switchers at the lifetimes that need them. There is no compulsory
RouterApp, required child activation protocol, global Radio channel, rendering
adapter or parallel lifecycle framework.

See Marionette's [architecture](../../docs/architecture.md),
[Application](../../docs/api/application.md), [MnObject](../../docs/api/mnobject.md)
and [events](../../docs/api/shared/events.md) contracts.

## Construction, options and extension

Router uses a callable MnObject constructor rather than a native class inheriting
MnObject. Marionette's `.extend()` forwards through `parent.apply`; custom
constructors may delegate with `Parent.call(this, options)` when needed.
Ordinary applications should use `initialize` rather than override construction.

Required private routing state exists before `initialize`. MnObject first merges
class `options` and supplied options; matching/configuration can then be used safely
inside a subclass's initialization. Routes compile before construction returns.
The implementation uses no temporary replacement of the user's `initialize` hook.

Configure `routes`, `driver`, `handler`, `intercept`, `notFound`, `persistParams` and
`maxRedirects` through constructor options or class/prototype defaults. Constructor
options take precedence through `getOption`. Class `options` merge shallowly, as
other Marionette objects do; no second options store or deep-merging system exists.
A `routes()` factory runs in Router context once per instance. Ordinary route arrays
are not mutated by compilation.

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

Handlers and policy callbacks use the Router as context where specified by the
typed options. Shared callbacks remain functions; there is no additional string
handler resolver or routing configuration language.

## Lifetime and notifications

`start()` acquires one Driver subscription and awaits the initial dispatch.
Repeated start joins its initial readiness. `stop()` is synchronous, returns true,
removes that subscription and aborts navigation authority. It retains the object
and its Marionette event subscriptions, so it can start again.

`destroy()` is synchronous and terminal. It blocks further routing and stops
resources before user destruction notifications, then uses normal MnObject
cleanup for incoming/outgoing subscriptions, configured Radio and owned state.
Repeated destruction returns the same object. Application fields do not establish
automatic ownership: the owner must stop/destroy a Router it creates.

While stopped or destroyed, `navigate()` returns canceled committed/finished
Promises; `refresh()` and `back()` resolve false; `canGoBack` is false and
`updateState()` returns false without writing browser state. Pure matching, URL
building and route-table inspection/configuration remain available. Active
`updateState()` returns true. `getCurrent()` identifies the last committed Match;
its signal is aborted when the run ends.

| Notification | Hook | Timing |
| --- | --- | --- |
| `route(match)` | `onRoute(match)` | Current Match committed, before the awaited handler |
| `route:ready(match)` | `onRouteReady(match)` | Handler fulfilled and Match remains current |
| `route:error(error, match)` | `onRouteError(error, match)` | Current handler/redirect failed |

Hooks run before listeners through `triggerMethod`. Notification return values do
not cancel navigation and returned Promises are not awaited. A synchronous hook
exception aborts that operation. Required activation belongs in the explicitly
awaited handler, not an asynchronous notification hook.

`navigate()` synchronously returns `{ committed, finished }`, each a
Promise<boolean>. Commitment concerns the URL; finished awaits the handler and
redirect destinations. Supersession/cancellation is false; current operational
failure rejects. `start()`, `refresh()` and `back()` return readiness directly.
Redirected back follows its own traversal's readiness rather than an unrelated
navigation result.

Cancellation invalidates authority immediately, including after readiness. A
handler or redirect that ignores its signal may keep readiness pending until it
settles. Pass/check the signal before effects after awaits. Cancellation does not
undo arbitrary application effects. There is no constructor rollback, attempt-all
teardown or general synchronous recovery policy.

## Route definitions and matching

Internally, `pattern.ts` handles one pathname's grammar, encoding, native
URLPattern execution and prefix patterns. `matcher.ts` owns the route table,
competing-route ordering, aliases, nesting, mounts and generated-URL round-trip
checks. Pattern tokens and compiled execution stay internal to the package.

Named and unnamed nodes form a route tree. Relative children append to their
parent; absolute children begin at the root. Named nodes match themselves;
unnamed nodes provide prefixes and inherited metadata. Names are unique, including
parameter names within a branch. Metadata merges root to leaf; branch entries
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

Ranking compares segments: static, parameter, optional. Ties use definition order.
Query values use URLSearchParams. Matching decodes parameters; generation encodes
each parameter as a single value, including any slash it contains. Matching ignores
trailing path slashes; URL generation omits them except at `/`. Incoming URLs keep
their original slashes: matching does not redirect or rewrite the browser URL.

Generation rejects missing/invalid parameters, dot segments, static-route collisions
and values that do not round trip through matching. Pure `match(url)` has null
navigation fields and causes no redirects or history effects. Mount/unmount updates
the route table without dispatch; call active `refresh()` to dispatch it.

`match()` preserves a supplied URL object. Absolute URL strings are parsed without
accessing a Driver. Relative strings resolve against the Driver's current URL,
including before `start()` or inside `initialize`; matching itself acquires no
navigation subscription and writes no history. Relative matching requires a Driver
URL even before start. The default Driver requires the document Navigation API;
in Node, inject a memory Driver or pass an absolute URL. No fallback origin is
invented. URL generation and route-table inspection remain Driver-independent.

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
none). Its metadata and branch are empty and its alias is null. A fallback does
not capture an unmatched tail or inherit a registered route's metadata/redirect.
It does not register a route: pure `match()` still returns null, and `url(name)`
requires a separately registered named route. Use this fallback to show a missing
page within an explicitly owned URL scope; it does not replace wildcard routing.

Aliases specify exactly the canonical route's parameter names and an optional
compatibility window. Default `canonicalize` replaces before activation; `preserve`
keeps the alias URL. Redirect callbacks return a same-origin URL or named target,
optionally asynchronously. Alias and redirect hops share `maxRedirects` (default 5).

Entry state is a plain object (including null-prototype objects), or null/undefined
where permitted. A reserved `@mnjs/router` ownership marker is stripped from Match
state. Nested values follow structured-clone semantics. Same-path replacement
preserves omitted state; pushes/different-path replacements start empty.

The native Driver requests manual focus/scroll handling and handles only the URLs
claimed by the Router. It does not prescribe focus, loading/error UI, authentication,
service access or server fallback policy. Node tests use the same public contracts
with `memoryDriver({ url })`. Its initial URL is required and must be absolute;
relative navigation then resolves from its current entry. Native-browser
conformance is separate evidence.

## Child Applications

ChildAppSwitcher is a MnObject that switches one registered child group. It does
not render, borrow a Region to manipulate, register children itself or read Match.
An owning Application declares/registers children and explicitly requests a switch:

```js
import { Application } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

const Catalog = Application.extend({
  childApps: { item: ItemApplication },
  initialize() {
    this.pages = new ChildAppSwitcher({ owner: this });
  },
  async showRoute(match) {
    const { id } = match.params;
    const page = await this.pages.switchTo('item', {
      key: { id }, options: { id, region: this.getView().getRegion('content') },
    });
    if (!page || match.signal.aborted) return;
    return page.showDetails(match);
  },
});
```

`switchTo(name, { key, options, reconstruct })` returns the running Application or
undefined when superseded/canceled. Reuse requires the same registered instance,
name and structural key. Changing the key or `reconstruct: true` stops the current
selection synchronously and starts the selected registered instance. This rebuilds
UI; it does not remove/add an Application. `Application.restart()` instead retains
active UI while repeating preparation.

The returned child is authoritative. Do not re-read registration to bypass an
undefined result. Return/await required detail activation. Application `onStart`
is itself a synchronous notification, not an awaited child-start hook. Pages need
no `showDetails` method if initial preparation supplies all required readiness.

Owner stop cancels pending selection; retained owner restart does not abandon it.
If a child supersedes its own first start with restart, the original switch returns
undefined and leaves the replacement running. The owner must explicitly await that
child-owned replacement if its readiness is required. `getCurrent()` identifies
selection, not a promise that it is running. An independently stopped selection
can remain selected until the next switch or stop.

Startup failure cleans up the failed selection and rejects with the original error.
An optional `onCleanupError(error, app)` reports a cleanup failure separately.
Owner destruction destroys the switcher. Destroying the switcher invalidates it
and releases its subscriptions while leaving child ownership with the Application.
A destroyed switcher cannot start more children, even from destruction hooks.

## Isolated Marionette runtimes

Named imports use Marionette's default family. The package declares no Radio
channels and does not infer runtime providers from an Application owner. Use the
normal provider slots on a subclass when working in an isolated runtime:

```js
const runtime = createMarionette();
// Configure runtime StateApi before defining these classes when needed.
const ScopedRouter = Router.extend({
  Radio: runtime.Radio,
  State: runtime.MnObject.prototype.State,
});
const ScopedSwitcher = ChildAppSwitcher.extend({
  Radio: runtime.Radio,
  State: runtime.MnObject.prototype.State,
});
```

This uses the runtime's configured MnObject providers without another adapter or
runtime factory. Radio/state behavior is opt-in through ordinary MnObject
configuration. Views, Regions and Applications should come from their intended
runtime family; switching does not replace their ownership/runtime checks.

## Package and validation boundary

`marionette` is a required exact-version peer, following the family integration
convention. The package does not embed a second framework copy or import an
application repository, external data layer or renderer. Both public MnObjects are
exported from the root. There are no old-name aliases or separate adapter entry.

Authored TypeScript generates ESM/CJS and declarations. Public tests cover class
options/initialization, notifications, cleanup, navigation concurrency, switching,
UI reconstruction and isolated providers. Package fixtures verify installed ESM/CJS
behavior with the required peer. Browser conformance, minimum-version operation and
actual application focus/scroll remain separate checks.

A History API Driver, reflection, richer refresh intent and additional coordination
hooks require concrete requirements; they are not prerequisites for this package's
existing behavior. Resolve source rights, release versioning/inventory and native
browser evidence before publication.
