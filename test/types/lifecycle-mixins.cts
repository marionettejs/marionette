import CommonMixin from '../tmp/typed-core/src/mixins/common.js';
import RadioMixin from '../tmp/typed-core/src/mixins/radio.js';
import DestroyMixin from '../tmp/typed-core/src/mixins/destroy.js';
import type { Channel } from '../tmp/typed-core/src/modules/radio.js';

const owner = {
  ...CommonMixin,
  ...RadioMixin,
  ...DestroyMixin,
  channelName: 'lifecycle',
  label: 'owner',
  _destroyState() {}
};
owner._initRadio();
const channel: Channel | undefined = owner.getChannel();
channel?.reply('label', () => owner.label);
const disposedRadio: typeof owner = owner._destroyRadio();
const destroyed: typeof owner = owner.destroy({ reason: 'finished' });
const isDestroyed: boolean = owner.isDestroyed();
owner.destroy().getChannel()?.request('label');

const withoutCleanup = { ...CommonMixin, ...DestroyMixin, label: 'plain' };
const same: typeof withoutCleanup = withoutCleanup.destroy();
// @ts-expect-error Synchronous destruction does not produce a promise.
const pending: Promise<boolean> = owner.destroy();
// @ts-expect-error No channel is promised before configuration.
const alwaysChannel: Channel = owner.getChannel();
// @ts-expect-error Radio initialization needs an actual Radio provider.
RadioMixin._initRadio.call({ ...CommonMixin, Radio: {} });
// @ts-expect-error Destruction needs callable event and listener cleanup methods.
DestroyMixin.destroy.call({ stopListening: false });
// @ts-expect-error Optional cleanup must be callable when provided.
DestroyMixin.destroy.call({ ...CommonMixin, _destroyState: false });
// @ts-expect-error Receiver identity retains the owner's actual label type.
const wrongLabel: number = owner.destroy().label;
