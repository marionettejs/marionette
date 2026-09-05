type Disposer = (() => unknown) | false | null | undefined | 0 | 0n | '';

export default function disposeAll(disposers: readonly Disposer[], error: unknown): never;
export default function disposeAll(disposers: readonly Disposer[]): void;
export default function disposeAll(disposers: readonly Disposer[], error?: unknown): void {
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
