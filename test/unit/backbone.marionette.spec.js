import _ from 'underscore';

import * as Mn from '../../index.js';

import {version} from '../../package.json';

import extend from '../../utils/extend';

import monitorViewEvents from '../../modules/common/monitor-view-events';

import Events from '../../mixins/events';

import MnObject from '../../modules/object';
import View from '../../modules/view';
import CollectionView from '../../modules/collection-view';
import Behavior from '../../modules/behavior';
import Region from '../../modules/region';
import Application from '../../modules/application';

import DomApi from '../../runtime/dom-api';

import {
  isEnabled,
  setEnabled
} from '../../runtime/features';


describe('backbone.marionette', function() {
  describe('Named Exports', function() {
    const namedExports = {
      View,
      CollectionView,
      MnObject,
      Region,
      Behavior,
      Application,
      isEnabled,
      setEnabled,
      monitorViewEvents,
      Events,
      extend,
      DomApi,
    };

    _.each(namedExports, (val, key) => {
      it(`should have named export ${ key }`, function() {
        expect(Mn[key]).to.equal(val);
      });
    });

    it('does not expose the internal Requests mixin', function() {
      expect(Mn.Requests).to.be.undefined;
    });
  });

  describe('VERSION', function() {
    it('should attach the package.json version', function() {
      expect(Mn.VERSION).to.equal(version);
    });
  });

  describe('Common method utilities', function() {
    it('does not expose duplicate target-first root utilities', function() {
      const removedUtilities = [
        'bindEvents',
        'unbindEvents',
        'bindRequests',
        'unbindRequests',
        'mergeOptions',
        'getOption',
        'normalizeMethods',
        'triggerMethod'
      ];

      removedUtilities.forEach(name => expect(Mn).to.not.have.property(name));
    });
  });

  describe('#setDomApi', function() {
    const DomClasses = {
      CollectionView,
      Region,
      View
    };

    const fakeDomApi = {
      foo: 'bar'
    };

    _.each(DomClasses, function(Class, key) {
      it(`should setDomApi on ${ key }`, function() {
        this.sinon.spy(Class, 'setDomApi');
        Mn.setDomApi(fakeDomApi);

        expect(Class.setDomApi)
          .to.be.calledOnce
          .and.calledWith(fakeDomApi);
      });
    });
  });

  describe('#setRenderer', function() {
    let renderer;

    beforeEach(function() {
      renderer = View.prototype._renderHtml;
    });

    afterEach(function() {
      Mn.setRenderer(renderer);
    });

    const RendererClasses = {
      CollectionView,
      View
    };

    const fakeRenderer = function() {};

    _.each(RendererClasses, function(Class, key) {
      it(`should setRenderer on ${ key }`, function() {
        this.sinon.spy(Class, 'setRenderer');

        Mn.setRenderer(fakeRenderer);
        expect(Class.setRenderer)
          .to.be.calledOnce
          .and.calledWith(fakeRenderer);
      });
    });
  });

  describe('#setEventDelegator', function() {
    const DelegatorClasses = {
      Behavior,
      CollectionView,
      View
    };

    const fakeEventDelegator = {
      foo: 'bar'
    };

    _.each(DelegatorClasses, function(Class, key) {
      it(`should setEventDelegator on ${ key }`, function() {
        this.sinon.spy(Class, 'setEventDelegator');

        Mn.setEventDelegator(fakeEventDelegator);
        expect(Class.setEventDelegator)
          .to.be.calledOnce
          .and.calledWith(fakeEventDelegator);
      });
    });
  });
});
