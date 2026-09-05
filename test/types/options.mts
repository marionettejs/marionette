import getOption from '../tmp/typed-core/src/modules/common/get-option.js';
import mergeOptions from '../tmp/typed-core/src/modules/common/merge-options.js';
const callback = () => 1;
const receiver = {
  getOption, mergeOptions, label: 123, fallback: 42, falsey: 'parent', absent: 'parent', '': 'not returned',
  options: { label: 'option', fallback: undefined, falsey: false, absent: undefined, callback }
};
const label: string = receiver.getOption('label');
// @ts-expect-error Defined options win without an unnecessary parent-value union.
const oldLabel: number = receiver.getOption('label');
const fallback: number = receiver.getOption('fallback');
const falsey: boolean = receiver.getOption('falsey');
const fn: typeof callback = receiver.getOption('callback');
const empty: undefined = receiver.getOption('');
const nullName: undefined = receiver.getOption(null);
const missingName: undefined = receiver.getOption();
const zeroName: undefined = receiver.getOption(0);
const zeroBigIntName: undefined = receiver.getOption(0n);
// @ts-expect-error The empty name never reads even a declared empty property.
const badEmpty: string = receiver.getOption('');
const dynamic: string = 'runtime name';
const dynamicResult: unknown = receiver.getOption(dynamic);
// @ts-expect-error Unknown names do not become a guaranteed value.
const badDynamic: string = receiver.getOption(dynamic);
const optional = { getOption, label: 3, options: {} as { label?: string } };
const union: string | number = optional.getOption('label');
const noOptions = { getOption, label: 3, options: undefined as { label: string } | undefined };
const maybe: string | number = noOptions.getOption('label');
const indexed = { getOption, value: 3, options: {} as Record<string, string> };
const indexedResult: string | number = indexed.getOption('value');
// @ts-expect-error An index signature does not prove the options key is present.
const unsafeIndex: string = indexed.getOption('value');
const noFallback = { getOption, options: {} as { label?: string } };
const possiblyAbsent: string | undefined = noFallback.getOption('label');
const absent: undefined = receiver.getOption(undefined);
const ignoredFalse: undefined = receiver.getOption(false);
const returnValue: void = receiver.mergeOptions({ label: 'copy' }, ['label']);
receiver.mergeOptions(null);
receiver.mergeOptions(undefined);
receiver.mergeOptions();
receiver.mergeOptions(null, 'ignored keys');
receiver.mergeOptions({ label: 1 }, Object.freeze(['label']));
receiver.mergeOptions({ label: 1 }, ['label', 1, Symbol('ignored')]);
receiver.mergeOptions('abc', ['0']);
// @ts-expect-error Present options require keys.
receiver.mergeOptions({ label: 1 });
// @ts-expect-error Present options require an array.
receiver.mergeOptions({ label: 1 }, 'label');
// @ts-expect-error Mutation is not a fluent return.
const fluent: typeof receiver = receiver.mergeOptions({ label: 1 }, ['label']);
const emptyReceiver = { mergeOptions };
emptyReceiver.mergeOptions({ added: true }, ['added']);
// @ts-expect-error Conditional copying does not refine the receiver shape.
emptyReceiver.added;
import MnObject from '../tmp/typed-core/src/modules/object.js';
const Owner = MnObject.extend({ '': 'not returned', label: 1 });
const actual = new Owner();
const emptyOwner: undefined = actual.getOption('');
actual.mergeOptions(null);
// @ts-expect-error getOption's actual empty-name result is never string.
const wrongEmptyOwner: string = actual.getOption('');
// Borrowed .call remains accepted but loses useful literal inference here.
const borrowedValue: unknown = getOption.call(receiver, 'label');
// @ts-expect-error Built-in .call selects the last overload and loses the nullish optional-keys case.
mergeOptions.call(receiver, null);

const standaloneEmpty: undefined = getOption();
const standaloneNull: undefined = getOption(null);
const standaloneMerge: void = mergeOptions(null);
mergeOptions();
const unknownOptions = { getOption, label: 1, options: { label: 'option' } as unknown };
const unknownOption: unknown = unknownOptions.getOption('label');
// @ts-expect-error An unknown options object can supply a different value.
const assumedFallback: number = unknownOptions.getOption('label');
const symbol = Symbol('option');
const symbolOptions = { getOption, [symbol]: 1, options: {} as Record<symbol, string> };
const symbolOption: string | number = symbolOptions.getOption(symbol);
// @ts-expect-error A symbol index signature does not prove that key is present.
const assumedSymbol: string = symbolOptions.getOption(symbol);

const broadOptions = { getOption, label: 1, options: { label: 'option' } as object };
const broadOption: unknown = broadOptions.getOption('label');
// @ts-expect-error A broadly typed options object does not prove fallback.
const assumedBroadFallback: number = broadOptions.getOption('label');
const emptyShapeOptions = { getOption, label: 1, options: { label: 'option' } as {} };
// @ts-expect-error An empty structural type does not prove the option is absent.
const assumedEmptyFallback: number = emptyShapeOptions.getOption('label');
const anyOptions = { getOption, label: 1, options: { label: 'option' } as any };
// @ts-expect-error An unchecked options value cannot guarantee fallback.
const assumedAnyFallback: number = anyOptions.getOption('label');
const DefaultOptionsOwner = MnObject.extend({ label: 1 });
const broadOwner = new DefaultOptionsOwner();
// @ts-expect-error Default MnObject options type is open to supplied values.
const assumedOwnerFallback: number = broadOwner.getOption('label');

const numberIndexed = { getOption, '1': 42, options: { 1: 'option' } as Record<number, string> };
// @ts-expect-error String property access also reads numeric option keys.
const assumedStringKeyFallback: number = numberIndexed.getOption('1');
const stringIndexed = { getOption, 1: 42, options: { '1': 'option' } as Record<string, string> };
// @ts-expect-error Numeric property access also reads string option keys.
const assumedNumberKeyFallback: number = stringIndexed.getOption(1);
const stringLiteral = { getOption, 1: 42, options: { '1': 'option' } };
// @ts-expect-error A string literal option key can override a numeric key.
const assumedLiteralKeyFallback: number = stringLiteral.getOption(1);

const falseOptions = { getOption, options: false as const, valueOf() { return {}; } };
// @ts-expect-error Falsy primitive options skip their inherited methods.
const assumedBooleanMethod: () => boolean = falseOptions.getOption('valueOf');
const zeroOptions = { getOption, options: 0 as const, valueOf() { return {}; } };
// @ts-expect-error Falsy primitive options skip their inherited methods.
const assumedNumberMethod: () => number = zeroOptions.getOption('valueOf');
const zeroBigIntOptions = { getOption, options: 0n as const, valueOf() { return {}; } };
// @ts-expect-error Falsy primitive options skip their inherited methods.
const assumedBigIntMethod: () => bigint = zeroBigIntOptions.getOption('valueOf');
