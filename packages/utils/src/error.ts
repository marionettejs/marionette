// Error
// -----

import extend from './extend.ts';

export interface MarionetteErrorInstance extends Omit<Error, 'name' | 'message'> {
  name: unknown;
  message: unknown;
  code?: unknown;
  description?: unknown;
  fileName?: unknown;
  lineNumber?: unknown;
  number?: unknown;
  url: unknown;
  urlRoot: string;
  toString(): string;
  captureStackTrace(fallbackError: Error): void;
}

export interface MarionetteErrorConstructor {
  new(options: NonNullable<unknown>): MarionetteErrorInstance;
  prototype: MarionetteErrorInstance;
  __super__: Error;
}

type NativeErrorConstructor = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor?: new (...args: never[]) => unknown) => void;
};

type ErrorPrototype = Pick<MarionetteErrorInstance, 'urlRoot' | 'url' | 'captureStackTrace' | 'toString'> & {
  constructor(this: MarionetteErrorInstance, options: NonNullable<unknown>): MarionetteErrorInstance;
} & ThisType<MarionetteErrorInstance>;

const errorProps = ['code', 'description', 'fileName', 'lineNumber', 'name', 'message', 'number', 'url'] as const;

const MarionetteError: MarionetteErrorConstructor = extend.call(Error, {
  urlRoot: 'https://marionettejs.com/docs/',

  url: '',

  // Long-form on purpose: method shorthand produces a non-constructor function,
  // which makes `new MarionetteError(...)` throw at runtime.
  // eslint-disable-next-line object-shorthand
  constructor: function(this: MarionetteErrorInstance, options: NonNullable<unknown>) {
    // Construct a native Error so browser exception reporting retains its message and stack.
    const nativeError = Reflect.construct(Error, [(options as { message?: unknown }).message], new.target) as Error;
    const error = nativeError as unknown as MarionetteErrorInstance;
    const nativeProperties: Partial<Record<typeof errorProps[number], unknown>> = {};
    const optionProperties: Partial<Record<typeof errorProps[number], unknown>> = {};

    for (const property of errorProps) {
      const value = (error as unknown as Record<string, unknown>)[property];
      if (property in error) {
        nativeProperties[property] = value;
      }
    }

    const optionSource = Object(options) as Record<string, unknown>;
    for (const property of errorProps) {
      const value = optionSource[property];
      if (property in optionSource) {
        optionProperties[property] = value;
      }
    }

    Object.assign(error, nativeProperties, optionProperties);
    error.captureStackTrace(nativeError);
    error.url = typeof error.code === 'string' ?
      `https://marionettejs.com/errors/${encodeURIComponent(error.code)}/` :
      error.urlRoot + (error.url as string);
    return error;
  },

  captureStackTrace(fallbackError: Error) {
    if (typeof (Error as NativeErrorConstructor).captureStackTrace !== 'function') {
      this.stack = fallbackError.stack;
      return;
    }

    (Error as NativeErrorConstructor).captureStackTrace!(this, MarionetteError);
  },

  toString() {
    return `${ this.name }: ${ this.message } See: ${ this.url }`;
  }
} satisfies ErrorPrototype) as unknown as MarionetteErrorConstructor;

export default MarionetteError;
