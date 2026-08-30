# Marionette Utility Functions

Marionette exports the utility functions it uses to implement common framework
conventions. These functions are useful when extending Marionette or applying
the same conventions to another object.

## Documentation Index

* [extend](#extend)
* [Common Method Utilities](#common-method-utilities)
* [VERSION](#version)

## extend

`extend` is Marionette's owned, standalone implementation of its classic
pseudo-class extension convention. Assign it to a constructor, then call it as
a method so that constructor is the parent. Marionette's extendable classes
already expose this method.

<!-- executable-example: utils-owned-extend -->
```javascript
import { extend } from 'marionette';

function Service(name) {
  this.name = name;
}

Service.extend = extend;

const SpecialService = Service.extend({
  label() {
    return `special:${this.name}`;
  }
}, {
  kind: 'special'
});

const service = new SpecialService('api');

export { Service, SpecialService, extend, service };
```

The child inherits the parent's prototype and static properties. Prototype
properties are supplied by the first argument and optional static properties
by the second. See the [v4 compatibility ledger](./migration-from-v4.md#compatibility-ledger)
for the v5 input-copying boundary.

## Common Method Utilities

The [common utilities](./common.md) are available as instance methods on
Marionette classes and as exports for other objects. An exported utility takes
its target as the first argument; the remaining arguments match the documented
instance method.

<!-- executable-example: utils-target-first-proxies -->
```javascript
import {
  MnObject,
  Radio,
  VERSION,
  bindEvents,
  bindRequests,
  getOption,
  mergeOptions,
  normalizeMethods,
  triggerMethod,
  unbindEvents,
  unbindRequests
} from 'marionette';

const source = new MnObject();
const channel = Radio.channel('utils-target-first');
const unrelatedMessages = [];

source.on('status', value => unrelatedMessages.push(value));
channel.reply('status:other', () => 'other');

const target = new MnObject({ enabled: false });
target.enabled = true;
target.messages = [];
target.utilityCalls = [];
target.onStatus = function(value) {
  this.messages.push(value);
};
target.getStatus = function() {
  return this.messages.at(-1);
};
target.onUtility = function(value) {
  this.utilityCalls.push(`method:${value}`);
  return value.toUpperCase();
};
target.on('utility', value => target.utilityCalls.push(`event:${value}`));

const normalizedInput = { status: 'onStatus' };
const normalized = normalizeMethods(target, normalizedInput);

mergeOptions(target, {
  selected: 'copied',
  ignored: 'not-copied'
}, ['selected']);
bindEvents(target, source, normalizedInput);
bindRequests(target, channel, { 'status:current': 'getStatus' });

const optionValue = getOption(target, 'enabled');
const triggerResult = triggerMethod(target, 'utility', 'ready');

source.trigger('status', 'before-cleanup');
const ownerReply = channel.request('status:current');

unbindEvents(target, source);
unbindRequests(target, channel);

source.trigger('status', 'after-cleanup');
const ownerReplyAfterCleanup = channel.request('status:current');
const unrelatedReplyAfterCleanup = channel.request('status:other');

export {
  Radio,
  VERSION,
  normalized,
  normalizedInput,
  optionValue,
  ownerReply,
  ownerReplyAfterCleanup,
  target,
  triggerResult,
  unrelatedMessages,
  unrelatedReplyAfterCleanup
};
```

* [triggerMethod](./common.md#triggermethod) invokes the corresponding `on*`
  method before triggering the event and returns the method's result.
* [bindEvents](./common.md#bindevents) binds a compatible event emitter to
  methods on the target; [unbindEvents](./common.md#unbindevents) removes only
  bindings owned by that target.
* [bindRequests](./common.md#bindrequests) binds Radio replies with the target
  as owner and callback context; [unbindRequests](./common.md#unbindrequests)
  removes only replies owned by that target.
* [normalizeMethods](./common.md#normalizemethods) returns a fresh map with
  method names resolved against the target.
* [getOption](./common.md#getoption) reads a defined value from `options` before
  the direct property.
* [mergeOptions](./common.md#mergeoptions) copies the selected own enumerable
  string-keyed option values directly onto the target.

## VERSION

`VERSION` is the installed Marionette package version. Marionette also uses it
when constructing versioned diagnostic documentation URLs; exporting it does
not imply that a corresponding website deployment is available.
