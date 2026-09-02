import _ from 'underscore';
import Events from '../../../mixins/events';
import Radio from '../../../modules/radio';
import RadioMixin from '../../../mixins/radio';

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
    }, Events, RadioMixin);

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

    it('does not read radio bindings after a falsy channel name', function() {
      const channelName = this.sinon.stub();
      const radioEvents = this.sinon.stub().throws(new Error('must not read events'));
      const radioRequests = this.sinon.stub().throws(new Error('must not read requests'));
      Object.defineProperties(radioObject, {
        channelName: { get: channelName, enumerable: true },
        radioEvents: { get: radioEvents, enumerable: true },
        radioRequests: { get: radioRequests, enumerable: true }
      });

      [undefined, null, false, 0, ''].forEach(value => {
        channelName.returns(value);
        radioObject.initialize();
      });

      expect(channelName).to.have.callCount(5);
      expect(radioEvents).to.not.have.been.called;
      expect(radioRequests).to.not.have.been.called;
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

  it('resolves and binds radio options in order', function() {
    const calls = [];
    radioObject.channelName = this.sinon.stub().callsFake(function(...args) {
      calls.push(['channelName', this === radioObject, args.length]);
      return 'foo';
    });
    radioObject.radioEvents = this.sinon.stub().callsFake(function(...args) {
      calls.push(['radioEvents', this === radioObject, args.length]);
      return { bar: 'onBar' };
    });
    radioObject.radioRequests = this.sinon.stub().callsFake(function(...args) {
      calls.push(['radioRequests', this === radioObject, args.length]);
      return { baz: 'getBaz' };
    });
    radioObject.bindEvents.callsFake(() => calls.push(['bindEvents']));
    radioObject.bindRequests.callsFake(() => calls.push(['bindRequests']));
    this.sinon.stub(Radio, 'channel').callsFake(channelName => {
      calls.push(['channel', channelName]);
      return channelFoo;
    });
    radioObject.initialize();

    expect(calls).to.deep.equal([
      ['channelName', true, 0],
      ['channel', 'foo'],
      ['radioEvents', true, 0],
      ['bindEvents'],
      ['radioRequests', true, 0],
      ['bindRequests']
    ]);
    [radioObject.channelName, radioObject.radioEvents, radioObject.radioRequests]
      .forEach(option => {
        expect(option).to.have.been.calledOnce
          .and.calledOn(radioObject)
          .and.calledWithExactly();
      });
  });

  it('propagates a radio option lookup error before later work', function() {
    const error = new Error('radioEvents failed');
    const radioRequests = this.sinon.stub().returns({ baz: 'getBaz' });
    radioObject.channelName = 'foo';
    Object.defineProperty(radioObject, 'radioEvents', {
      get() {
        throw error;
      }
    });
    radioObject.radioRequests = radioRequests;
    expect(() => radioObject.initialize()).to.throw(error);
    expect(radioObject.bindEvents).to.not.have.been.called;
    expect(radioRequests).to.not.have.been.called;
    expect(radioObject.bindRequests).to.not.have.been.called;
  });

  describe('when an owner destroys its Radio resources', function() {
    let fooChannel;

    beforeEach(function() {
      radioObject.channelName = 'foo'
      radioObject.initialize();

      fooChannel = radioObject.getChannel();

      this.sinon.spy(fooChannel, 'stopReplying');

      radioObject._destroyRadio();
    });

    it('should stopReplying to the object', function() {
      expect(fooChannel.stopReplying).to.have.been.calledOnce
        .and.to.have.been.calledWith(null, null, radioObject);
    });
  });
});
