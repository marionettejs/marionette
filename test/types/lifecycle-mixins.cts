import { MnObject, type Channel } from 'marionette';

const Owner = MnObject.extend({ channelName: 'lifecycle', label: 'owner' });
const owner = new Owner();
const channel: Channel | undefined = owner.getChannel();
channel?.reply('label', () => owner.label);
const destroyed: typeof owner = owner.destroy({ reason: 'finished' });
const isDestroyed: boolean = owner.isDestroyed();
owner.destroy().getChannel()?.request('label');
const Plain = MnObject.extend({ label: 'plain' });
const withoutChannel = new Plain();
const same: typeof withoutChannel = withoutChannel.destroy();
// @ts-expect-error Synchronous destruction does not produce a promise.
const pending: Promise<boolean> = owner.destroy();
// @ts-expect-error No channel is promised without configuration.
const alwaysChannel: Channel = withoutChannel.getChannel();
// @ts-expect-error Receiver identity retains the owner's actual label type.
const wrongLabel: number = owner.destroy().label;
