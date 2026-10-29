import { createMountContext } from './context.ts';
import type { TestMounts } from './context.ts';
import type { MountOptions } from './index.ts';

// Serialize disposal, while letting teardown interrupt pending Application readiness.
export function createMountSession() {
  let current: TestMounts | undefined;
  let pending: Promise<void> | undefined;
  let generation = 0;
  function cleanup() {
    generation++;
    const previous = current;
    current = undefined;
    if (previous) {
      const completion = Promise.withResolvers<void>();
      // A View's destroy callback may call unmount again before cleanup returns.
      pending = completion.promise;
      const clear = () => { pending = undefined; };
      pending.then(clear, clear);
      previous.cleanup().then(completion.resolve, completion.reject);
    }
    return pending ?? Promise.resolve();
  }
  return {
    cleanup,
    owns(context: TestMounts) { return current === context; },
    async replace(options: MountOptions) {
      const disposal = cleanup();
      const expected = generation;
      await disposal;
      if (generation !== expected) { throw new Error('Mount was replaced or cleaned up before setup completed.'); }
      current = createMountContext(options);
      return current;
    }
  };
}
