# Build with Marionette

Use this guide when an agent is building or maintaining an application with
Marionette. It links each decision to the same contracts a human reviewer uses.
For changes to Marionette itself, use the [maintainer guide](https://github.com/marionettejs/marionette/blob/master/docs/maintainers/readme.md).

## Establish the installed contract

Before choosing an API, inspect the application's package manifest, lockfile,
installed declarations, and existing Marionette configuration. Record:

- the installed `marionette` version and matching optional package versions;
- whether the dependency comes from a published package, Git commit, or local build;
- the source revision for a checkout or custom artifact;
- the selected renderer, data/state sources, DOM integrations, and router.

This documentation describes the current source. An npm alpha with the same
version string may contain older code. A website example, a copied prompt, or a
third-party search result is not proof that the installed package has that API.
Match the documentation's source revision to the artifact when available, then
check the installed exports and declarations. Reproduce uncertain behavior with
a small test against that package.

For a fresh application, follow [installation](./installation.md). For a v4
application, use the [migration guide](./migration-from-v4.md) and
[upgrade guide](../upgradeGuide.md) before applying current patterns. Do not
silently upgrade dependencies to make an example fit.

## Read for the task

| Task | Start here | Verify |
| --- | --- | --- |
| Show or update a piece of UI | [View](./marionette.view.md), [rendering](./view.rendering.md) | The intended element and content change; relevant handlers still work after rendering. |
| Replace part of a screen | [Region](./marionette.region.md), [View lifecycle](./view.lifecycle.md) | The outgoing View is cleaned up and the new View owns the intended mount. |
| Render a changing list | [CollectionView](./marionette.collectionview.md), [DataApi](./data.api.md) | Stable item identity, correct ordering, removal cleanup, and preservation of surviving edits. |
| Coordinate a feature or navigate | [Application](./marionette.application.md), [routing](./routing.md) | Startup success, stale navigation, failure, stop, and destruction. |
| Choose data, state, rendering, or DOM integration | [Choosing integrations](./choosing-integrations.md) | The chosen capability matches the source; configuring one integration does not implicitly configure another. |
| Add local or shared state | [State sources](./marionette.state.md) | The correct observer updates; destroying one borrower does not dispose shared state. |
| Handle DOM or component events | [DOM interactions](./dom.interactions.md), [events](./events.md) | One intended response per interaction and no response after teardown. |
| Diagnose a framework error | [Diagnostic catalog](./diagnostic-catalog.md) | The invariant associated with the diagnostic code; do not match only error-message text. |

Read the relevant page and its direct references. Load the full documentation only
when the task requires a broader API review.

## Choose the smallest supported pattern

Keep the application's established integrations unless the task requires changing
them. For new code, start with the built-in defaults: native DOM APIs, function
templates, and plain objects or arrays. Plain sources are not observable; update
the UI explicitly or select an observable integration when the task needs one.

Choose data, state, rendering, and DOM capabilities independently. Follow the
[integration decision order](./choosing-integrations.md) before writing a custom
adapter. Record the chosen provider and its registration point once in the
application's own architecture notes so later agents do not choose again.

Use a View for interface ownership, a Region for placement, and a CollectionView
for repeated children. Use an Application when work has an asynchronous feature
lifecycle. A plain function or class is enough when it needs none of these
contracts. The [class guide](./classes.md) explains the boundaries.

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

Pass the readiness hook's signal to cancellable work. After an asynchronous step,
check that it still belongs to the active operation before committing application
side effects. Marionette suppresses stale lifecycle completion; it cannot undo an
arbitrary write made by application code. Follow the complete
[routing pattern](./routing.md) for navigation and feature startup.

## Prove the behavior in the application

Use the application's existing test runner, scripts, and package manager. Library
maintenance commands are not a consumer project's test strategy.

Test the successful interaction and the boundary most likely to break. For an
asynchronous screen, navigate away while work is pending and ensure its stale
result cannot replace the current screen. For a list, edit a surviving row while
inserting, removing, or reordering another row. For a subscription, destroy one
consumer and confirm the remaining consumer still receives updates.

Use a real browser when correctness depends on focus, attachment, DOM event
propagation, or editable state. A build or screenshot alone does not prove those
interactions. Use documented public APIs for assertions rather than private
framework fields.

When reporting a change, name the behavior, the tested package/source, the exact
commands or interactions performed, and any untested boundary. Keep changes
focused and avoid introducing runtime instrumentation merely to help an agent
understand the code.

## Use agent tools as another way to read the same docs

Follow [Set up an agent](./agent-tools.md) to install the consumer skill and read
version-matched packaged docs. Adapt the [application instruction template](./application-agent-template.md)
to preserve this project's actual decisions across tasks.

A Markdown page or versioned documentation index can be read directly. A service
such as Context7 can help locate the relevant passage, but verify its library and
version selection before using the result. When retrieval is unavailable, use the
same source documents in the repository or the matching documentation artifact.

A documentation index does not install instructions into every agent. An
application's own agent instructions should link to this guide and record its
installed version and architecture choices. They should not copy this entire guide
or use this library's maintainer instructions as application policy.

Use playground tools only to examine the example they control. Their results do
not establish behavior in your application. No hosted AI service or MCP server is
required to use Marionette or follow this workflow.
