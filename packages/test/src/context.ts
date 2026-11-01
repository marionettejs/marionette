import { isMountError, takeMountCleanup, withErrorMessages } from './errors.ts';
import { createTestScope, mountApplication, mountRegion, mountView } from './index.ts';
import type { ApplicationMountOptions, MountOptions, MountedRegion, ViewFactory, ViewMountOptions } from './index.ts';
import type { ApplicationInstance, RegionInstance, SupportedView } from 'marionette';
import type { TestScope } from './scope.ts';

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
  function acquire<Handle extends MountedRegion>(create: () => Handle): Handle {
    try { return own(create()); } catch (error) {
      if (isMountError(error)) {
        const pending = takeMountCleanup(error);
        disposers.push(() => pending);
        throw error.cause;
      }
      throw error;
    }
  }
  function cleanup() {
    if (!completion) {
      closed = true;
      const deferred = Promise.withResolvers<void>();
      // Destruction callbacks can reenter cleanup; publish its identity first.
      completion = deferred.promise;
      // Start every mount's cancellation before awaiting independent project cleanup.
      const pending = disposers.splice(0).reverse().map(dispose => dispose());
      (async() => {
        const errors = (await Promise.allSettled(pending)).flatMap(result => result.status === 'rejected' ? [result.reason] : []);
        try { await scope.cleanup(); } catch (error) { errors.push(error); }
        if (errors.length) { throw new AggregateError(errors, withErrorMessages('Mounted test cleanup failed.', errors)); }
      })().then(deferred.resolve, deferred.reject);
    }
    return completion;
  }
  return {
    scope,
    cleanup,
    mountRegion(options: MountOptions = {}) {
      assertOpen();
      return acquire(() => mountRegion({ ...defaults, ...options }));
    },
    mountView<View extends SupportedView>(view: View | ViewFactory<View>, options: ViewMountOptions = {}) {
      assertOpen();
      return acquire(() => mountView(view, { ...defaults, ...options }));
    },
    mountApplication<App extends ApplicationInstance<object, unknown>>(
      factory: (region: RegionInstance, scope: TestScope) => App, options: ApplicationMountOptions = {}
    ) {
      assertOpen();
      return acquire(() => mountApplication(factory, { ...defaults, ...options }));
    }
  };
}
export type TestMounts = ReturnType<typeof createMountContext>;
