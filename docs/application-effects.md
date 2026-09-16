# Own effects explicitly

Application `stateEvents`, `radioEvents`, `radioRequests`, and ordinary `listenTo`
bindings have object lifetime. Stop does not remove them; destroy releases the
framework-owned subscriptions. Use them for deliberately persistent behavior.

For a restartable feature, give subscriptions and asynchronous work an explicit
owner. The following application module uses one small effects scope. It is
application code, not a Marionette export or a new framework lifecycle.

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
also disposes effects. A readiness `signal` cancels only its pending phase; it is
not a signal for the entire subsequent run. The scope below owns that longer
lifetime and passes its signal to the loader. Every awaited continuation checks
cancellation before committing its result, including providers that ignore abort.

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
