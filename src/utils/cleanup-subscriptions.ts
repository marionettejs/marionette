// Attempt every owned cleanup, preserving the first failure for the caller.
export default function cleanupSubscriptions(cleanups: readonly ((() => unknown) | undefined)[]) {
  let failed = false;
  let firstError: unknown;

  for (const cleanup of cleanups) {
    try {
      cleanup?.();
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  }

  if (failed) { throw firstError; }
}
