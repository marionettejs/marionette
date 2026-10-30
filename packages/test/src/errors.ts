// Keep nested errors intact; runner reporters may print only this wrapper's message.
export function withErrorMessages(message: string, errors: unknown[]): string {
  const summaries = errors.map(error => {
    try { return String(error instanceof Error ? error.message : error); } catch { return 'Unprintable thrown value'; }
  });
  return `${message} ${summaries.join('; ')}`;
}

// Entries are bundled independently; use one opaque protocol across ESM/CJS and adapters.
const mountCleanup = /* @__PURE__ */ Symbol.for('@mnjs/test.mount-cleanup.v1');

/** A synchronous mount failed after acquiring resources. Await cleanup before continuing. */
export class MountError extends Error {
  readonly cleanup: Promise<void>;

  constructor(cause: unknown, cleanup: Promise<void>) {
    super(withErrorMessages('Mount failed.', [cause]), { cause });
    this.name = 'MountError';
    Object.defineProperty(this, mountCleanup, { value: cleanup });
    this.cleanup = cleanup.catch(error => {
      throw new AggregateError([cause, error], withErrorMessages('Mount and cleanup failed.', [cause, error]), { cause: error });
    });
  }
}

// Runner contexts take responsibility for raw cleanup and rethrow the original
// failure. Observe the standalone wrapper too: the context reports disposal
// rejection through its own awaited teardown, without duplicating the cause.
export function takeMountCleanup(error: MountError): Promise<void> {
  error.cleanup.catch(() => {});
  return Reflect.get(error, mountCleanup) as Promise<void>;
}

export function isMountError(value: unknown): value is MountError {
  try { return typeof value === 'object' && value !== null && mountCleanup in value; } catch {
    // A thrown value can be a revoked Proxy or reject property inspection.
    return false;
  }
}
