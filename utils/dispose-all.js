export default function disposeAll(disposers, error) {
  let hasError = arguments.length > 1;

  for (let index = disposers.length - 1; index >= 0; index--) {
    try {
      disposers[index] && disposers[index]();
    } catch (disposalError) {
      if (!hasError) {
        error = disposalError;
        hasError = true;
      }
    }
  }

  if (hasError) { throw error; }
}
