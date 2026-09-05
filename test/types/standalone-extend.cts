import MnObject from '../tmp/typed-core/src/modules/object.js';
import extend from '../tmp/typed-core/src/utils/extend.js';

const Parent = MnObject.extend({
  initialize(options: { label: string }) {},
  read(): string { return this.options.label; }
}, { category: 'parent' });
const Child = extend.call(Parent, { extra() { return this.read(); } }, { category: 1 });
const value: string = new Child({ label: 'child' }).extra();
const kind: number = Child.category;
// @ts-expect-error Constructor options remain required.
new Child();
// @ts-expect-error Replaced static no longer has string type.
const oldKind: string = Child.category;
const Next = Child.extend({ next() { return this.extra(); } });
const next: string = new Next({ label: 'next' }).next();
const Changed = extend.call(Parent, {
  initialize(options: { count: number }) {},
  read(): number { return this.options.count; }
});
const number: number = new Changed({ count: 1 }).read();
// @ts-expect-error New initializer replaces argument contract.
new Changed({ label: 'old' });

const ReturningThis = MnObject.extend({
  constructor: function<Receiver extends object>(this: Receiver, options: { label: string }): Receiver {
    MnObject.call(this, options);
    return this;
  },
  read(): string { return this.options.label; }
});
const Forwarding = extend.call(ReturningThis, { extra() { return this.read(); } });
const returned: string = new Forwarding({ label: 'forwarded' }).extra();
const ForwardNext = Forwarding.extend({ next() { return this.extra(); } });
const returnedNext: string = new ForwardNext({ label: 'next' }).next();
// @ts-expect-error Inherited custom constructor still requires label options.
new Forwarding();

const Numeric = MnObject.extend({
  constructor: function(count: number) { MnObject.call(this, { label: String(count) }); }
});
const NumericChild = extend.call(Numeric, { initialize(options: { label: string }) {} });
new NumericChild(3);
// @ts-expect-error New initializer does not replace inherited custom constructor arguments.
new NumericChild({ label: 'wrong' });
const RootChild = extend.call(MnObject, { read() { return this.cid; } });
const rootId: string = new RootChild().read();

function Arbitrary(this: { label: string }, label: string) { this.label = label; }
const UnknownChild = extend.call(Arbitrary, { extra() { return true; } });
// @ts-expect-error Arbitrary callable parent keeps conservative Function result.
new UnknownChild('label');

class NativeParent extends Parent {
  constructor(count: number) { super({ label: String(count) }); }
  nativeOnly() { return true; }
}
const NativeChild = extend.call(NativeParent, { extra() { return true; } });
// @ts-expect-error A native class cannot use the inherited metadata's callable parent contract.
new NativeChild({ label: 'invalid' });

const DirectReturning = extend.call(MnObject, {
  constructor: function<Receiver extends object>(this: Receiver, options: { label: string }): Receiver {
    MnObject.call(this, options);
    return this;
  },
  read(): string { return this.options.label; }
}, {
  category: 3,
  categoryText(): string { return String(this.category); }
});
const directRead: string = new DirectReturning({ label: 'direct' }).read();
const staticRead: string = DirectReturning.categoryText();
const ReplacedMethod = extend.call(DirectReturning, {}, {
  categoryText(): number { return this.category; }
});
const staticNumber: number = ReplacedMethod.categoryText();
// @ts-expect-error Replaced static method no longer returns string.
const oldStaticResult: string = ReplacedMethod.categoryText();

const detachedCall = extend.call;
// @ts-expect-error Function.call must still be invoked with the helper as its receiver.
detachedCall(MnObject, {});
