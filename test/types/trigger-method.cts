import Events from '../tmp/typed-core/src/mixins/events.js';
import triggerMethod from '../tmp/typed-core/src/modules/common/trigger-method.js';

const target = {
  trigger(_name: string, ..._args: unknown[]) {},
  onBeforeChange(value: string) { return value; },
  triggerMethod,
};
const result: unknown = target.triggerMethod('before:change', 'value', 1, 2, 3);
const borrowed: unknown = triggerMethod.call(target, 'before:change', 'value');
Events.triggerMethod.call(target, 'before:change', 'value');
// @ts-expect-error A dynamic handler result has no declared event schema.
const promisedResult: string = target.triggerMethod('before:change', 'value');
// @ts-expect-error Borrowing the Events method requires the trigger capability.
Events.triggerMethod.call({}, 'change');
// @ts-expect-error Borrowing the helper requires the trigger capability.
triggerMethod.call({}, 'change');
// @ts-expect-error A truthy value does not supply a callable trigger.
triggerMethod.call({ trigger: true }, 'change');
// @ts-expect-error A constructor without a call signature cannot trigger events.
triggerMethod.call({ trigger: class Trigger {} }, 'change');
// @ts-expect-error Event-to-method lookup requires a string name.
target.triggerMethod(5);
