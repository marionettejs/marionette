import { withErrorMessages } from './errors.ts';
import type { Cleanable, Cleanup, Destroyable, ReplyChannel, ReplyRadio, TestScope } from './scope.ts';

// Mounts can cancel pending readiness before any dependent asynchronous disposer.
export function createOwner(begin?: () => void): TestScope {
  const callbacks: Cleanup[] = [];
  let completion: Promise<void> | undefined;

  function assertOpen() {
    if (completion) { throw new Error('Cannot register cleanup after scope cleanup begins.'); }
  }

  function defer(cleanup: Cleanup) {
    assertOpen();
    callbacks.push(cleanup);
  }

  async function dispose(errors: unknown[]) {
    while (callbacks.length) {
      try { await callbacks.pop()!(); } catch (error) { errors.push(error); }
    }
    if (errors.length) { throw new AggregateError(errors, withErrorMessages('Test scope cleanup failed.', errors)); }
  }

  function ownReply(channel: ReplyChannel, name: string, value: unknown, receiver: unknown) {
    // Each key needs its own identity, including when a later replacement uses
    // the same original function and context.
    const callback = function(this: unknown, ...args: unknown[]) {
      return typeof value === 'function' ? value.apply(this, args) : value;
    };
    defer(() => channel.stopReplying(name, callback, receiver));
    channel.reply(name, callback, receiver);
  }

  const scope: TestScope = {
    defer,
    own(resource) {
      defer(() => {
        const cleanup = (resource as Partial<Cleanable>).cleanup;
        return typeof cleanup === 'function' ? cleanup.call(resource) : (resource as Destroyable).destroy();
      });
      return resource;
    },
    reply(source: ReplyChannel | ReplyRadio, channelOrName: string | Record<string, unknown>, nameOrValue: unknown, valueOrContext?: unknown, context?: unknown) {
      assertOpen();
      const named = 'channel' in source;
      const channel = named ? source.channel(channelOrName as string) : source;
      const nameOrReplies = named ? nameOrValue as string | Record<string, unknown> : channelOrName;
      if (typeof nameOrReplies === 'string') {
        ownReply(channel, nameOrReplies, named ? valueOrContext : nameOrValue, (named ? context : valueOrContext) || channel);
      } else {
        const receiver = (named ? valueOrContext : nameOrValue) || channel;
        for (const name of Object.keys(nameOrReplies)) {
          ownReply(channel, name, nameOrReplies[name], receiver);
        }
      }
      return channel;
    },
    cleanup() {
      if (!completion) {
        const pending = Promise.withResolvers<void>();
        completion = pending.promise;
        const errors: unknown[] = [];
        const start = begin;
        begin = undefined;
        try { start?.(); } catch (error) { errors.push(error); }
        dispose(errors).then(pending.resolve, pending.reject);
      }
      return completion;
    }
  };
  return scope;
}
