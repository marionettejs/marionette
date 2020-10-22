import { once } from 'underscore';

// Wrap callback in a once. Returns for requests
// `offCallback` unbinds the `onceWrapper` after it has been called.
export default function onceWrap(callback, offCallback) {
  const onceCallback = once(function() {
    offCallback(onceCallback);
    return callback.apply(this, arguments);
  });

  onceCallback._callback = callback;

  return onceCallback;
}
