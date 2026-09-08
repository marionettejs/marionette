import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import _ from 'underscore';
import $ from 'jquery';
import View from '../../src/modules/view';
import Region from '../../src/modules/region';

describe('onDomRemove', function() {
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
      onDomRemove: vi.fn()
    });
  });


  describe('when a Marionette view is shown detached from the DOM', function() {
    let mnView;

    beforeEach(function() {
      mnView = new MnView();
      detachedRegion.show(mnView);
      mnView.render();
      detachedRegion.empty();
    });

    it('should never trigger onDomRemove', function() {
      expect(mnView.onDomRemove).not.toHaveBeenCalled();
    });
  });


  describe('when a Marionette view is shown attached to the DOM', function() {
    let mnView;

    beforeEach(function() {
      mnView = new MnView();
      attachedRegion.show(mnView);
    });

    describe('when the region is emptied', function() {
      it('should trigger onDomRemove on the view', function() {
        attachedRegion.empty();
        expect(mnView.onDomRemove).toHaveBeenCalledTimes(1);
        expect(mnView.onDomRemove.mock.calls.map(args => args.slice(0, 1))).toContainEqual([mnView]);
      });
    });

    describe('when the view is re-rendered', function() {
      it('should trigger onDomRemove on the view', function() {
        mnView.render();
        expect(mnView.onDomRemove).toHaveBeenCalledTimes(1);
        expect(mnView.onDomRemove.mock.calls.map(args => args.slice(0, 1))).toContainEqual([mnView]);
      });
    });
  });
});
