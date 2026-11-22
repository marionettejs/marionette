import { cloneAny } from '@formkit/utils';

// Application-owned stores and dispatch remain outside this controller. Each
// request reads current values only after Core and captured facts have settled.
export function createValueProjection(view, options) {
  const read = options?.read, report = options?.onError, source = options?.source, merge = options?.merge;
  if (typeof read !== 'function') { throw new TypeError('createValueProjection requires read().'); }
  if (report !== undefined && typeof report !== 'function') { throw new TypeError('createValueProjection requires a function onError.'); }
  const abort = new AbortController();
  const retired = new DOMException('FormKit value projection ended.', 'AbortError');
  let disposed = false, revision = 0, pending;
  const dispose = () => {
    if (disposed) { return; } disposed = true;
    view.off('before:destroy', dispose); abort.abort(retired);
  };
  if (view._ending || view.isDestroyed()) { disposed = true; } else { view.on('before:destroy', dispose); }
  const current = own => {
    if (disposed || view.isDestroyed()) { throw retired; }
    return own === revision;
  };
  // An explicit reporter owns fire-and-forget rejection notification, including
  // cancellation. Awaiting the returned operation still receives its rejection.
  const result = task => {
    if (report) { void task.catch(() => {}); }
    return task;
  };
  const request = () => {
    if (disposed || view.isDestroyed()) { return result(Promise.reject(retired)); }
    revision++;
    if (pending) { return pending; }
    // Defer execution so synchronous fence/read failures cannot leave a rejected
    // promise installed as the next request's permanent state.
    const task = Promise.resolve().then(async() => {
      try {
        for (;;) {
          await view.whenPendingEditsSettled({ signal: abort.signal });
          const own = revision;
          if (!current(own)) { continue; }
          const values = cloneAny(Reflect.apply(read, options, []));
          if (!current(own)) { continue; }
          view.setValues(values, { notify: false, source, merge });
          if (current(own)) { return; }
        }
      } catch (error) {
        if (!disposed && report) {
          try { Reflect.apply(report, undefined, [error]); } catch {
            // Reporting cannot replace the rejected operation's original error.
          }
        }
        throw error;
      } finally { if (pending === task) { pending = undefined; } }
    });
    pending = task;
    return result(task);
  };
  return { request, flush: request, dispose, get disposed() { return disposed || view.isDestroyed(); } };
}
