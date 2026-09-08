import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import _ from 'underscore';
import $ from 'jquery';
import View from '../../src/modules/view';
import Region from '../../src/modules/region';

describe('onDomRefresh', function() {
  'use strict';

  let attachedRegion;
  let detachedRegion;
  let MnView;

  beforeEach(function() {
    setFixtures($('<div id="region"></div>'));
    attachedRegion = new Region({el: '#region'});
    detachedRegion = new Region({el: $('<div></div>')[0]});
    MnView = View.extend({
      template: _.noop,
      onDomRefresh: vi.fn()
    });
  });


  describe('when a Marionette view is shown detached from the DOM', function() {
    let mnView;

    beforeEach(function() {
      mnView = new MnView();
      detachedRegion.show(mnView);
    });

    it('should never trigger onDomRefresh', function() {
      expect(mnView.onDomRefresh).not.toHaveBeenCalledTimes(1);
    });
  });


  describe('when a Marionette view is shown attached to the DOM', function() {
    let mnView;

    beforeEach(function() {
      mnView = new MnView();
      attachedRegion.show(mnView);
    });

    it('should trigger onDomRefresh on the view', function() {
      expect(mnView.onDomRefresh).toHaveBeenCalledTimes(1);
    });
  });

});
