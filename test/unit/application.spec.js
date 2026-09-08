import '../setup/fixtures.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
'use strict';

import _ from 'underscore';
import { Application } from 'marionette';
import { View } from 'marionette';

describe('Marionette Application', function() {

  describe('#preinitialize', function() {
    it('prepares instance configuration before Region, Radio, and State setup', async function() {
      const options = { el: document.createElement('main'), label: 'Editor' };
      const ConfiguredApplication = Application.extend({
        preinitialize(receivedOptions) {
          expect(receivedOptions).to.equal(options);
          expect(this.options.label).to.equal('Editor');
          expect(this.cid).to.be.a('string');
          expect(this.getRegion()).toBeUndefined();
          expect(this.getChannel()).toBeUndefined();
          this.region = { el: receivedOptions.el };
          this.channelName = this.cid;
          this.state = { label: receivedOptions.label };
        },
        initialize() {
          expect(this.getRegion().el).to.equal(options.el);
          expect(this.getChannel().channelName).to.equal(this.cid);
          expect(this.getState()).to.equal(this.state);
          expect(this.getState().label).to.equal('Editor');
        }
      });
      const app = new ConfiguredApplication(options);
      await app.destroy();
    });
  });

  it('propagates a preinitialize error before evaluating Region and Radio configuration', function() {
    const error = new Error('early configuration failed');
    const region = vi.fn(); const channelName = vi.fn(); const createState = vi.fn();
    const BrokenApplication = Application.extend({ preinitialize() { throw error; }, region, channelName, createState });
    expect(() => new BrokenApplication()).toThrow(error);
    expect(region).not.toHaveBeenCalled(); expect(channelName).not.toHaveBeenCalled(); expect(createState).not.toHaveBeenCalled();
  });

  describe('#initialize', () => {
    describe('when instantiating an app with specified options', function() {
      let app;
      let appOptions;
      let initializeStub;

      beforeEach(function() {
        appOptions = {fooOption: 'foo'};
        initializeStub = vi.spyOn(Application.prototype, 'initialize').mockImplementation(() => undefined);
      });

      it('should pass all arguments to the initialize method', function() {
        app = new Application(appOptions, 'fooArg');

        expect(initializeStub.mock.contexts).toContain(app);
        expect(initializeStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([appOptions, 'fooArg']);
      });

      it('should have a cidPrefix', function() {
        app = new Application(appOptions);

        expect(app.cidPrefix).to.equal('mna');
      });

      it('should have a cid', function() {
        app = new Application(appOptions);

        expect(app.cid).to.not.equal(null).and.not.equal(undefined);
      });

      it('configures its public Radio channel', function() {
        app = new Application({ ...appOptions, channelName: 'public-application' });

        expect(app.getChannel().channelName).to.equal('public-application');
      });

      it('resolves state lazily while initialize uses configured options and Radio', function() {
        const calls = [];
        const state = {};
        const Custom = Application.extend({
          channelName: 'construction-order',
          createState(options) { calls.push(['state', options]); return state; },
          initialize(options, extra) {
            calls.push(['initialize', options, extra]);
            expect(this.getState()).to.equal(state);
            expect(this.getChannel().channelName).to.equal('construction-order');
            expect(this.getOption('label')).to.equal('example');
          }
        });
        const options = { label: 'example' };
        const owner = new Custom(options, 'extra');
        expect(calls).to.deep.equal([['initialize', options, 'extra'], ['state', options]]);
        expect(owner.options).to.deep.equal(options);
      });
    });
  });

  describe('#start', function() {
    let app;
    let fooOptions;

    beforeEach(function() {
      fooOptions = {foo: 'bar'};
      app = new Application();
    });

    it('should resolve when the application starts', async function() {
      const result = await app.start(fooOptions);

      expect(result).toBe(true);
    });
  });

  describe('#onBeforeStart', function() {
    let fooApp;
    let fooOptions;
    let beforeStartStub;
    let onBeforeStartStub;

    beforeEach(function() {
      fooOptions = {foo: 'bar'};
      beforeStartStub = vi.fn();
      onBeforeStartStub = vi.fn();

      const FooApp = Application.extend({
        onBeforeStart: onBeforeStartStub
      });

      fooApp = new FooApp();
      fooApp.on('before:start', beforeStartStub);
    });

    it('should run the onBeforeStart callback', function() {
      fooApp.start(fooOptions);

      expect(beforeStartStub).toHaveBeenCalled();
      expect(onBeforeStartStub).toHaveBeenCalled();
    });

    it('should pass the startup option to the onBeforeStart callback', function() {
      fooApp.start(fooOptions);

      expect(beforeStartStub).toHaveBeenCalledTimes(1);
      expect(beforeStartStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([fooApp, fooOptions]);
      expect(onBeforeStartStub).toHaveBeenCalledTimes(1);
      expect(onBeforeStartStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([fooApp, fooOptions]);
    });
  });

  describe('#onStart', function() {
    let fooApp;
    let fooOptions;
    let startStub;
    let onStartStub;

    beforeEach(function() {
      fooOptions = {foo: 'bar'};
      startStub = vi.fn();
      onStartStub = vi.fn();

      const FooApp = Application.extend({
        onStart: onStartStub
      });

      fooApp = new FooApp();
      fooApp.on('start', startStub);
    });

    it('should run the onStart callback', async function() {
      await fooApp.start(fooOptions);

      expect(startStub).toHaveBeenCalled();
      expect(onStartStub).toHaveBeenCalled();
    });

    it('should pass the startup option to the callback', async function() {
      await fooApp.start(fooOptions);

      expect(startStub).toHaveBeenCalledTimes(1);
      expect(startStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([fooApp, fooOptions]);
      expect(onStartStub).toHaveBeenCalledTimes(1);
      expect(onStartStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([fooApp, fooOptions]);
    });
  });

  describe('#getRegion', function() {
    let app;
    let fooOptions;

    beforeEach(function() {
      fooOptions = {
        region: '#fixtures'
      };
      app = new Application(fooOptions);
    });

    it('should get the region selector with getRegion', function() {
      expect(app.getRegion().el).to.equal('#fixtures');
    });
  });

  describe('#showView', function() {
    let app;
    let view;
    let appRegion;
    let fooOptions;
    let showViewInRegionSpy;

    beforeEach(function() {
      fooOptions = {
        region: '#fixtures'
      };
      view = new View({
        template: _.template('ohai')
      });
      app = new Application(fooOptions);

      appRegion = app.getRegion();

      showViewInRegionSpy = vi.spyOn(appRegion, 'show');
    });

    describe('when additional arguments was passed', function() {
      let fooArgs;

      beforeEach(function() {
        fooArgs = {foo: 'bar'};
      });

      it('should call show method in region with additional arguments', function() {
        app.showView(view, fooArgs);

        expect(showViewInRegionSpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([view, fooArgs]);
      });
    });

    describe('when just view as argument was passed', function() {
      it('should call show method in region', function() {
        app.showView(view);

        expect(showViewInRegionSpy).toHaveBeenCalled();
      });
    });
  });

  describe('#getView', function() {
    let app;
    let view;
    let fooOptions;

    beforeEach(function() {
      fooOptions = {
        region: '#fixtures'
      };
      view = new View({
        template: _.template('ohai')
      });
      app = new Application(fooOptions);
    });

    it('should return View which was shown', function() {
      app.showView(view);

      expect(app.getView()).to.have.deep.equal(view);
    });
  });
});
