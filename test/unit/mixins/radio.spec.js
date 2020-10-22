import _ from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import RadioMixin from '../../../src/mixins/radio';

describe('Radio Mixin on Marionette.Object', function() {
  let radioObject;
  let channelFoo;

  beforeEach(function() {
    radioObject = _.extend({
      // Simulate implementation
      initialize() {
        this._initRadio();
      },
      bindEvents: this.sinon.stub(),
      bindRequests: this.sinon.stub(),
    }, Backbone.Events, RadioMixin);

    channelFoo = Radio.channel('foo');
  });

  describe('when a channelName is not defined', function() {
    beforeEach(function() {
      radioObject.initialize();
    });

    it('should not have a Radio channel', function() {
      expect(radioObject.getChannel()).to.be.undefined;
    });

    it('should not bind radioEvents', function() {
      expect(radioObject.bindEvents).to.not.have.been.called;
    });

    it('should not bind radioRequests', function() {
      expect(radioObject.bindRequests).to.not.have.been.called;
    });
  });

  describe('when a channelName is defined', function() {
    describe('on the object', function() {
      it('should have the named Radio channel', function() {
        radioObject.channelName = 'foo';
        radioObject.initialize();

        expect(radioObject.getChannel()).to.eql(channelFoo);
      });
    });

    describe('as a function', function() {
      it('should have the named Radio channel', function() {
        radioObject.channelName = this.sinon.stub().returns('foo');
        radioObject.initialize();

        expect(radioObject.getChannel()).to.eql(channelFoo);
      });
    });
  });

  describe('when a radioEvents is defined', function() {
    beforeEach(function() {
      radioObject.channelName = 'foo';
    });

    describe('on the object', function() {
      it('should bind events to the channel', function() {
        radioObject.radioEvents = {'bar': 'onBar'};
        radioObject.initialize();

        expect(radioObject.bindEvents).to.have.been.calledOnce
          .and.to.have.been.calledWith(channelFoo, {'bar': 'onBar'});
      });
    });

    describe('as a function', function() {
      it('should bind events to the channel', function() {
        radioObject.radioEvents = this.sinon.stub().returns({'bar': 'onBar'});
        radioObject.initialize();

        expect(radioObject.bindEvents).to.have.been.calledOnce
          .and.to.have.been.calledWith(channelFoo, {'bar': 'onBar'});
      });
    });
  });

  describe('when a radioRequests is defined', function() {
    beforeEach(function() {
      radioObject.channelName = 'foo';
    });

    describe('on the object', function() {
      it('should bind requests to the channel', function() {
        radioObject.radioRequests = {'baz': 'getBaz'};
        radioObject.initialize();

        expect(radioObject.bindRequests).to.have.been.calledOnce
          .and.to.have.been.calledWith(channelFoo, {'baz': 'getBaz'});
      });
    });

    describe('as a function', function() {
      it('should bind requests to the channel', function() {
        radioObject.radioRequests = this.sinon.stub().returns({'baz': 'getBaz'});
        radioObject.initialize();

        expect(radioObject.bindRequests).to.have.been.calledOnce
          .and.to.have.been.calledWith(channelFoo, {'baz': 'getBaz'});
      });
    });
  });

  describe('when an Object is destroyed', function() {
    let fooChannel;

    beforeEach(function() {
      radioObject.channelName = 'foo'
      radioObject.initialize();

      fooChannel = radioObject.getChannel();

      this.sinon.spy(fooChannel, 'stopReplying');

      radioObject.trigger('destroy');
    });

    it('should stopReplying to the object', function() {
      expect(fooChannel.stopReplying).to.have.been.calledOnce
        .and.to.have.been.calledWith(null, null, radioObject);
    });
  });
});
