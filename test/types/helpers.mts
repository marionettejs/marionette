import uniqueId from '../tmp/typed-core/src/utils/unique-id.js';
import disposeAll from '../tmp/typed-core/src/utils/dispose-all.js';

const bare: string = uniqueId();
const scoped: string = uniqueId('example');
// @ts-expect-error IDs are strings, including when no prefix is supplied.
const numeric: number = uniqueId();
// @ts-expect-error Typed callers provide a string prefix.
uniqueId({ prefix: 'example' });

const registrations = [undefined, null, false, 0, 0n, '', () => 123] as const;
const completed: void = disposeAll(registrations);
// @ts-expect-error Cleanup is synchronous and does not return a promise.
const asynchronous: Promise<void> = disposeAll(registrations);
// @ts-expect-error A truthy nonfunction cannot be used as a registration.
disposeAll([true]);
// @ts-expect-error Registered cleanup cannot require arguments the helper does not provide.
disposeAll([(required: string) => required]);

function rethrow(error: unknown): never {
  return disposeAll(registrations, error);
}
function rethrowUndefined(): never {
  return disposeAll(registrations, undefined);
}
function rethrowFalsy(): never {
  return disposeAll(registrations, false);
}
