// Unbind before invoking the callback, and return its saved result on later calls.
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
