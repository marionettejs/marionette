import { Application } from 'marionette';

export function createReviewSession({ state, load, validate, beforeStop, subscribe, schedule, onPulse }) {
  let pending;
  let active = false;
  let releaseSubscription;
  let releaseTimer;

  const cancel = () => { pending?.abort(); pending = undefined; };
  async function request(id, signal) {
    cancel();
    const controller = new AbortController();
    pending = controller;
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { controller.abort(); }
    try {
      const value = await load(id, { signal: controller.signal });
      if (controller.signal.aborted) { return false; }
      await validate(value, { signal: controller.signal });
      if (controller.signal.aborted) { return false; }
      state.set('label', value);
      return true;
    } catch (error) {
      if (controller.signal.aborted) { return false; }
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (pending === controller) { pending = undefined; }
    }
  }
  const release = () => {
    active = false;
    cancel();
    releaseSubscription?.();
    releaseSubscription = undefined;
    releaseTimer?.();
    releaseTimer = undefined;
  };
  const Session = Application.extend({
    prepareStart({ id }, { signal }) { return request(id, signal); },
    onStart() {
      active = true;
      releaseSubscription = subscribe(status => state.set('status', status));
      releaseTimer = schedule(onPulse);
    },
    prepareStop(options, context) { return beforeStop(options, context); },
    onStop: release,
    onDestroy: release
  });
  Session.setStateApi({ disposeOwned(source) { source.dispose(); } });
  const app = new Session({ state });
  app.getState();
  return {
    app,
    refresh(id) { return active ? request(id) : Promise.resolve(false); },
    edit(draft) { state.set('draft', draft); }
  };
}
