import { vi, describe, it, expect, afterEach } from 'vitest';
import _ from 'underscore';

import * as Mn from 'marionette';

import {version} from '../../package.json';

import { extend } from 'marionette';

import { monitorViewEvents } from 'marionette';

import { Events } from '@marionette/utils';

import { MnObject } from 'marionette';
import { View } from 'marionette';
import { CollectionView } from 'marionette';
import { Behavior } from 'marionette';
import { Region } from 'marionette';
import { Application } from 'marionette';

import { DomApi } from 'marionette';
import { DataApi } from 'marionette';
import { StateApi } from 'marionette';

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
      expect(Mn.Requests).toBeUndefined();
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
        vi.spyOn(Class, 'setDomApi');
        Mn.setDomApi(fakeDomApi);

        expect(Class.setDomApi).toHaveBeenCalledTimes(1);
        expect(Class.setDomApi.mock.calls.map(args => args.slice(0, 1))).toContainEqual([fakeDomApi]);
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
          vi.spyOn(DataClass, 'setDataApi').mockImplementation(() => undefined).mockReturnValue(DataClass);
        });
        Mn.setDataApi(fakeDataApi);

        expect(Class.setDataApi).toHaveBeenCalledTimes(1);
        expect(Class.setDataApi.mock.calls.map(args => args.slice(0, 1))).toContainEqual([fakeDataApi]);
      });
    });
  });

  describe('#setStateApi', function() {
    const StateClasses = { Application, Behavior, CollectionView, MnObject, View };
    const fakeStateApi = { subscribe() {} };

    _.each(StateClasses, function(Class, key) {
      it(`should setStateApi on ${ key }`, function() {
        _.each(StateClasses, StateClass => {
          vi.spyOn(StateClass, 'setStateApi').mockImplementation(() => undefined).mockReturnValue(StateClass);
        });
        Mn.setStateApi(fakeStateApi);
        expect(Class.setStateApi).toHaveBeenCalledTimes(1);
        expect(Class.setStateApi.mock.calls.map(args => args.slice(0, 1))).toContainEqual([fakeStateApi]);
      });
    });

    it('allows one combined adapter or independent adapter objects', function() {
      const combinedSubscribe = vi.fn().mockReturnValue(() => {});
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
      expect(combinedSubscribe.mock.calls.map(args => args.slice(0, 1))).toContainEqual([combinedSource]);
      expect(combinedView.el.textContent).to.equal('combined');
      combinedView.destroy();

      const stateSubscribe = vi.fn().mockReturnValue(() => {});
      const SplitView = View.extend({
        stateEvents: { change() {} },
        template: data => data.label
      });
      SplitView.setStateApi({ subscribe: stateSubscribe });
      SplitView.setDataApi({ serialize() { return { label: 'split' }; } });
      const splitSource = {};
      const splitView = new SplitView({ state: splitSource, model: {} });
      splitView.render();
      expect(stateSubscribe.mock.calls.map(args => args.slice(0, 1))).toContainEqual([splitSource]);
      expect(splitView.el.textContent).to.equal('split');
      splitView.destroy();
    });
  });

  describe('#setRenderer', function() {
    afterEach(function() {
      Mn.setRenderer();
    });

    const RendererClasses = {
      CollectionView,
      View
    };

    const fakeRenderer = function() {};

    _.each(RendererClasses, function(Class, key) {
      it(`should setRenderer on ${ key }`, function() {
        vi.spyOn(Class, 'setRenderer');

        Mn.setRenderer(fakeRenderer);
        expect(Class.setRenderer).toHaveBeenCalledTimes(1);
        expect(Class.setRenderer.mock.calls.map(args => args.slice(0, 1))).toContainEqual([fakeRenderer]);
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
        vi.spyOn(Class, 'setEventDelegator');

        Mn.setEventDelegator(fakeEventDelegator);
        expect(Class.setEventDelegator).toHaveBeenCalledTimes(1);
        expect(Class.setEventDelegator.mock.calls.map(args => args.slice(0, 1))).toContainEqual([fakeEventDelegator]);
      });
    });
  });
});
