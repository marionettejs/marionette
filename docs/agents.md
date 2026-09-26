# Build with Marionette

For an introduction to the API, use the [quick start](./quick-start.md). For an
established task, go directly to the task table below.

Use this guide when an agent is building or maintaining an application with
Marionette. It links each decision to the same contracts a human reviewer uses.
For changes to Marionette itself, use the [maintainer guide](https://github.com/marionettejs/marionette/blob/master/docs/maintainers/readme.md).

## Establish the installed contract

Use the application's manifest, lockfile, and configuration to establish the
contract when it is not already known. Relevant facts are:

- the installed `marionette` version and matching optional package versions;
- whether the dependency comes from a published package, Git commit, or local build;
- the source revision for a checkout or custom artifact;
- the selected renderer, data/state sources, DOM integrations, and router.

This documentation describes the current source. A local build with the same
version string may contain different code. A website example, a copied prompt, or a
third-party search result is not proof that the installed package has that API.
Match the documentation's source revision to the artifact when available, then
check the installed exports and declarations. Reproduce uncertain behavior with
a small test against that package.

For a fresh application, follow [installation](./installation.md). For a v4
application, use the [migration guide](./migration-from-v4.md) and
[upgrade guide](../upgradeGuide.md) before applying current patterns. Do not
silently upgrade dependencies to make an example fit.

## Read for the task

Use the task table directly. The [compact framework reference](./compact-reference.md)
provides an overview when the task spans unfamiliar contracts; it is not a
prerequisite for reading a specific guide.

<!-- task-routes:start -->
| Task | Start here | Verify |
| --- | --- | --- |
| Compose an application or paginated feed | [Complete feature composition](./application-composition.md#a-complete-paginated-feature) | Readiness, child events, data authority, and cleanup through the actual owner. |
| Build a first screen | [Quick start](./quick-start.md) | Mount, select a row, update the display, and destroy the owner. |
| Start a new project | [Development starter](./development.md) | Typecheck, lint, test, build, and exercise the browser interaction. |
| Edit and save a form | [Forms](./forms-and-accessibility.md) | Retain input identity and focus through edits, revert, save, failure, and late completion. |
| Render a changing list | [Interactive lists](./list-composition.md) | Stable item identity, correct ordering, removal cleanup, and preservation of surviving edits. |
| Show or update a piece of UI | [Rendering](./view.rendering.md) | The intended content changes; unrelated edits and handlers survive. |
| Replace part of a screen | [Region](./marionette.region.md) | The outgoing View is cleaned up and the new View owns the intended mount. |
| Navigate between screens | [Routing](./routing.md) | Direct URLs, startup failure, stale navigation, focus, and destruction. |
| Own asynchronous feature work | [Feature effects](./application-effects.md) | Activation, cancellation, stop permission, and cleanup. |
| Refresh data without restarting a feature | [Feature refresh](./application-refresh.md) | Preserve the shell and drafts while superseding requests. |
| Choose an integration | [Choosing integrations](./choosing-integrations.md) | Preserve compatible application choices; configure each capability independently. |
| Host a screen in another framework | [Host a Marionette screen](./hosting-views.md) | Managed attachment, one DOM owner, stable drafts, and cleanup before host removal. |
| Add local or shared state | [State sources](./marionette.state.md) | The correct observer updates; destroying a borrower does not dispose shared state. |
| Handle DOM or child events | [DOM interactions](./dom.interactions.md), [child events](./events.md#child-view-events) | Correct arguments, one response per interaction, and no response after teardown. |
| Own a widget or subscription | [Resource cleanup](./resource-cleanup.md), [widget recipes](./task-recipes.md) | Rerender, detach/reattach, replacement, and final cleanup. |
| Diagnose a framework error | [Troubleshooting](./troubleshooting.md) | Reproduce the invariant by diagnostic code through public APIs. |
| Migrate from v4 | [Migration setup](./agent-tools.md#inspect-a-target-release-before-migrating), [upgrade guide](../upgradeGuide.md) | Keep the current and target artifacts distinct; preserve existing application behavior. |
<!-- task-routes:end -->

Read one starting page, then follow references that resolve an actual question.
Once the imports, setup, update path, and cleanup are clear, implement and run a
small public interaction check. Use its result to decide what to read next.
Do not read every linked reference or inspect the distribution source as a
prerequisite to building a screen. For an uncertain signature, search the matching
API page and installed declarations first.

Reuse the installed package and integration facts already established in the
application instructions. Recheck them when dependencies, configuration, or the
workspace change; record new decisions with the
[application instruction template](./application-agent-template.md).

## Choose the smallest complete owner

Use [application composition](./application-composition.md) to choose readiness,
data, event, and cleanup owners. The code in a task recipe should preserve those
ownership contracts when composed into a larger application.

Keep the application's established integrations unless the task requires changing
them. For new code, use native DOM APIs and function templates. Choose data by the
application's update requirements: plain objects/arrays for snapshots and an
observable provider for shared or independently changing records.

Choose data, state, rendering, and DOM capabilities independently. Follow the
[integration decision order](./choosing-integrations.md) before writing a custom
adapter. Record the chosen provider and its registration point once in the
application's own architecture notes so later agents do not choose again.

Use a View for interface ownership, a Region for placement, and a CollectionView
for repeated children when items need independent ownership. Use an Application
when work has a feature lifecycle: loading UI in `onBeforeStart`, asynchronous
readiness in `prepareStart`, and resolved presentation in `onStart`. A plain function or class is enough when it needs none of these
contracts. The [class guide](./classes.md) explains the boundaries.

Before expanding a small example into an application, revisit its data and ownership
choices. Use manually managed children only for independently supplied Views; use a
collection for changing domain records. Domain records belong in a data source;
CollectionView children are their presentation. Do not use child View traversal as
the application's record store. Plain arrays can remain appropriate for explicit
snapshot updates. When records need shared observation, filtering, and coordinated
updates, select an observable provider; for a new application without one, start
with `@mnjs/data` and its [DataApi setup](./data.api.md). Native Collection
`toArray()` returns plain attributes; iteration yields Models. Do not assume
Backbone/Underscore methods.

Native DOM defaults describe the integration, not a replacement for View composition.
Render ordinary content through `template` and `templateContext`, place child Views
through named Regions, and declare controls with `ui`, `events`, and `triggers`.
Use `events` when the handler needs input or keyboard details; use `triggers` when
an interaction should become a View event. Targeted updates to a View's own named UI elements are appropriate for status,
input values, and focus without replacing editable DOM. Keep measurements,
external animations, and widgets with their owning View as well. Applications
call View presentation methods rather than manipulating their descendants.

Observe each field used by a template or derived display, including changes that
do not come from its main button. Let CollectionView handle membership changes
without a second whole-list render subscription. Keep focused editors stable
when processing their own input.

When building teaching examples, make the application runnable independently of
narration and inspection. Prefer ordinary modules with explicit imports and exports.
Check that the preview supports the selected packages and module structure; a tiny
sandbox's restrictions should not silently become the recommended app architecture.

For personalized applications, connect a real user preference to interaction and
visual design. Preserve readable hierarchy, spacing, contrast, labels, and narrow
layouts; inspect the rendered result at desktop and narrow widths when changing
visuals. Do not collapse independent owners to meet a line count or include
teaching/test controls in the app. The website's optional personal-app brief supplies
its own starter; it does not authorize browsing private sources for personalization.

Configure the selected runtime before creating its consumers. The default named
exports share a runtime. Use [runtime isolation](./runtime-isolation.md) when
independent configurations must coexist; do not create a runtime per View.

## Make ownership and cancellation explicit

For each resource, name the owner and the operation that releases it. Let the
owning Region or CollectionView manage its child Views through public APIs.
Use [View lifecycle hooks](./view.lifecycle.md) for external listeners, timers,
and widgets according to their actual render, attachment, and destruction lifetime.
A rerender must not accumulate resources; destroying a View must not leave them
running.

A supplied `state` source is borrowed. A `createState()` result is owned and uses
the configured StateApi's optional disposal hook when its owner is destroyed.
Marionette does not infer ownership from which object first reads a source.

Await Application lifecycle operations when later work depends on their result.
They return `Promise<boolean>`: `true` means the target state was reached; `false`
means the request was superseded. A current readiness failure rejects. Keep those
outcomes distinct. Constructor hooks run synchronously, and completion hooks are synchronous
notifications; returning a Promise from them does not add readiness.

Pass the preparation method's signal to cancellable work. After an asynchronous step,
check that it still belongs to the active operation before committing application
side effects. Marionette suppresses stale lifecycle completion; it cannot undo an
arbitrary write made by application code. Follow the complete
[routing pattern](./routing.md) for navigation and feature startup.

Keep an Application's active lifetime separate from each data request. If list
results share a shell with an editor, refresh the list's collection and cancel
superseded requests; restarting the parent destroys both UI trees. See the [complete feed example](./application-composition.md#a-complete-paginated-feature).

## Completion evidence

Use the application's existing test runner, scripts, and package manager. Library
maintenance commands are not a consumer project's test strategy.

The requested behavior is complete when its interaction and affected ownership
boundary work in the installed application. For an
asynchronous screen, navigate away while work is pending and ensure its stale
result cannot replace the current screen. For a list, edit a surviving row while
inserting, removing, or reordering another row. For a subscription, destroy one
consumer and confirm the remaining consumer still receives updates.

Use a real browser when correctness depends on focus, attachment, DOM event
propagation, or editable state. A build or screenshot alone does not prove those
interactions. Use documented public APIs for assertions rather than private
framework fields.

Review the architecture separately from interaction results: identify the data
source, the Views and Regions that own the screen, and the external work each owner
releases. Working buttons do not establish that the example teaches those contracts.
For observable data, change the source directly and verify all intended consumers
update. For attachment-bound resources, also detach and reattach the same View;
replacement alone does not prove that repeated attachment releases resources.

When reporting a change, name the behavior, the tested package/source, the exact
commands or interactions performed, and any untested boundary. Keep changes
focused and avoid introducing runtime instrumentation merely to help an agent
understand the code.

## Retrieve the matching contract

[Read documentation for a task](./agent-retrieval.md) covers direct local lookup,
section search, and optional MCP retrieval. [Agent setup](./agent-tools.md) covers
one-time client installation. No hosted service is required.

Keep application decisions in the [application instruction template](./application-agent-template.md),
not a copy of the framework reference or maintainer policy.
