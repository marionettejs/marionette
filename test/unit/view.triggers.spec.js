import Backbone from 'backbone';
import { setEnabled } from '../../config/features';
import View from '../../modules/view';

describe('view triggers', function() {
  'use strict';

  let triggersHash;
  let eventsHash;
  let fooHandlerStub;
  let barHandlerStub;
  let fooEvent;

  beforeEach(function() {
    triggersHash = {'foo': 'fooHandler'};
    eventsHash = {'bar': 'barHandler'};

    fooHandlerStub = this.sinon.stub();
    barHandlerStub = this.sinon.stub();

    fooEvent = null;
  });

  function trigger(view, eventName) {
    const event = new window.Event(eventName, {
      bubbles: true,
      cancelable: true
    });
    const stopPropagation = event.stopPropagation.bind(event);
    event._isPropagationStopped = false;
    event.stopPropagation = function() {
      event._isPropagationStopped = true;
      stopPropagation();
    };
    view.el.dispatchEvent(event);
    return event;
  }

  describe('when DOM events are configured to trigger a view event, and the DOM events are fired', function() {
    let model;
    let collection;
    let TestView;
    let view;

    beforeEach(function() {
      model = new Backbone.Model();
      collection = new Backbone.Collection();

      TestView = View.extend({triggers: triggersHash});
      view = new TestView({
        model: model,
        collection: collection
      });

      view.on('fooHandler', fooHandlerStub);
      fooEvent = trigger(view, 'foo');
    });

    it('should trigger the first view event', function() {
      expect(fooHandlerStub).to.have.been.calledOnce;
    });

    it('should include the view in the event', function() {
      expect(fooHandlerStub.lastCall.args[0]).to.contain(view);
    });

    it('should include the event object in the event', function() {
      expect(fooHandlerStub.lastCall.args[1]).to.be.an.instanceOf(Event);
    });
  });

  describe('when triggers and standard events are both configured', function() {
    let TestView;
    let view;

    beforeEach(function() {
      TestView = View.extend({
        triggers: triggersHash,
        events: eventsHash,
        barHandler: barHandlerStub
      });

      view = new TestView();
      view.on('fooHandler', fooHandlerStub);

      fooEvent = trigger(view, 'foo');
      trigger(view, 'bar');
    });

    it('should fire the trigger', function() {
      expect(fooHandlerStub).to.have.been.calledOnce;
    });

    it('should fire the standard event', function() {
      expect(barHandlerStub).to.have.been.calledOnce;
    });
  });

  describe('when triggers are configured with a function', function() {
    let triggersStub;
    let TestView;
    let view;

    beforeEach(function() {
      triggersStub = this.sinon.stub().returns(triggersHash);
      TestView = View.extend({triggers: triggersStub});
      view = new TestView();
      view.on('fooHandler', fooHandlerStub);

      fooEvent = trigger(view, 'foo');
    });

    it('should call the function', function() {
      expect(triggersStub).to.have.been.calledOnce.and.calledOn(view);
    });

    it('should trigger the first view event', function() {
      expect(fooHandlerStub).to.have.been.calledOnce;
    });
  });

  describe('triggers should stop propagation and events by default', function() {
    let TestView;
    let view;

    beforeEach(function() {
      TestView = View.extend({triggers: triggersHash});
      view = new TestView();
      view.on('fooHandler', fooHandlerStub);

      fooEvent = trigger(view, 'foo');
    });

    it('should stop propagation by default', function() {
      expect(fooEvent._isPropagationStopped).to.be.true;
    });

    it('should prevent default by default', function() {
      expect(fooEvent.defaultPrevented).to.be.true;
    });
  });

  describe('when triggers items are manually configured', function() {
    let TestView;
    let view;

    beforeEach(function() {
      TestView = View.extend({
        triggers: {
          'foo': {
            event: 'fooHandler',
            preventDefault: true,
            stopPropagation: false
          }
        }
      });
      view = new TestView();
      view.on('fooHandler', fooHandlerStub);

      fooEvent = trigger(view, 'foo');
    });

    it('should prevent and dont stop the first view event', function() {
      expect(fooEvent.defaultPrevented).to.be.true;
      expect(fooEvent._isPropagationStopped).to.be.false;
    });
  });

  describe('when triggersPreventDefault flag is set to false', function() {
    beforeEach(function() {
      setEnabled('triggersPreventDefault', false);
    });

    afterEach(function() {
      setEnabled('triggersPreventDefault', true);
    });

    describe('triggers should not prevent events by default', function() {
      let TestView;
      let view;

      beforeEach(function() {
        TestView = View.extend({triggers: triggersHash});
        view = new TestView();
        view.on('fooHandler', fooHandlerStub);

        fooEvent = trigger(view, 'foo');
      });

      it('should stop propagation by default', function() {
        expect(fooEvent._isPropagationStopped).to.be.true;
      });

      it('should not prevent default by default', function() {
        expect(fooEvent.defaultPrevented).to.be.false;
      });
    });

    describe('when triggers items are manually configured', function() {
      let TestView;
      let view;

      beforeEach(function() {
        TestView = View.extend({
          triggers: {
            'foo': {
              event: 'fooHandler',
              preventDefault: true,
              stopPropagation: true
            }
          }
        });
        view = new TestView();
        view.on('fooHandler', fooHandlerStub);

        fooEvent = trigger(view, 'foo');
      });

      it('should prevent and stop the first view event', function() {
        expect(fooEvent.defaultPrevented).to.be.true;
        expect(fooEvent._isPropagationStopped).to.be.true;
      });
    });
  });

  describe('when triggersStopPropagation flag is set to false', function() {
    beforeEach(function() {
      setEnabled('triggersStopPropagation', false);
    });

    afterEach(function() {
      setEnabled('triggersStopPropagation', true);
    });

    describe('triggers should not stop propagation by default', function() {
      let TestView;
      let view;

      beforeEach(function() {
        TestView = View.extend({triggers: triggersHash});
        view = new TestView();
        view.on('fooHandler', fooHandlerStub);

        fooEvent = trigger(view, 'foo');
      });

      it('should stop propagation by default', function() {
        expect(fooEvent._isPropagationStopped).to.be.false;
      });

      it('should prevent default by default', function() {
        expect(fooEvent.defaultPrevented).to.be.true;
      });
    });

    describe('when triggers items are manually configured', function() {
      let TestView;
      let view;

      beforeEach(function() {
        TestView = View.extend({
          triggers: {
            'foo': {
              event: 'fooHandler',
              preventDefault: true,
              stopPropagation: true
            }
          }
        });
        view = new TestView();
        view.on('fooHandler', fooHandlerStub);

        fooEvent = trigger(view, 'foo');
      });

      it('should prevent and stop the first view event', function() {
        expect(fooEvent.defaultPrevented).to.be.true;
        expect(fooEvent._isPropagationStopped).to.be.true;
      });
    });
  });
});
