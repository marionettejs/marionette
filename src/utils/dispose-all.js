export default function disposeAll(disposers, error) {
  let hasError = arguments.length > 1;

  // Dispose in reverse registration order.
  for (let index = disposers.length; index--;) {
    const disposer = disposers[index];
    try {
      disposer && disposer();
    } catch (disposalError) {
      if (!hasError) {
        error = disposalError;
        hasError = true;
      }
    }
  }

  if (hasError) { throw error; }
}
