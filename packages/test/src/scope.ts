/** Returned values are ignored; returned promises are awaited. */
export type Cleanup = () => unknown;
export interface Cleanable {
  cleanup(): unknown;
}

export interface TestScope extends Cleanable {
  defer(cleanup: Cleanup): void;
  own<Resource extends Cleanable>(resource: Resource): Resource;
  cleanup(): Promise<void>;
}

// This scope knows only its explicitly registered callbacks, never global resources.
export function createTestScope(): TestScope {
  const callbacks: Cleanup[] = [];
  let completion: Promise<void> | undefined;

  function defer(cleanup: Cleanup) {
    if (completion) { throw new Error('Cannot register cleanup after scope cleanup begins.'); }
    callbacks.push(cleanup);
  }

  async function dispose() {
    const errors: unknown[] = [];
    while (callbacks.length) {
      try { await callbacks.pop()!(); } catch (error) { errors.push(error); }
    }
    if (errors.length) { throw new AggregateError(errors, 'Test scope cleanup failed.'); }
  }

  return {
    defer,
    own(resource) {
      defer(() => resource.cleanup());
      return resource;
    },
    cleanup() {
      if (!completion) {
        const pending = Promise.withResolvers<void>();
        // Publish completion first; start the first disposer in this turn so
        // Application cancellation cannot lose a race to preparation completion.
        completion = pending.promise;
        dispose().then(pending.resolve, pending.reject);
      }
      return completion;
    }
  };
}
