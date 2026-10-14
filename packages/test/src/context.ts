import { createTestScope, mountApplication, mountView } from './index.ts';
import type { ApplicationMountOptions, MountOptions, MountedRegion, ViewMountOptions } from './index.ts';
import type { ApplicationInstance, RegionInstance, SupportedView } from 'marionette';

// Each runner invocation owns its mounts independently of project cleanup callbacks.
export function createMountContext(defaults: MountOptions = {}) {
  const scope = createTestScope();
  const disposers: Array<() => Promise<void>> = [];
  let closed = false;
  let completion: Promise<void> | undefined;
  function assertOpen() {
    if (closed) { throw new Error('Cannot mount after test cleanup begins.'); }
  }
  function own<Handle extends MountedRegion>(handle: Handle): Handle {
    disposers.push(handle.cleanup);
    return handle;
  }
  function cleanup() {
    if (!completion) {
      closed = true;
      const deferred = Promise.withResolvers<void>();
      // Destruction callbacks can reenter cleanup; publish its identity first.
      completion = deferred.promise;
      // Start every mount's cancellation before awaiting independent project cleanup.
      const pending = disposers.reverse().map(dispose => dispose());
      (async() => {
        const errors = (await Promise.allSettled(pending)).flatMap(result => result.status === 'rejected' ? [result.reason] : []);
        try { await scope.cleanup(); } catch (error) { errors.push(error); }
        if (errors.length) { throw new AggregateError(errors, 'Mounted test cleanup failed.'); }
      })().then(deferred.resolve, deferred.reject);
    }
    return completion;
  }
  return {
    scope,
    cleanup,
    mountView<View extends SupportedView>(view: View, options: ViewMountOptions = {}) {
      assertOpen();
      return own(mountView(view, { ...defaults, ...options }));
    },
    mountApplication<App extends ApplicationInstance<object, unknown>>(
      factory: (region: RegionInstance) => App, options: ApplicationMountOptions = {}
    ) {
      assertOpen();
      return own(mountApplication(factory, { ...defaults, ...options }));
    }
  };
}
export type TestMounts = ReturnType<typeof createMountContext>;
