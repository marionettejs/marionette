// Object
// ------

import { assignOwn } from '../utils/assign-in.js';
import extend from '../utils/extend.js';
import uniqueId from '../utils/unique-id.js';
import CommonMixin from '../mixins/common.js';
import DestroyMixin from '../mixins/destroy.js';
import RadioMixin from '../mixins/radio.js';
import StateMixin from '../mixins/state.js';

const ClassOptions = [
  'channelName',
  'radioEvents',
  'radioRequests',
  'stateEvents'
];

// Object borrows many conventions and utilities from Backbone.
const MarionetteObject = function(options) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);
  this._initRadio();
  this._initState(options);
  this.initialize.apply(this, arguments);
  this._initStateEvents();
};

MarionetteObject.extend = extend;

// Object Methods
// --------------

assignOwn(MarionetteObject.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, {
  cidPrefix: 'mno',
});

export default MarionetteObject;
