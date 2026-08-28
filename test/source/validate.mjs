import assert from 'node:assert/strict';

import Backbone from '../../backbone.js';
import jqueryDomApi from '../../jquery-dom-api.js';
import * as Marionette from '../../index.js';

assert.equal(typeof Marionette.View, 'function');
assert.equal(typeof Marionette.Region, 'function');
assert.equal(typeof Marionette.MarionetteError, 'function');
assert.ok(new Marionette.MarionetteError({ message: 'fixture' }) instanceof Error);
assert.equal(Backbone.Model.prototype.triggerMethod, Marionette.Events.triggerMethod);
assert.equal(typeof jqueryDomApi.findEl, 'function');
assert.equal(typeof jqueryDomApi.setContents, 'function');
