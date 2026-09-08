import {
  extend, MarionetteError, getOption, mergeOptions, normalizeMethods, triggerMethod
} from '@mnjs/utils';
import type { EventMap, MarionetteErrorInstance } from '@mnjs/utils';

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
void [handlers, result, error];
// @ts-expect-error Events require a string name.
triggerMethod.call(component, 1);

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
void [count, label, category,
  role, ready, replacedCategory, inheritedRole, customLabel, replacement, nativeValue];

const ReplacementChild = extend.call(Replacement, { unavailable() { return true; } });
const inheritedReplacement: boolean = new ReplacementChild().replacement;
// @ts-expect-error Forwarding a replacing constructor does not install descendant prototype methods.
new ReplacementChild().unavailable();
void inheritedReplacement;
