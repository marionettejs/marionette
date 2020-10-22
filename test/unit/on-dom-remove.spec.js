import _ from 'underscore';
import Backbone from 'backbone';
import Events from '../../src/mixins/events';
import View from '../../src/view';
import Region from '../../src/region';

describe('onDomRemove', function() {
  'use strict';

  let attachedRegion;
  let detachedRegion;
  let BbView;
  let MnView;

  beforeEach(function() {
    this.setFixtures($('<div id="region"></div>'));
    attachedRegion = new Region({el: '#region'});
    detachedRegion = new Region({el: $('<div></div>')});
    BbView = Backbone.View.extend({
      onDomRemove: this.sinon.stub()
    });
    _.extend(BbView.prototype, Events);
    MnView = View.extend({
      template: _.noop,
      onDomRemove: this.sinon.stub()
    });
  });

  describe('when a Backbone view is shown detached from the DOM', function() {
    let bbView;

    beforeEach(function() {
      bbView = new BbView();
      detachedRegion.show(bbView);
      detachedRegion.empty();
    });

    it('should never trigger onDomRemove', function() {
      expect(bbView.onDomRemove).not.to.have.been.called;
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
      expect(mnView.onDomRemove).not.to.have.been.called;
    });
  });

  describe('when a Backbone view is shown attached to the DOM', function() {
    let bbView;

    beforeEach(function() {
      bbView = new BbView();
      attachedRegion.show(bbView);
    });

    describe('when the region is emptied', function() {
      it('should trigger onDomRemove on the view', function() {
        attachedRegion.empty();
        expect(bbView.onDomRemove).to.have.been.calledOnce.and.calledWith(bbView);
      });
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
        expect(mnView.onDomRemove).to.have.been.calledOnce.and.calledWith(mnView);
      });
    });

    describe('when the view is re-rendered', function() {
      it('should trigger onDomRemove on the view', function() {
        mnView.render();
        expect(mnView.onDomRemove).to.have.been.calledOnce.and.calledWith(mnView);
      });
    });
  });
});
