import { MnObject } from 'marionette';

const Example = MnObject.extend({ label: 'example' });
const receiver = new Example({ label: 'updated' });
const same: typeof receiver = receiver.on('ready', () => {}).trigger('ready').off();
receiver.listenTo(receiver, 'ready', () => {}).stopListening();
receiver.bindEvents(receiver, { ready: () => {} }).unbindEvents(receiver);
receiver.getOption('label');
receiver.mergeOptions(null);
receiver.normalizeMethods({ ready: () => {} });
// @ts-expect-error Event callback validation survives construction.
receiver.on('ready', 'handler');
// @ts-expect-error Ordinary owners do not expose request handlers.
receiver.reply('ready', () => {});
// @ts-expect-error Return identity retains existing receiver properties.
const wrong: number = receiver.trigger('ready').label;
