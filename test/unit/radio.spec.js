import Radio from '../../modules/radio';
import { debugLog, setDebug } from '../../modules/common/radio';

describe('Radio', function() {
  afterEach(function() {
    Radio.setDebug(false);
    Radio.reset();
    Radio._channels = {};
  });

  it('requires channel names', function() {
    expect(function() {
      Radio.channel();
    }).to.throw('You must provide a name for the channel.');
  });

  it('returns the same channel for a name', function() {
    expect(Radio.channel('foo')).to.equal(Radio.channel('foo'));
  });

  it('proxies events through the top-level API', function() {
    const handler = this.sinon.stub();

    Radio.on('foo', 'bar', handler);
    Radio.trigger('foo', 'bar', 1);

    expect(handler).to.have.been.calledOnce.and.calledWith(1);
  });

  it('proxies requests through the top-level API', function() {
    Radio.reply('foo', 'bar', 'baz');

    expect(Radio.request('foo', 'bar')).to.equal('baz');
  });

  it('debug logs overwritten requests when enabled', function() {
    const warn = this.sinon.stub(console, 'warn');

    Radio.setDebug();
    Radio.reply('foo', 'bar', 'baz');
    Radio.reply('foo', 'bar', 'qux');

    expect(warn).to.have.been.calledOnce;
  });

  it('supports request maps and space separated request names', function() {
    Radio.reply('foo', {
      'bar baz': function(value) {
        return `${value}:${this.channelName}`;
      }
    });

    expect(Radio.request('foo', 'bar baz', 'qux')).to.deep.equal({
      bar: 'qux:foo',
      baz: 'qux:foo'
    });
    expect(Radio.request('foo', { bar: 'one', baz: 'two' })).to.deep.equal({
      bar: 'one:foo',
      baz: 'two:foo'
    });
    expect(Radio.request('foo', { 'bar baz': 'qux' })).to.deep.equal({
      bar: 'qux:foo',
      baz: 'qux:foo'
    });
  });

  it('supports default request handlers', function() {
    const handler = this.sinon.stub().returns('default');
    Radio.reply('foo', 'default', handler);

    expect(Radio.request('foo', 'missing', 1, 2)).to.equal('default');
    expect(handler).to.have.been.calledWith('missing', 1, 2);
  });

  it('supports replyOnce', function() {
    const handler = this.sinon.stub().returns('once');
    Radio.replyOnce('foo', 'bar', handler);

    expect(Radio.request('foo', 'bar')).to.equal('once');
    expect(Radio.request('foo', 'bar')).to.be.undefined;
    expect(handler).to.have.been.calledOnce;
  });

  it('stops replying by callback and context', function() {
    const context = {};
    const handler = this.sinon.stub().returns('bar');

    Radio.reply('foo', 'bar', handler, context);
    Radio.stopReplying('foo', 'bar', handler, {});
    expect(Radio.request('foo', 'bar')).to.equal('bar');

    Radio.stopReplying('foo', 'bar', handler, context);
    expect(Radio.request('foo', 'bar')).to.be.undefined;
  });

  it('leaves replies in place when stop filters do not match', function() {
    const handler = this.sinon.stub().returns('bar');
    const context = {};

    Radio.reply('foo', 'bar', handler, context);
    Radio.stopReplying('foo', 'missing');
    Radio.stopReplying('foo', 'bar', function() {});
    Radio.stopReplying('foo', 'bar', handler, {});

    expect(Radio.request('foo', 'bar')).to.equal('bar');
  });

  it('stops replies by callback across all names', function() {
    const handler = this.sinon.stub().returns('bar');

    Radio.reply('foo', 'bar baz', handler);
    Radio.stopReplying('foo', null, handler);

    expect(Radio.request('foo', 'bar')).to.be.undefined;
    expect(Radio.request('foo', 'baz')).to.be.undefined;
  });

  it('returns the channel when stopping replies before any are registered', function() {
    const channel = Radio.channel('foo');

    expect(channel.stopReplying('bar')).to.equal(channel);
  });

  it('clears replies when stopReplying is called without filters', function() {
    Radio.reply('foo', 'bar', 'baz');

    Radio.stopReplying('foo');

    expect(Radio.request('foo', 'bar')).to.be.undefined;
  });

  it('logs tuned in events and requests', function() {
    const log = this.sinon.stub(console, 'log');

    Radio.tuneIn('foo');
    Radio.trigger('foo', 'bar', 1);
    Radio.reply('foo', 'baz', 'qux');
    Radio.request('foo', 'baz', 2);
    Radio.tuneOut('foo');
    Radio.trigger('foo', 'bar', 3);

    expect(log).to.have.been.calledTwice;
  });

  it('debug logs unhandled requests when enabled', function() {
    const warn = this.sinon.stub(console, 'warn');

    Radio.setDebug();
    Radio.request('foo', 'missing');
    Radio.setDebug(false);
    Radio.request('foo', 'missing');

    expect(warn).to.have.been.calledOnce;
  });

  it('formats direct debug logs without a channel name', function() {
    const warn = this.sinon.stub(console, 'warn');

    setDebug();
    debugLog('warning', 'event');
    setDebug(false);

    expect(warn).to.have.been.calledWith('warning: "event"');
  });

  it('resets a named channel and all channels', function() {
    const fooHandler = this.sinon.stub();
    const barHandler = this.sinon.stub();

    Radio.on('foo', 'event', fooHandler);
    Radio.on('bar', 'event', barHandler);
    Radio.reset('foo');
    Radio.trigger('foo', 'event');
    Radio.trigger('bar', 'event');
    expect(fooHandler).to.not.have.been.called;
    expect(barHandler).to.have.been.calledOnce;

    Radio.reset();
    Radio.trigger('bar', 'event');
    expect(barHandler).to.have.been.calledOnce;
  });
});
