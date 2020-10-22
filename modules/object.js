// Object
// ------

import { extend as _extend, uniqueId } from 'underscore';
import extend from '../utils/extend';
import CommonMixin from '../mixins/common';
import DestroyMixin from '../mixins/destroy';
import RadioMixin from '../mixins/radio';

const ClassOptions = [
  'channelName',
  'radioEvents',
  'radioRequests'
];

// Object borrows many conventions and utilities from Backbone.
const MarionetteObject = function(options) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);
  this._initRadio();
  this.initialize.apply(this, arguments);
};

MarionetteObject.extend = extend;

// Object Methods
// --------------

_extend(MarionetteObject.prototype, CommonMixin, DestroyMixin, RadioMixin, {
  cidPrefix: 'mno',
});

export default MarionetteObject;
