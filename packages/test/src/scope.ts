import { createOwner } from './owner.ts';

/** Returned values are ignored; returned promises are awaited. */
export type Cleanup = () => unknown;
export interface Cleanable {
  cleanup(): unknown;
}

/** The public Radio operations needed to own one reply without importing Radio. */
export interface ReplyChannel {
  reply(name: string, value: unknown, context?: unknown): unknown;
  stopReplying(name: string, value: unknown, context?: unknown): unknown;
}
export interface ReplyRadio<Channel extends ReplyChannel = ReplyChannel> {
  channel(name: string): Channel;
}

export interface TestScope extends Cleanable {
  defer(cleanup: Cleanup): void;
  own<Resource extends Cleanable>(resource: Resource): Resource;
  reply<Channel extends ReplyChannel>(radio: ReplyRadio<Channel>, channelName: string, name: string, value: unknown, context?: unknown): Channel;
  reply<Channel extends ReplyChannel>(channel: Channel, name: string, value: unknown, context?: unknown): Channel;
  cleanup(): Promise<void>;
}

// Own explicitly registered resources; this entry imports neither Marionette nor a runner.
export function createTestScope(): TestScope { return createOwner(); }
