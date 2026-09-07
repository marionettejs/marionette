import assignIn, { assignOwn } from '../tmp/typed-core/src/utils/assign-in.js';
import uniqueId from '../tmp/typed-core/src/utils/unique-id.js';

const bare: string = uniqueId();
const scoped: string = uniqueId('example');
// @ts-expect-error IDs are strings, including when no prefix is supplied.
const numeric: number = uniqueId();
// @ts-expect-error Typed callers provide a string prefix.
uniqueId({ prefix: 'example' });

const target = { label: 'target' };
const assigned: typeof target = assignOwn(target, { label: 'assigned' });
const callable = () => 'value';
const assignedCallable: typeof callable = assignIn(callable, { label: 'callable' });
// @ts-expect-error Assignment needs an object target when copying source properties.
assignOwn(null, { label: 'invalid' });
// @ts-expect-error Primitive targets cannot receive source properties.
assignIn('target', { label: 'invalid' });
