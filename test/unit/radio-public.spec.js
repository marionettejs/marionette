import { Channel, Requests, Radio, createRadio } from '../../packages/radio/src/index.ts';

// These tests exercise the package's public entry, including ownership and logging.
describe('Radio public components', function() {
  afterEach(function() {
    Radio.setDebug(false);
    Radio.reset();
  });

  it('constructs independent channels without registering them', function() {
    const first = new Channel('private');
    const second = new Channel('private');
    const registered = Radio.channel('private');
    expect(Channel).to.equal(Radio.Channel);
    expect(first).to.be.instanceOf(Channel);
    expect(registered).to.be.instanceOf(Channel);
    expect(first).to.not.equal(second);
    expect(first).to.not.equal(registered);

    first.reply('value', 'first');
    registered.reply('value', 'registered');
    Radio.reset();
    expect(first.request('value')).to.equal('first');
    expect(registered.request('value')).to.be.undefined;
    expect(second.request('value')).to.be.undefined;
  });

  it('resets a standalone channel and its owned listeners', function() {
    const owner = new Channel('owner');
    const source = new Channel('source');
    const callback = this.sinon.spy();
    owner.on('event', callback);
    owner.listenTo(source, 'event', callback);
    owner.reply('value', 'reply');
    expect(owner.reset()).to.equal(owner);
    owner.trigger('event');
    source.trigger('event');
    expect(callback).to.not.have.been.called;
    expect(owner.request('value')).to.be.undefined;
  });

  it('mixes Requests into an object without adding Events', function() {
    const service = Object.assign({ label: 'settings' }, Requests);
    service.reply('label', function() { return this.label; });
    expect(service.request('label')).to.equal('settings');
    service.replyOnce('once', 'reply');
    expect(service.request('once')).to.equal('reply');
    expect(service.request('once')).to.be.undefined;
    expect(service.stopReplying()).to.equal(service);
    expect(service.request('label')).to.be.undefined;
    expect(service).to.not.have.property('on');
  });

  it('uses default Radio warning hooks for standalone Requests and Channel', function() {
    const warn = this.sinon.stub(Radio, 'debugLog');
    const service = { ...Requests };
    const channel = new Channel('private');
    service.request('quiet');
    channel.request('quiet');
    expect(warn).to.not.have.been.called;
    Radio.setDebug();
    service.request('missing');
    channel.request('missing');
    expect(warn.firstCall).to.have.been.calledOn(Radio)
      .and.calledWithExactly('An unhandled request was fired', 'missing', undefined);
    expect(warn.secondCall).to.have.been.calledOn(Radio)
      .and.calledWithExactly('An unhandled request was fired', 'missing', 'private');
  });

  it('keeps debug switches and hooks local to each Radio instance', function() {
    const first = createRadio();
    const second = createRadio();
    const firstWarn = this.sinon.stub(first, 'debugLog');
    const secondWarn = this.sinon.stub(second, 'debugLog');
    const defaultWarn = this.sinon.stub(Radio, 'debugLog');
    const privateChannel = new first.Channel('private');
    first.setDebug();
    second.setDebug();
    Radio.setDebug();
    privateChannel.request('private-request');
    first.request('app', 'first-request');
    second.request('app', 'second-request');
    Radio.request('app', 'default-request');
    expect(firstWarn).to.have.been.calledTwice.and.always.calledOn(first);
    expect(secondWarn).to.have.been.calledOnce.and.calledOn(second);
    expect(defaultWarn).to.have.been.calledOnce.and.calledOn(Radio);
    first.setDebug(false);
    first.request('app', 'disabled');
    expect(firstWarn).to.have.been.calledTwice;
    expect(privateChannel).to.be.instanceOf(first.Channel);
    expect(privateChannel).to.not.equal(first.channel('private'));
  });

  it('uses the latest activity hook for events and requests while tuned in', function() {
    const radio = createRadio();
    const channel = radio.channel('app');
    const firstLog = this.sinon.stub(radio, 'log');
    channel.reply('value', 'response');
    radio.tuneIn('app');
    channel.trigger('event', 1);
    expect(channel.request('value', 2)).to.equal('response');
    expect(firstLog).to.have.been.calledTwice.and.always.calledOn(radio);
    expect(firstLog.firstCall).to.have.been.calledWithExactly('app', 'event', 1);
    expect(firstLog.secondCall).to.have.been.calledWithExactly('app', 'value', 2);

    firstLog.restore();
    const replacement = this.sinon.stub(radio, 'log');
    channel.trigger('event', 3);
    channel.request('value', 4);
    expect(replacement).to.have.been.calledTwice;
    radio.tuneOut('app');
    channel.trigger('event', 5);
    channel.request('value', 6);
    expect(replacement).to.have.been.calledTwice;
  });

  it('keeps tuning hooks separate between registries', function() {
    const first = createRadio();
    const second = createRadio();
    const firstLog = this.sinon.stub(first, 'log');
    const secondLog = this.sinon.stub(second, 'log');
    first.tuneIn('app');
    second.tuneIn('app');
    first.trigger('app', 'event', 'first');
    second.request('app', 'request', 'second');
    expect(firstLog).to.have.been.calledOnce.and.calledWithExactly('app', 'event', 'first');
    expect(secondLog).to.have.been.calledOnce.and.calledWithExactly('app', 'request', 'second');
  });
});
