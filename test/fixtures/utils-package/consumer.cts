import {
  assignIn, assignOwn, extend, MarionetteError, getOption, mergeOptions, normalizeMethods, triggerMethod
} from '@marionette/utils';
import type { EventMap, MarionetteErrorInstance } from '@marionette/utils';

const component = {
  trigger(_name: unknown, ..._args: unknown[]) {},
  options: { enabled: true },
  onReady(value: unknown) { return value; }
};
const handlers: EventMap = normalizeMethods.call(component, { ready: 'onReady' })!;
mergeOptions.call(component, { enabled: true }, ['enabled']);
const enabled: unknown = getOption.call(component, 'enabled');
const result: unknown = triggerMethod.call(component, 'ready', enabled);
const error: MarionetteErrorInstance = new MarionetteError({ message: 'example' });
assignOwn({}, handlers, { result, error });
// @ts-expect-error Events require a string name.
triggerMethod.call(component, 1);

const assigned = assignOwn({ count: 1 }, { label: 'example' }, { count: 'updated' });
const assignedCount: string = assigned.count;
const assignedLabel: string = assigned.label;
const inherited = assignIn({}, { ready: true });
const inheritedReady: boolean = inherited.ready;
const skipped = assignOwn({}, null, undefined, 'not copied', { ready: true });
const skippedReady: boolean = skipped.ready;
const symbol = Symbol('not copied');
const ownStrings = assignOwn({}, { [symbol]: 1, label: 'copied' });
// @ts-expect-error The assignment helpers copy enumerable string keys, not symbols.
void ownStrings[symbol];

function Base(this: { count: number }, count: number) { this.count = count; }
Base.category = 'component';
Base.extend = extend;
const Child = extend.call(Base, {
  label() { return this.count.toFixed(); }
}, { role: 'child' });
const child = new Child(3);
const count: number = child.count;
const label: string = child.label();
const category: string = Child.category;
const role: string = Child.role;
// @ts-expect-error The parent constructor argument remains numeric.
new Child('3');
const Grandchild = Child.extend({
  ready() { return this.label().length > 0; }
}, { category: 42 });
const grandchild = new Grandchild(4);
const ready: boolean = grandchild.ready();
const replacedCategory: number = Grandchild.category;
const inheritedRole: string = Grandchild.role;

const Custom = extend.call(Base, {
  constructor: function(this: { count: number }, value: string) {
    Base.call(this, Number(value));
  },
  label() { return this.count.toFixed(); }
});
const customLabel: string = new Custom('3').label();
// @ts-expect-error The explicit constructor replaces its parent's argument list.
new Custom(3);
const Replacement = extend.call(Base, {
  constructor: function() { return { replacement: true }; }
});
const replacement: boolean = new Replacement().replacement;
// @ts-expect-error Explicit replacement objects do not promise inherited fields.
new Replacement().count;

class Native { constructor(public value: number) {} }
// @ts-expect-error A native class needs an explicit constructor; apply cannot invoke it.
extend.call(Native, {});
const NativeReplacement = extend.call(Native, {
  constructor: function(value: string) { return new Native(Number(value)); }
});
const nativeValue: number = new NativeReplacement('3').value;
void [assignedCount, assignedLabel, inheritedReady, skippedReady, count, label, category,
  role, ready, replacedCategory, inheritedRole, customLabel, replacement, nativeValue];

const optionalSource: { count?: string } = {};
const optionalAssignment = assignOwn({ count: 1 }, optionalSource);
const optionalCount: string | number | undefined = optionalAssignment.count;
// @ts-expect-error An omitted optional source field leaves the original number.
optionalAssignment.count?.toUpperCase();
void optionalCount;

const ReplacementChild = extend.call(Replacement, { unavailable() { return true; } });
const inheritedReplacement: boolean = new ReplacementChild().replacement;
// @ts-expect-error Forwarding a replacing constructor does not install descendant prototype methods.
new ReplacementChild().unavailable();
void inheritedReplacement;

const callable = (value: number) => String(value);
const assignedCallable = assignOwn(callable, { label: 'callable' });
const callableResult: string = assignedCallable(1);
const callableLabel: string = assignedCallable.label;
const reassignedCallable = assignIn(assignedCallable, { label: 2 });
const retainedResult: string = reassignedCallable(2);
const changedLabel: number = reassignedCallable.label;
const assignedConstructor = assignOwn(Native, { label: 'constructor' });
const constructedValue: number = new assignedConstructor(3).value;
void [callableResult, callableLabel, retainedResult, changedLabel, constructedValue];
