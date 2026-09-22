# Own effects explicitly

Application `stateEvents` deliver during the active run, following `isRunning()`.
Seed state before activation and read its current value in `onStart`; pending stop
permission for stop/restart leaves delivery active until stopping succeeds.
Terminal destruction deactivates delivery immediately. Subscriptions themselves
remain installed until destruction, and suppressed notifications are not replayed.

`radioEvents`, `radioRequests`, and ordinary `listenTo` bindings have object
lifetime. Stop does not remove them; destroy releases the framework-owned
subscriptions. Use explicit listeners for deliberately persistent state behavior.

For a restartable feature, give subscriptions and asynchronous work an explicit
owner. Start with the lifetime and completion guidance below. The later effects
scope example is application code for additional resources, not a Marionette
export or a new framework lifecycle.

## Choose the lifetime first

| Lifetime | Owner and boundary | Canonical contract |
| --- | --- | --- |
| Application object | Survives stop/restart; retains its state source and ordinary `listenTo`/`bindEvents` and Radio bindings until explicit cleanup or destroy. | [Subscriptions](./marionette.application.md#subscription-lifetime-across-stop-and-restart), [state ownership](./marionette.state.md#borrowed-and-owned-sources) |
| Active run | Configured Application `stateEvents` deliver during the run; this does not cancel requests or clean up other resources. | [Application state](./marionette.application.md#application-state) |
| Preparation phase | The supplied signal tracks that pending lifecycle phase, not the later run. | [Preparation](./marionette.application.md#preparation-methods-and-notifications) |
| Individual request | Its initiating screen/request owns permission to apply the result, even if persistence outlives that screen. | [Completion below](#allow-persistence-without-late-ui-effects), [replacement requests](./application-refresh.md) |

Restart retains the Application and its state; it does not reset the source to its
initial values. Read current state when composing the next screen. Use the public
lifecycle and View ownership first; the effects helper below is only needed for
resources whose lifetime is not already owned by those APIs.

## Allow persistence without late UI effects

Use this pattern when a save should finish after navigation away. The service owns
persistence; the initiating Application root owns completion UI. Supply
`saveRecord(value)` and synchronous `navigate(saved)` functions. This method is
called while the feature is running. It returns `true` only when the save succeeds
and its current screen applies success UI and navigation. A failure shows an error
on the current screen and returns `false`; an obsolete completion returns `false`
without updating UI. It handles late rejection too. Keep navigation out of the
persistence service.

<!-- executable-example: application-save-completion -->
```javascript
import { Application, View } from 'marionette';

const Editor = View.extend({
  template: () => '<p role="status">Ready</p>',
  showStatus(message) { this.el.querySelector('[role="status"]').textContent = message; }
});

export function createEditor({ el, saveRecord, navigate }) {
  const Feature = Application.extend({
    onStart() { this.showView(new Editor()); },
    async save(value) {
      const screen = this.getView();
      if (!this.isRunning() || !screen || screen.isDestroyed()) { return false; }
      const request = {};
      this.latestSave = request;
      const isCurrent = () => this.latestSave === request && this.isRunning() &&
        this.getView() === screen && !screen.isDestroyed();
      try {
        const saved = await saveRecord(value);
        if (!isCurrent()) { return false; }
        screen.showStatus('Saved');
        navigate(saved);
        return true;
      } catch {
        if (!isCurrent()) { return false; }
        screen.showStatus('Could not save');
        return false;
      }
    }
  });
  return new Feature({ region: { el } });
}
```

Stopping destroys the owned root. Restart creates a different root, so a late save
cannot update it even if `isRunning()` is true again. Replacing the displayed root
also invalidates completion without requiring an Application stop. Request identity
handles overlapping saves on the same screen; it does not serialize server writes.
During pending stop permission the run and its screen remain active, so this policy
still permits completion; a rejected stop keeps that screen usable. If the product
must freeze interaction earlier, define that policy explicitly.

For cancellation of the work itself, see the [form example](./forms-and-accessibility.md#save-without-replacing-the-users-input).
Neither canceling a client request nor suppressing its completion proves that a
server write was rolled back. The [installed completion checks](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-application-guides/completion.mjs)
execute this example and the loading shell against packed packages.

## Choose when effects end

This example activates effects during startup so loading-time state and Radio
notifications can be observed. Initial state is seeded before subscriptions.
`onStart` reads the current state instead of replaying notifications.

Effects remain active while asynchronous stop permission is pending. Successful
stop disposes them in `onStop`. Rejected stop permission leaves them intact, so no missed
notifications need to be replayed. If pending stop must freeze interaction, disable
that feature's controls while asking permission; do not silently discard source
changes. Starting from stopped creates a fresh scope.

Canceling pending startup or rejecting its loader disposes the scope immediately.
Terminal destruction
also disposes effects. A `prepareStart` signal covers only pending startup; it is
not a signal for the entire subsequent run. The scope below owns that longer
lifetime and passes its signal to the loader. Every awaited continuation checks
cancellation before committing its result, including providers that ignore abort.

## Recheck cancellation after awaited work

A `prepareStart` signal belongs to its pending startup phase. Read
`signal.aborted` after each awaited step before doing more work or committing its
result. Capturing `const canceled = signal.aborted` before an await only records
its earlier value. Checking `isRunning()` instead is also insufficient: a newer
start may be running when an older request finally resolves.

Stop preparation has different ownership: a replacement operation can adopt an
in-flight `prepareStop` phase, retaining its original options and context without
aborting its signal. The original caller's Promise resolving `false` does not mean
that adopted work was canceled. See
[preparation methods and notifications](./marionette.application.md#preparation-methods-and-notifications).

This example loads and validates a value before committing it. Supply asynchronous
`load({ signal })` and `validate(value, { signal })` functions and a synchronous
`commit(value)` function. The checks protect the commit even when a provider ignores
abort. They do not force that provider's Promise to settle or undo its own effects.

<!-- executable-example: application-preparation-commit -->
```javascript
import { Application } from 'marionette';

export function createPreparedFeature({ load, validate, commit }) {
  const Feature = Application.extend({
    async prepareStart(options, { signal }) {
      const value = await load({ signal });
      if (signal.aborted) { return; }
      await validate(value, { signal });
      if (signal.aborted) { return; }
      commit(value);
    }
  });
  return new Feature();
}
```

If stop cancels startup while validation is pending, resolving validation later
must not call `commit`. The second check is necessary even though the first check
passed. Likewise, a newer successful start cannot authorize the old operation's
commit. Use [latest-request ownership](./application-refresh.md#share-one-latest-request-controller)
for independently replaceable refresh requests during an active run.
The [installed preparation checks](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-application-guides/preparation.mjs)
exercise successful commit, canceled loading, and old validation completing after
a newer successful start.

## Distinguish delivery from resource cleanup

Configured `stateEvents` gate delivery; they do not unsubscribe on stop or cancel
work a handler already started. `isRunning()` stays true during pending stop
permission, but a later run can also be active when an older request finishes.
Use operation signals or a latest-request owner to prevent stale commits.

Use the explicit scope below for effects that observe loading-time changes or own
timers, requests, and other resources. Disposing them in `onBeforeStop` would end
them before permission is decided; disposal belongs in `onStop` for this policy.

Successful `prepareStart` does not give its signal the lifetime of the subsequent
active run. Register active resources with their own scope and dispose that scope
on successful stop and terminal destruction. The executable example below and its
[installed checks](https://github.com/marionettejs/marionette/blob/master/test/fixtures/docs-application-guides/effects.mjs)
already cover rejected stop permission and successful timer cleanup.

## Work started after activation

An async action called from `onStart`, a state handler, or a user event is not part
of `prepareStart` readiness. Handle its rejection at the action's owner and check
whether its result still belongs to the current work before updating the UI.
There are two separate questions:

- Does this request still belong to the active run? A later run may make
  `isRunning()` true again, so that boolean alone cannot identify the request's run.
- Has a newer request replaced it within the same run? A run-scoped signal alone
  does not establish latest-request-wins ordering.

Use the [latest-request example](./application-refresh.md#share-one-latest-request-controller)
for replaceable reads, with disposal tied to the feature's chosen lifetime.
Ignoring an obsolete result or aborting a request does not undo a write already
performed by a provider. Save and discard actions need an explicit mutation policy;
do not assume the same replacement policy is appropriate for them.

An owned child Application is useful when the work belongs to a feature with its
own activation and cleanup, with state or UI where needed. Put its initial readiness in
its `prepareStart` and render its prepared result in `onStart`. A child per Promise
does not automatically solve request ordering. Even when startup belongs to an
existing child, a parent's asynchronous failure handler must still check that the
failure is relevant to the parent's current context.

## A complete feature

Save this module as `status-feature.js`. Supply an element, an `@mnjs/data` Model,
a Radio channel dedicated to this feature, and `load({ signal })` returning
`{ label }`. `beforeStop(options, { signal })` may await a permission decision and
reject to keep the feature running. Its own asynchronous work must honor cancellation.

When several features need the same scope, move `createEffects` into one shared
application module and import it in those features. Keep one implementation and
one set of scope tests; each feature chooses when to create and dispose its own
scope through its lifecycle hooks.

The initial request fetches metadata independent of the filter. Reading the latest
filter after loading is correct here. A server request that captures a filter needs
a separate refresh operation that owns replacement requests; see
[refresh without restarting](./application-refresh.md).
Do not map filter changes to `restart` to implement latest-request-wins behavior.

<!-- executable-example: application-active-effects -->
```javascript
import { Application, View } from 'marionette';

export function createEffects() {
  const controller = new AbortController();
  const cleanups = [];
  return {
    signal: controller.signal,
    add(cleanup) {
      if (controller.signal.aborted) { cleanup(); }
      else { cleanups.push(cleanup); }
    },
    dispose() {
      if (controller.signal.aborted) { return; }
      controller.abort();
      for (const cleanup of cleanups.splice(0).reverse()) { cleanup(); }
    }
  };
}

const StatusView = View.extend({
  template: false,
  update(label, filter) { this.el.textContent = `${label}: ${filter}`; }
});

// load reads feature metadata, independently of the current filter.
export function createStatusFeature({ el, state, channel, load, beforeStop = async() => {}, tick = () => {} }) {
  const Feature = Application.extend({
    updateDisplay() {
      this.getView()?.update(this.label, this.getState().get('filter'));
    },
    async prepareStart(options, { signal }) {
      this.effects?.dispose();
      // Seed before subscribing. The source is borrowed and survives each run.
      if (state.get('filter') === undefined) { state.set('filter', 'open'); }
      const effects = createEffects();
      this.effects = effects;
      const cancel = () => effects.dispose();
      signal.addEventListener('abort', cancel, { once: true });
      this.releaseReadiness = () => signal.removeEventListener('abort', cancel);
      effects.add(this.releaseReadiness);

      const update = () => this.updateDisplay();
      state.on('change:filter', update);
      effects.add(() => state.off('change:filter', update));
      channel.on('refresh:display', update);
      effects.add(() => channel.off('refresh:display', update));
      const currentFilter = () => state.get('filter');
      channel.reply('current:filter', currentFilter);
      effects.add(() => channel.stopReplying('current:filter', currentFilter));
      const interval = setInterval(tick, 1000);
      effects.add(() => clearInterval(interval));

      try {
        const metadata = await load({ signal: effects.signal });
        if (effects.signal.aborted) { return; }
        this.label = metadata.label;
      } catch (error) {
        const canceled = effects.signal.aborted;
        effects.dispose();
        if (!canceled) { throw error; }
      }
    },
    onStart() {
      // Successful readiness ends; the effect scope continues until deactivation.
      this.releaseReadiness();
      this.showView(new StatusView());
      this.updateDisplay();
    },
    prepareStop(options, context) {
      // A rejected permission leaves the running feature and its effects intact.
      return beforeStop(options, context);
    },
    onStop() { this.effects?.dispose(); },
    onBeforeDestroy() { this.effects?.dispose(); }
  });
  return new Feature({ region: { el }, state });
}
```

Call and await the returned Application's `start`, `stop`, `restart`, and `destroy`
methods normally. The hooks also run when an owning Application stops or destroys
this feature. No wrapper must intercept those calls. `updateDisplay` uses a public
View method and reads state at the time of display; the borrowed Model is never
recreated or disposed by this example.

The dedicated Radio channel has one owner for `current:filter`. Disposal removes
only this scope's callbacks, preserving independent observers. The interval and
its work are synchronous; an asynchronous tick would need its own rejection and
cancellation handling. Resources acquired after disposal are released immediately
when added to the scope.

Cleanup follows the [synchronous failure contract](./view.lifecycle.md#synchronous-failures):
registration, rendering, and cleanup callbacks must work. Synchronous setup or
`onStart` failures have no automatic rollback; destroy the feature to release
its effect scope. A throwing cleanup in `onStop` rejects the operation after
its stopped state has committed; later cleanups need not run, and another dispose
call does not retry them. This helper does not promise recovery. It also does not make
asynchronous `onStart` work part of readiness.

No production-library import, subscription wrapper, per-instance allocation, or
runtime registry is added by this documentation pattern. Only applications that
copy and use the helper pay for its controller and registered cleanup callbacks.
