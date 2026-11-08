# Local requests, stale results and retries

An ordinary local request can stay in its View. Application preparation coordinates startup, but later requests need their own result-ordering policy. Here a disposable preview owns its current request; the result changes only that View. Use the configured renderer/data layer in an existing project.

## Latest response wins

Copy primitive request inputs before starting work. Advance an owner-local revision for each request and on teardown; check it after awaiting before changing state or UI. Abort is an optional transport optimization, not the result-suppression mechanism: a service may ignore the signal or have already completed.

```js
import { View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const Preview = View.extend({
  initialize() { this.revision = 0; },
  templateContext() { return { title: this.title || 'Choose an item', status: this.status || '' }; },
  template: ({ title, status }) => html`<h2>${title}</h2><p role="status">${status}</p>`,
  async load(input) {
    if (this.isDestroyed()) { return false; }
    const request = Object.freeze({ id: String(input.id), language: String(input.language) });
    const revision = ++this.revision;
    this.controller?.abort();
    const controller = this.controller = new AbortController();
    this.status = 'Loading…';
    this.render();
    try {
      const result = await this.getOption('loadPreview')(request, { signal: controller.signal });
      if (this.isDestroyed() || revision !== this.revision) { return false; }
      this.title = result.title;
      this.status = 'Ready';
      this.render();
      return true;
    } catch (error) {
      if (this.isDestroyed() || revision !== this.revision) { return false; }
      this.status = 'Could not load. Try again.';
      this.render();
      throw error;
    } finally {
      if (this.controller === controller) { this.controller = undefined; }
    }
  },
  onBeforeDestroy() {
    ++this.revision;
    this.controller?.abort();
  }
}).setDomApi(LitDomApi);
```

Construct with `new Preview({ loadPreview })`, where the service returns a Promise for the preview data and may pass `signal` to fetch. Callers handle a current rejection with `try/catch` around `await preview.load(input)` or a rejection handler. DOM delegation does not await handler Promises: capture input/`delegateTarget` metadata synchronously, then attach a rejection handler to the task; `void preview.load(input)` alone does not handle failure. Stale success/failure resolves `false` without rendering. A new request captures new values; mutating an old input object does not change its request. For nested values, create an appropriate immutable snapshot too. Guard each additional awaited step before effects. A shared source or operation that must survive this View needs a surviving owner instead; do not reuse a startup signal as a permanent lifetime signal.

## Failed-promise cache policy belongs to the service

This minimal service cache shares reads by key, retaining successes until explicit invalidation. Choose keys, freshness and capacity for the actual service. A rejected promise must not poison later retries, and an obsolete rejection must not remove a newer entry for the same key.

```js
function createReadCache(load) {
  const entries = new Map();
  return {
    read(key) {
      if (entries.has(key)) { return entries.get(key); }
      const pending = Promise.resolve().then(() => load(key)).catch(error => {
        if (entries.get(key) === pending) { entries.delete(key); }
        throw error;
      });
      entries.set(key, pending);
      return pending;
    },
    invalidate(key) { entries.delete(key); }
  };
}
```

For example, supply a loader that fetches and validates the response before returning decoded data; its failures propagate to the caller. `invalidate(key)` permits a new read even while an older request is pending. The identity check protects that newer promise if the old one rejects. This cache does not abort shared work when one consumer leaves. Do not couple a shared cached promise to one disposable View's abort controller unless the service explicitly owns that cancellation policy. Private uncached requests can use the View's signal directly.

The examples test reversed completion, current/stale rejection, retry and destruction while pending independently of transport abortion. Continue with [composition](composition.md), [View lifetime](../api/view.md#lifecycle-hooks-and-events) and [readiness/ongoing effects](../api/application.md#readiness-and-ongoing-effects) for the corresponding ownership boundaries.
