// Execute the reference's own code, then check observable helper contracts.
export const assertions = {
  'packages-utils-1': `
assert.equal(label, 'Archive');
source.trigger('changed', 'Ignored');
assert.equal(component.getOption('label'), 'Archive');
const events = [];
component.on('open', () => events.push('event'));
component.onOpen = function() { events.push('hook'); return 42; };
assert.equal(component.triggerMethod('open'), 42);
assert.deepEqual(events, ['hook', 'event']);
component.stopListening();
component.off();
`,
  'packages-utils-2': `
assert.equal(title, 'Team inbox');
assert.equal(fallback, 'Inbox');
assert.equal(handler, settings.title);
assert.equal(bindings['read:title'], settings.title);
assert.equal(getValue({ value: false }, 'value', true), false);
assert.equal(getValue(settings, 'missing', settings.title), title);
assert.throws(() => resolveMethod(settings, 'absent', 'read'), error => error.code === 'MN0019');
assert.throws(() => normalizeBindings(settings, JSON.parse('{"__proto__":"title"}')), error => error.code === 'MN0026');
`,
  'packages-utils-3': `
assert.deepEqual(descriptors, [{ name: 'greet', callback: greet, context: receiver, listener: undefined }]);
assert.equal(greeting, 'Hello, Ada');
assert.equal(first, greeting);
assert.equal(repeated, first);
assert.deepEqual(removals, [greetOnce]);
assert.equal(values[key], greeting);
assert.equal(isLabel, true);
assert.notEqual(uniqueId('component-'), key);
assert.equal(setProperty(values, '__proto__', 'owned'), undefined);
assert.equal(Object.getPrototypeOf(values), Object.prototype);
assert.equal(values.__proto__, 'owned');
let attempts = 0;
const failing = onceWrap(() => { attempts++; throw new Error('failed'); }, () => {});
assert.throws(() => failing(), /failed/);
assert.equal(failing(), undefined);
assert.equal(attempts, 1);
`,
  'packages-utils-4': `
assert.equal(label, 'Inbox');
assert.equal(typeof handlers.open, 'function');
assert.equal(count, 2);
`,
  'api-errors-1': `
assert.ok(error instanceof Error);
assert.ok(error instanceof MarionetteError);
assert.equal(diagnosticCode, 'MN0019');
assert.equal(description, 'Error: The configured handler must resolve to a function. See: https://marionettejs.com/errors/MN0019/');
const { MarionetteError: UtilsError } = await import('@mnjs/utils');
assert.equal(UtilsError, MarionetteError);
const uncoded = new MarionetteError({ name: 'Example', message: 'Invalid', url: 'example', ignored: true });
assert.equal(uncoded.toString(), 'Example: Invalid See: https://marionettejs.com/docs/example');
assert.equal(Object.hasOwn(uncoded, 'ignored'), false);
assert.notEqual(new MarionetteError({}), error);
class CustomError extends MarionetteError {}
assert.ok(new CustomError({ message: 'Custom' }) instanceof CustomError);
`
};
