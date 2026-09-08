import { vi, describe, it, expect, afterEach } from 'vitest';
import { Channel, Requests, Radio, createRadio } from '@marionette/radio';

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
    const callback = vi.fn();
    owner.on('event', callback);
    owner.listenTo(source, 'event', callback);
    owner.reply('value', 'reply');
    expect(owner.reset()).to.equal(owner);
    owner.trigger('event');
    source.trigger('event');
    expect(callback).not.toHaveBeenCalled();
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
    const warn = vi.spyOn(Radio, 'debugLog').mockImplementation(() => undefined);
    const service = { ...Requests };
    const channel = new Channel('private');
    service.request('quiet');
    channel.request('quiet');
    expect(warn).not.toHaveBeenCalled();
    Radio.setDebug();
    service.request('missing');
    channel.request('missing');
    expect(warn.mock.contexts[0]).toEqual(Radio);
    expect(warn.mock.calls.at(0)).toEqual(['An unhandled request was fired', 'missing', undefined]);
    expect(warn.mock.contexts[1]).toEqual(Radio);
    expect(warn.mock.calls.at(1)).toEqual(['An unhandled request was fired', 'missing', 'private']);
  });

  it('keeps debug switches and hooks local to each Radio instance', function() {
    const first = createRadio();
    const second = createRadio();
    const firstWarn = vi.spyOn(first, 'debugLog').mockImplementation(() => undefined);
    const secondWarn = vi.spyOn(second, 'debugLog').mockImplementation(() => undefined);
    const defaultWarn = vi.spyOn(Radio, 'debugLog').mockImplementation(() => undefined);
    const privateChannel = new first.Channel('private');
    first.setDebug();
    second.setDebug();
    Radio.setDebug();
    privateChannel.request('private-request');
    first.request('app', 'first-request');
    second.request('app', 'second-request');
    Radio.request('app', 'default-request');
    expect(firstWarn).toHaveBeenCalledTimes(2);
    expect(firstWarn.mock.contexts).toEqual(Array(firstWarn.mock.calls.length).fill(first));
    expect(secondWarn).toHaveBeenCalledTimes(1);
    expect(secondWarn.mock.contexts).toContain(second);
    expect(defaultWarn).toHaveBeenCalledTimes(1);
    expect(defaultWarn.mock.contexts).toContain(Radio);
    first.setDebug(false);
    first.request('app', 'disabled');
    expect(firstWarn).toHaveBeenCalledTimes(2);
    expect(privateChannel).to.be.instanceOf(first.Channel);
    expect(privateChannel).to.not.equal(first.channel('private'));
  });

  it('uses the latest activity hook for events and requests while tuned in', function() {
    const radio = createRadio();
    const channel = radio.channel('app');
    const firstLog = vi.spyOn(radio, 'log').mockImplementation(() => undefined);
    channel.reply('value', 'response');
    radio.tuneIn('app');
    channel.trigger('event', 1);
    expect(channel.request('value', 2)).to.equal('response');
    expect(firstLog).toHaveBeenCalledTimes(2);
    expect(firstLog.mock.contexts).toEqual(Array(firstLog.mock.calls.length).fill(radio));
    expect(firstLog.mock.calls.at(0)).toEqual(['app', 'event', 1]);
    expect(firstLog.mock.calls.at(1)).toEqual(['app', 'value', 2]);

    firstLog.mockRestore();
    const replacement = vi.spyOn(radio, 'log').mockImplementation(() => undefined);
    channel.trigger('event', 3);
    channel.request('value', 4);
    expect(replacement).toHaveBeenCalledTimes(2);
    radio.tuneOut('app');
    channel.trigger('event', 5);
    channel.request('value', 6);
    expect(replacement).toHaveBeenCalledTimes(2);
  });

  it('keeps tuning hooks separate between registries', function() {
    const first = createRadio();
    const second = createRadio();
    const firstLog = vi.spyOn(first, 'log').mockImplementation(() => undefined);
    const secondLog = vi.spyOn(second, 'log').mockImplementation(() => undefined);
    first.tuneIn('app');
    second.tuneIn('app');
    first.trigger('app', 'event', 'first');
    second.request('app', 'request', 'second');
    expect(firstLog).toHaveBeenCalledTimes(1);
    expect(firstLog).toHaveBeenCalledWith('app', 'event', 'first');
    expect(secondLog).toHaveBeenCalledTimes(1);
    expect(secondLog).toHaveBeenCalledWith('app', 'request', 'second');
  });
});
