import { vi, describe, it, expect, beforeEach } from 'vitest';
import Backbone from 'backbone';
import '../setup/backbone.js';
import { MnObject } from 'marionette';

describe('marionette object', function() {

  describe('when creating an object', function() {
    let object;
    let options;

    beforeEach(function() {
      const Obj = MnObject.extend({
        initialize(opts) {
          this.bindEvents(opts.model, this.modelEvents);
        },

        modelEvents: {
          'bar': 'onBar'
        },

        onBar: vi.fn()
      });


      const model = new Backbone.Model();

      options = {
        model,
        channelName: 'foo',
        radioEvents: {},
        radioRequests: {}
      };

      object = new Obj(options);
    });

    it('should merge the class options to the object', function() {
      expect(object.channelName).to.equal(options.channelName);
      expect(object.radioEvents).to.equal(options.radioEvents);
      expect(object.radioRequests).to.equal(options.radioRequests);
    });

    it('should maintain a reference to the options', function() {
      expect(object.options).to.deep.equal(options);
    });

    it('should have a cidPrefix', function() {
      expect(object.cidPrefix).to.equal('mno');
    });

    it('should have a cid', function() {
      expect(object.cid).to.contain('mno');
    });

    it('configures its public Radio channel', function() {
      expect(object.getChannel().channelName).to.equal('foo');
    });

    it('should support triggering events on itself', function() {
      const fooHandler = vi.fn();
      object.on('foo', fooHandler);

      object.trigger('foo', options);

      expect(fooHandler).toHaveBeenCalledTimes(1);
      expect(fooHandler.mock.calls.map(args => args.slice(0, 1))).toContainEqual([options]);
    });

    it('should support binding to evented objects', function() {
      options.model.trigger('bar', options);

      expect(object.onBar).toHaveBeenCalledTimes(1);
      expect(object.onBar.mock.calls.map(args => args.slice(0, 1))).toContainEqual([options]);
    });

    it('resolves state lazily while initialize uses configured options and Radio', function() {
      const calls = [];
      const state = {};
      const Custom = MnObject.extend({
        channelName: 'construction-order',
        createState(stateOptions) { calls.push(['state', stateOptions]); return state; },
        initialize(initializeOptions, extra) {
          calls.push(['initialize', initializeOptions, extra]);
          expect(this.getState()).to.equal(state);
          expect(this.getChannel().channelName).to.equal('construction-order');
          expect(this.getOption('label')).to.equal('example');
        }
      });
      const constructorOptions = { label: 'example' };
      const owner = new Custom(constructorOptions, 'extra');
      expect(calls).to.deep.equal([['initialize', constructorOptions, 'extra'], ['state', constructorOptions]]);
      expect(owner.options).to.deep.equal(constructorOptions);
    });
  });
});
