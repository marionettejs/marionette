import { Events, type EventSource } from '@marionette/utils';
import { Radio, createRadio, type Channel } from '@marionette/radio';
import { Model, Collection } from '@marionette/data';

const model = new Model({ name: 'first' });
const source: EventSource = model;
const listener = Object.assign({ handled: false }, Events);
listener.listenTo(source, 'change', () => { listener.handled = true; });
const channel: Channel = Radio.channel('app');
channel.reply('model', () => model);
createRadio().channel('isolated').on('change', () => {});
new Collection([model]);
// @ts-expect-error Radio channel names must be strings.
Radio.channel(1);
// @ts-expect-error Model attribute maps follow the inferred shape.
model.set({ name: 1 });
