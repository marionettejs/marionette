import MarionetteError from '../tmp/typed-core/src/modules/error.js';

const error = new MarionetteError({ message: 'example', code: 'MN0001' });
const inherited = new MarionetteError(Object.create({ code: 'MN0001' }));
const absent = new MarionetteError({});
const primitive = new MarionetteError(0);
const callableOptions = new MarionetteError(function example() {});
const explicitUndefined = new MarionetteError({ message: undefined });
const arbitrary = new MarionetteError({ name: 3, message: false, lineNumber: 'line' });
const message: unknown = explicitUndefined.message;
const rendered: string = error.toString();
if (error.code === 'MN0001') { const code: 'MN0001' = error.code; }
class ChildError extends MarionetteError {
  category = 'child';
  captureStackTrace(fallbackError: Error) { this.stack = fallbackError.stack; }
}
const child = new ChildError({ message: 'child' });
const category: string = child.category;
// @ts-expect-error Runtime requires options before reading message.
new MarionetteError();
// @ts-expect-error Runtime cannot read message from null.
new MarionetteError(null);
// @ts-expect-error A bare call is not supported.
MarionetteError({ message: 'example' });
// @ts-expect-error Copied message can be present undefined or arbitrary values.
const promisedMessage: string = explicitUndefined.message;
// @ts-expect-error Construction permits fields incompatible with structural native Error.
const promisedNative: Error = arbitrary;
// @ts-expect-error This constructor does not expose a class extend method.
MarionetteError.extend({});
// @ts-expect-error Unrecognized properties are not copied to the error.
error.extra;

declare const caught: unknown;
if (caught instanceof MarionetteError && caught.code === 'MN0001') {
  const code: 'MN0001' = caught.code;
  const text: string = caught.toString();
}
const samePrototype: typeof MarionetteError.prototype = error;
const nativePrototype: Error = MarionetteError.__super__;
// @ts-expect-error A native Error does not provide the Marionette URL/hook contract.
const missingMarionetteFields: typeof error = new Error('native');
