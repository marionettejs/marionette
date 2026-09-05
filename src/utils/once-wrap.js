// Wrap callback in a once. Returns for requests
// `offCallback` unbinds the `onceWrapper` after it has been called.
export default function onceWrap(callback, offCallback) {
  let called = false;
  let result;

  function onceCallback() {
    if (called) {
      return result;
    }

    called = true;
    offCallback(onceCallback);
    result = callback.apply(this, arguments);
    return result;
  }

  onceCallback._callback = callback;

  return onceCallback;
}
