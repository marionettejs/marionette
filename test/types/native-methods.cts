import MnObject from '../tmp/typed-core/src/modules/object.js';

const Parent = MnObject.extend({
  initialize(options: { label: string }) { options.label.toUpperCase(); },
  greet(): string { return this.options.label; }
});
class Child extends Parent { greet(): string { return 'child'; } }
const child: string = new Child({ label: 'example' }).greet();
// @ts-expect-error required initializer arguments stay required
new Child();
// @ts-expect-error initializer argument shape stays checked
new Child({ label: 1 });
// @ts-expect-error wrong native method return remains rejected
class WrongChild extends Parent { greet(): number { return 1; } }

const Next = Parent.extend({ next(): string { return this.greet(); } });
class NextChild extends Next { next(): string { return 'next'; } }
new NextChild({ label: 'example' }).greet();
// @ts-expect-error inherited methods still pass through Merge's mapped left side
class InheritedChild extends Next { greet(): string { return 'child'; } }
const Redefined = Next.extend({ greet(): string { return 'newest'; } });
class RedefinedChild extends Redefined { greet(): string { return 'child'; } }
new RedefinedChild({ label: 'example' }).greet();

const Custom = MnObject.extend({
  constructor(options: { label: string }, count: number) { MnObject.call(this, options); },
  greet(): string { return 'parent'; }
});
class CustomChild extends Custom { greet(): string { return 'child'; } }
new CustomChild({ label: 'example' }, 2);
// @ts-expect-error custom constructor's second argument stays required
new CustomChild({ label: 'example' });
// @ts-expect-error custom constructor's first argument remains checked
new CustomChild({ label: false }, 2);

const Defaults = MnObject.extend({ options: { enabled: true }, greet(): string { return 'parent'; } });
const enabled: boolean = new Defaults().options.enabled;
// @ts-expect-error a supplied options key still takes the mapped branch
class DefaultsChild extends Defaults { greet(): string { return 'child'; } }
const Factory = Defaults.extend({ options() { return { label: 'example' }; } });
const label: string = new Factory().options.label;
// @ts-expect-error resolved factory options are not callable
new Factory().options();
// @ts-expect-error replacement options do not retain prior defaults
new Factory().options.enabled;
const FactoryInherited = Factory.extend({ greet(): string { return 'parent'; } });
const inheritedLabel: string = new FactoryInherited().options.label;
// @ts-expect-error inherited options also force the mapped branch
class FactoryChild extends FactoryInherited { greet(): string { return 'child'; } }
// @ts-expect-error inherited factory options remain resolved
new FactoryInherited().options();

const Optional = MnObject.extend<{ options?: { enabled: boolean }; greet(): string }>({ greet() { return 'parent'; } });
// @ts-expect-error optional options keys still force mapping
class OptionalChild extends Optional { greet(): string { return 'child'; } }
// @ts-expect-error optional options remain noncallable
new Optional().options();

const Property = MnObject.extend({ greet: (): string => 'parent' });
// @ts-expect-error real function-valued properties must not be relabeled as methods
class PropertyChild extends Property { greet(): string { return 'child'; } }
