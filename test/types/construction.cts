import MnObject from '../tmp/typed-core/src/modules/object.js';

class NativeRoot extends MnObject {
  initialize(options?: object) {}
}
const nativeRoot: object = new NativeRoot({ label: 'root' }).options;

const Parent = MnObject.extend({
  initialize(options: { label: string }) {},
  read(): string { return this.options.label; }
}, { kind: 'parent' });
const Child = Parent.extend({ next(): string { return this.read(); } }, { kind: 1 });
class NativeChild extends Child { read(): string { return 'native'; } }
const inheritedMethod: string = new NativeChild({ label: 'child' }).next();
const replacementStatic: number = Child.kind;
// @ts-expect-error Required options are inherited through additive extensions.
new NativeChild();
// @ts-expect-error An overwritten static does not retain the old type.
const previousStatic: string = Child.kind;
const Changed = Child.extend({
  initialize(options: { count: number }) {},
  read(): number { return this.options.count; }
});
const replacementMethod: number = new Changed({ count: 1 }).read();
// @ts-expect-error The new initializer replaces the ordinary parent options.
new Changed({ label: 'old' });
// @ts-expect-error The old method return does not survive replacement.
const previousMethod: string = new Changed({ count: 1 }).read();

const Numeric = MnObject.extend({
  constructor: function(code: number) {
    MnObject.call(this, { code });
    this.code = code;
  },
  code: 0
});
const WithInitializer = Numeric.extend({
  initialize(options: { code: number }) { options.code.toFixed(); }
});
const inheritedConstructor: number = new WithInitializer(1).code;
// @ts-expect-error initialize cannot replace the inherited custom constructor's arguments.
new WithInitializer({ code: 1 });
const ReplacedConstructor = WithInitializer.extend({
  constructor: function(code: string) {
    MnObject.call(this, { code: Number(code) });
    this.code = Number(code);
  }
});
const replacedConstructor: number = new ReplacedConstructor('1').code;
// @ts-expect-error An explicit new constructor replaces inherited arguments.
new ReplacedConstructor(1);

const ReturningThis = MnObject.extend({
  constructor: function<Receiver extends object>(this: Receiver, options: { label: string }): Receiver {
    MnObject.call(this, options);
    return this;
  },
  read(): string { return this.options.label; }
});
const receiverResult: string = new ReturningThis({ label: 'Example' }).read();
const ForwardingThis = ReturningThis.extend({ extra(): boolean { return true; } });
const forwardingResult: boolean = new ForwardingThis({ label: 'Example' }).extra();
// @ts-expect-error Returning the receiver does not relax constructor arguments.
new ForwardingThis({ label: 1 });
