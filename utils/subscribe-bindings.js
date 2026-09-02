import buildEventArgs from './build-event-args.js';
import disposeAll from './dispose-all.js';
import MarionetteError from './error.js';
import { normalizeBindings } from '../modules/common/bind-events.js';

export function normalizeDisposer(disposer, methodName) {
  if (typeof disposer !== 'function') {
    throw new MarionetteError({
      code: 'MN0038',
      name: 'AdapterError',
      message: `${ methodName }() must return a cleanup function.`,
      url: 'data.api.html#adapter-cleanup'
    });
  }

  let isDisposed = false;
  return function() {
    if (isDisposed) { return; }
    isDisposed = true;
    disposer();
  };
}

export default function subscribeBindings(context, Api, source, bindings, apiName) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context);
  const subscriptions = [];

  try {
    for (let index = 0; index < eventArgs.length; index++) {
      const { name, callback, context: eventContext } = eventArgs[index];
      const disposer = Api.subscribe(source, name, callback, eventContext);
      subscriptions.push(normalizeDisposer(disposer, `${ apiName }.subscribe`));
    }
  } catch (error) {
    disposeAll(subscriptions, error);
  }

  let isDisposed = false;
  return function() {
    if (isDisposed) { return; }
    isDisposed = true;
    disposeAll(subscriptions);
  };
}
