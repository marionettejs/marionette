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
import DataApi from '../../runtime/data-api';
import StateApi from '../../runtime/state-api';

describe('backbone.marionette', function() {
  describe('Named Exports', function() {
    const namedExports = {
      View,
      CollectionView,
      MnObject,
      Region,
      Behavior,
      Application,
      monitorViewEvents,
      Events,
      extend,
      DomApi,
      DataApi,
      StateApi,
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
        'isEnabled',
        'normalizeMethods',
        'setEnabled',
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

  describe('#setDataApi', function() {
    const DataClasses = {
      CollectionView,
      View
    };

    const fakeDataApi = {
      foo: 'bar'
    };

    _.each(DataClasses, function(Class, key) {
      it(`should setDataApi on ${ key }`, function() {
        _.each(DataClasses, DataClass => {
          this.sinon.stub(DataClass, 'setDataApi').returns(DataClass);
        });
        Mn.setDataApi(fakeDataApi);

        expect(Class.setDataApi)
          .to.be.calledOnce
          .and.calledWith(fakeDataApi);
      });
    });
  });

  describe('#setStateApi', function() {
    const StateClasses = { Application, Behavior, CollectionView, MnObject, View };
    const fakeStateApi = { subscribe() {} };

    _.each(StateClasses, function(Class, key) {
      it(`should setStateApi on ${ key }`, function() {
        _.each(StateClasses, StateClass => {
          this.sinon.stub(StateClass, 'setStateApi').returns(StateClass);
        });
        Mn.setStateApi(fakeStateApi);
        expect(Class.setStateApi).to.be.calledOnce.and.calledWith(fakeStateApi);
      });
    });

    it('allows one combined adapter or independent adapter objects', function() {
      const combinedSubscribe = this.sinon.stub().returns(() => {});
      const CombinedView = View.extend({
        stateEvents: { change() {} },
        template: data => data.label
      });
      const combined = {
        subscribe: combinedSubscribe,
        serialize() { return { label: 'combined' }; }
      };
      CombinedView.setStateApi(combined);
      CombinedView.setDataApi(combined);
      const combinedSource = {};
      const combinedView = new CombinedView({ state: combinedSource, model: {} });
      combinedView.render();
      expect(combinedSubscribe).to.have.been.calledWith(combinedSource);
      expect(combinedView.el.textContent).to.equal('combined');
      combinedView.destroy();

      const stateSubscribe = this.sinon.stub().returns(() => {});
      const SplitView = View.extend({
        stateEvents: { change() {} },
        template: data => data.label
      });
      SplitView.setStateApi({ subscribe: stateSubscribe });
      SplitView.setDataApi({ serialize() { return { label: 'split' }; } });
      const splitSource = {};
      const splitView = new SplitView({ state: splitSource, model: {} });
      splitView.render();
      expect(stateSubscribe).to.have.been.calledWith(splitSource);
      expect(splitView.el.textContent).to.equal('split');
      splitView.destroy();
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
      delegate() {
        return function cleanup() {};
      }
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
