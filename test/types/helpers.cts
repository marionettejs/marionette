import uniqueId from '../tmp/typed-core/packages/utils/src/unique-id.js';

const bare: string = uniqueId();
const scoped: string = uniqueId('example');
// @ts-expect-error IDs are strings, including when no prefix is supplied.
const numeric: number = uniqueId();
// @ts-expect-error Typed callers provide a string prefix.
uniqueId({ prefix: 'example' });
