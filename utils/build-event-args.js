// Regular expression used to split event strings.
export const eventSplitter = /\s+/;

// Iterates over the standard `event, callback` (as well as the fancy multiple
// space-separated events `"change blur", callback` and jQuery-style event
// maps `{event: callback}`).
export default function buildEventArgs(name, callback, context, listener) {
  if (name && typeof name === 'object') {
    const eventArgs = [];
    const names = Object.keys(name);
    for (let i = 0; i < names.length; i++) {
      const key = names[i];
      const args = buildEventArgs(key, name[key], context || callback, listener);
      for (let j = 0; j < args.length; j++) {
        eventArgs.push(args[j]);
      }
    }
    return eventArgs;
  }

  if (name && eventSplitter.test(name)) {
    const names = name.split(eventSplitter);
    const eventArgs = [];
    for (let i = 0; i < names.length; i++) {
      eventArgs.push({ name: names[i], callback, context, listener });
    }
    return eventArgs;
  }

  return [{ name, callback, context, listener }];
}
