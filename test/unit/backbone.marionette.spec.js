import _ from 'underscore';

import * as Mn from '../../src/backbone.marionette';
import Marionette from '../../src/backbone.marionette';

import {version} from '../../package.json';

import extend from '../../src/utils/extend';

import monitorViewEvents from '../../src/common/monitor-view-events';

import Events from '../../src/mixins/events';

import MnObject from '../../src/object';
import View from '../../src/view';
import CollectionView from '../../src/collection-view';
import Behavior from '../../src/behavior';
import Region from '../../src/region';
import Application from '../../src/application';

import DomApi from '../../src/config/dom';

import {
  isEnabled,
  setEnabled
} from '../../src/config/features';


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
  });

  describe('Default Export', function() {
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
      it(`should have key ${ key }`, function() {
        expect(Marionette[key]).to.equal(val);
      });
    });

    it('should have key Object', function() {
      expect(Marionette.Object).to.equal(MnObject);
    });
  });

  describe('VERSION', function() {
    it('should attach the package.json version', function() {
      expect(Mn.VERSION).to.equal(version);
    });
  });

  describe('Proxied Utilities', function() {
    let context;

    beforeEach(function() {
      context = new MnObject();
    });

    it('should proxy bindEvents', function() {
      const entity = new MnObject();
      const eventHandler = this.sinon.stub();
      const events = { 'foo': eventHandler };

      Mn.bindEvents(context, entity, events);
      entity.trigger('foo');

      expect(eventHandler)
        .to.have.been.calledOnce
        .and.calledOn(context);
    });

    it('should proxy unbindEvents', function() {
      this.sinon.spy(context, 'stopListening');

      const entity = new MnObject();
      context.listenTo(entity, 'foo', _.noop);

      Mn.unbindEvents(context, entity);

      expect(context.stopListening)
        .to.have.been.calledOnce
        .and.calledOn(context)
        .and.calledWith(entity);
    });

    it('should proxy bindRequests', function() {
      const replyFooStub = this.sinon.stub();
      const channel = { reply: this.sinon.stub() };

      Mn.bindRequests(context, channel, {'foo': replyFooStub});

      expect(channel.reply)
        .to.have.been.calledOnce
        .and.calledWith({'foo': replyFooStub}, context);
    });

    it('should proxy unbindRequests', function() {
      const channel = { stopReplying: this.sinon.stub() };

      Mn.unbindRequests(context, channel);

      expect(channel.stopReplying)
        .to.have.been.calledOnce
        .and.calledWith(null, null, context);
    });

    it('should proxy mergeOptions', function() {
      context.foo = 'bar';

      Mn.mergeOptions(context, { foo: 'baz' }, ['foo']);

      expect(context.foo).to.equal('baz');
    });

    it('should proxy getOption', function() {
      context.options.foo = 'bar';

      expect(Mn.getOption(context, 'foo')).to.equal('bar');
    });

    it('should proxy normalizeMethods', function() {
      context.onFoo = this.sinon.stub();

      expect(Mn.normalizeMethods(context, { foo: 'onFoo' })).to.deep.equal({ foo: context.onFoo });
    });

    it('should proxy triggerMethod', function() {
      context.onFoo = this.sinon.stub();

      Mn.triggerMethod(context, 'foo', 'bar');

      expect(context.onFoo)
        .to.have.been.calledOnce
        .and.calledOn(context)
        .and.calledWith('bar');
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
});
