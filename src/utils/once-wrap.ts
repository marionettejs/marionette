// Unbind before invoking the callback, and return its saved result on later calls.
type OnceCallback<Context, Args extends unknown[], Result> =
  ((this: Context, ...args: Args) => Result | undefined) & {
    _callback: (this: Context, ...args: Args) => Result;
  };

export default function onceWrap<Context, Args extends unknown[], Result>(
  callback: (this: Context, ...args: Args) => Result,
  offCallback: (callback: OnceCallback<Context, Args, Result>) => unknown
): OnceCallback<Context, Args, Result> {
  let called = false;
  let result: Result | undefined;

  function onceCallback(this: Context) {
    if (called) {
      return result;
    }

    called = true;
    offCallback(onceCallback);
    result = callback.apply(this, arguments as unknown as Args);
    return result;
  }

  onceCallback._callback = callback;

  return onceCallback;
}
