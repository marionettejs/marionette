import { Events, type EventSource } from '@marionette/utils';
import { Radio, createRadio, Channel, Requests } from '@marionette/radio';
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

const privateChannel: Channel = new Channel('private');
privateChannel.reply('ready', true).reset();
const runtime = createRadio();
const owned: Channel = new runtime.Channel('private');
const service = Object.assign({ label: 'settings' }, Requests);
const sameService: typeof service = service.reply('label', () => service.label);
sameService.request('label');
runtime.log = (channelName, eventName, ...args) => {
  const channel: string = channelName;
  const event: string = eventName;
  const values: unknown[] = args;
};
runtime.debugLog = (warning, eventName, channelName) => {
  const message: string = warning;
  const channel: string | undefined = channelName;
};
// @ts-expect-error Standalone channel names must be strings.
new Channel(1);
// @ts-expect-error Warning hooks are callable.
runtime.debugLog = false;
