// Application
// -----------

import { assignOwn } from '../utils/assign-in.js';
import extend from '../utils/extend.js';
import uniqueId from '../utils/unique-id.js';
import buildRegion from './common/build-region.js';
import CommonMixin from '../mixins/common.js';
import DestroyMixin from '../mixins/destroy.js';
import RadioMixin from '../mixins/radio.js';
import Region from './region.js';

const ClassOptions = [
  'channelName',
  'radioEvents',
  'radioRequests',
  'region',
  'regionClass'
];

const Application = function(options) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);
  this._initRegion();
  this._initRadio();
  this.initialize.apply(this, arguments);
};

Application.extend = extend;

// Application Methods
// --------------

assignOwn(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, {
  cidPrefix: 'mna',

  // Kick off all of the application's processes.
  start(options) {
    this.triggerMethod('before:start', this, options);
    this.triggerMethod('start', this, options);
    return this;
  },

  regionClass: Region,

  _initRegion() {
    const region = this.region;

    if (!region) { return; }

    const defaults = {
      regionClass: this.regionClass
    };

    this._region = buildRegion(region, defaults);
  },

  getRegion() {
    return this._region;
  },

  showView(view, ...args) {
    const region = this.getRegion();
    region.show(view, ...args);
    return view;
  },

  getView() {
    return this.getRegion().currentView;
  }
});

export default Application;
