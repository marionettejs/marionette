import { reduce, keys } from 'underscore';

// Regular expression used to split event strings.
export const eventSplitter = /\s+/;

// Iterates over the standard `event, callback` (as well as the fancy multiple
// space-separated events `"change blur", callback` and jQuery-style event
// maps `{event: callback}`).
export default function buildEventArgs(name, callback, context, listener) {
  if (name && typeof name === 'object') {
    return reduce(keys(name), (eventArgs, key) => {
      return eventArgs.concat(buildEventArgs(key, name[key], context || callback, listener));
    }, []);
  }

  if (name && eventSplitter.test(name)) {
    return reduce(name.split(eventSplitter), (eventArgs, n) => {
      eventArgs.push({ name: n, callback, context, listener });
      return eventArgs;
    }, []);
  }

  return [{ name, callback, context, listener }];
}
