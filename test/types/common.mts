import CommonMixin from '../tmp/typed-core/src/mixins/common.js';

const receiver = { ...CommonMixin, label: 'example', options: undefined as unknown };
receiver._setOptions({ label: 'updated' }, ['label'] as const);
receiver._setOptions(undefined, []);
receiver._setOptions(null, []);
receiver._setOptions('primitive options', [0, Symbol('ignored'), 'label']);
const result: void = receiver._setOptions({}, []);
const same: typeof receiver = receiver.on('ready', () => {}).trigger('ready').off();
receiver.listenTo(receiver, 'ready', () => {}).stopListening();
receiver.bindEvents(receiver, { ready: () => {} }).unbindEvents(receiver);
receiver.getOption('label');
receiver.mergeOptions(null);
receiver.normalizeMethods({ ready: () => {} });

const custom = {
  options: (() => ({ enabled: true })) as unknown,
  mergeOptions(options: unknown, keys: readonly unknown[]) { return keys.length; }
};
CommonMixin._setOptions.call(custom, { enabled: false }, ['enabled'] as const);
CommonMixin._setOptions.call({ mergeOptions() {} }, {}, []);
// @ts-expect-error The constructor helper needs a callable option merger.
CommonMixin._setOptions.call({}, {}, []);
// @ts-expect-error A non-callable merger cannot initialize options.
CommonMixin._setOptions.call({ mergeOptions: false }, {}, []);
// @ts-expect-error Class options use the array contract shared by constructors.
receiver._setOptions({}, 'label');
// @ts-expect-error Dynamic initialization does not promise a resolved option shape.
const enabled: boolean = receiver.options.enabled;
// @ts-expect-error Event callback validation survives composition.
receiver.on('ready', 'handler');
// @ts-expect-error Common does not compose request handlers.
receiver.reply('ready', () => {});
// @ts-expect-error Return identity retains existing receiver properties.
const wrong: number = receiver.trigger('ready').label;

const narrowMerger = { mergeOptions(options: unknown, keys: string[]) { keys.push('extra'); } };
// @ts-expect-error Borrowed mergers must accept the readonly, unknown-valued list.
CommonMixin._setOptions.call(narrowMerger, {}, ['label'] as const);
