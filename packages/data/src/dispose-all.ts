export default function disposeAll(disposers: ReadonlyArray<(() => unknown) | null | undefined>, error?: unknown) {
  let hasError = arguments.length > 1;

  for (let index = disposers.length; index--;) {
    try {
      disposers[index]?.();
    } catch (disposalError) {
      if (!hasError) {
        error = disposalError;
        hasError = true;
      }
    }
  }

  if (hasError) { throw error; }
}
