import Requests from '../../mixins/requests';
import { setDebug } from '../../modules/common/radio';

describe('Requests', function() {
  beforeEach(function() {
    this.requests = { ...Requests };
  });

  afterEach(function() {
    setDebug(false);
  });

  it('calls reply handlers with the request arguments and context', function() {
    const context = {};
    const handler = this.sinon.stub().returns('response');

    this.requests.reply('foo', handler, context);

    expect(this.requests.request('foo', 1, 2)).to.equal('response');
    expect(handler).to.have.been.calledOnce.and.calledOn(context).and.calledWithExactly(1, 2);
  });

  it('replaces duplicate replies and logs the overwrite in debug mode', function() {
    const warn = this.sinon.stub(console, 'warn');

    setDebug();
    this.requests.reply('foo', 'first');
    this.requests.reply('foo', 'second');

    expect(this.requests.request('foo')).to.equal('second');
    expect(warn).to.have.been.calledOnce.and.calledWithExactly('A request was overwritten: "foo"');
  });

  it('removes replyOnce handlers after the first request', function() {
    const handler = this.sinon.stub().returns('once');

    this.requests.replyOnce('foo', handler);

    expect(this.requests.request('foo', 1)).to.equal('once');
    expect(this.requests.request('foo', 2)).to.be.undefined;
    expect(handler).to.have.been.calledOnce.and.calledWithExactly(1);
  });

  it('passes the request name and arguments to the default handler', function() {
    const handler = this.sinon.stub().returns('default');

    this.requests.reply('default', handler);

    expect(this.requests.request('missing', 1, 2)).to.equal('default');
    expect(handler).to.have.been.calledOnce.and.calledWithExactly('missing', 1, 2);
  });

  it('ignores inherited named and default handlers', function() {
    const namedHandler = this.sinon.stub();
    const defaultHandler = this.sinon.stub();
    this.requests._rdRequests = Object.create({
      default: { callback: defaultHandler, context: this.requests },
      inherited: { callback: namedHandler, context: this.requests }
    });

    expect(this.requests.request('inherited')).to.be.undefined;
    expect(this.requests.request('missing')).to.be.undefined;
    expect(this.requests.request('constructor')).to.be.undefined;
    expect(this.requests.request('toString')).to.be.undefined;
    expect(namedHandler).to.not.have.been.called;
    expect(defaultHandler).to.not.have.been.called;
  });

  it('stores, invokes, and removes an own __proto__ handler safely', function() {
    const handler = this.sinon.stub().returns('response');

    this.requests.reply('__proto__', handler);

    expect(Object.getPrototypeOf(this.requests._rdRequests)).to.equal(Object.prototype);
    expect(Object.hasOwn(this.requests._rdRequests, '__proto__')).to.be.true;
    expect(this.requests.request('__proto__')).to.equal('response');

    this.requests.stopReplying('__proto__');

    expect(Object.hasOwn(this.requests._rdRequests, '__proto__')).to.be.false;
    expect(this.requests.request('__proto__')).to.be.undefined;
  });

  it('warns only when an own handler is overwritten', function() {
    const warn = this.sinon.stub(console, 'warn');
    this.requests._rdRequests = Object.create({
      inherited: { callback() {}, context: this.requests }
    });

    setDebug();
    this.requests.reply('inherited', 'first');
    this.requests.reply('inherited', 'second');

    expect(warn).to.have.been.calledOnce
      .and.calledWithExactly('A request was overwritten: "inherited"');
  });

  it('builds request result maps with safe own keys', function() {
    const protoValue = { safe: true };
    const requestMap = {};
    Object.defineProperty(requestMap, '__proto__', {
      enumerable: true,
      value: 'argument'
    });
    this.requests.reply('__proto__', () => protoValue);
    this.requests.reply('first', () => 1);
    this.requests.reply('second', () => 2);

    const directReplies = this.requests.request(requestMap);
    const nestedReplies = this.requests.request({ '__proto__ first': 'argument' });
    const splitReplies = this.requests.request('first second');

    expect(Object.getPrototypeOf(directReplies)).to.equal(Object.prototype);
    expect(Object.hasOwn(directReplies, '__proto__')).to.be.true;
    expect(Object.getOwnPropertyDescriptor(directReplies, '__proto__').value)
      .to.equal(protoValue);
    expect(Object.getPrototypeOf(nestedReplies)).to.equal(Object.prototype);
    expect(Object.hasOwn(nestedReplies, '__proto__')).to.be.true;
    expect(Object.getOwnPropertyDescriptor(nestedReplies, '__proto__').value)
      .to.equal(protoValue);
    expect(nestedReplies.first).to.equal(1);
    expect(splitReplies).to.deep.equal({ first: 1, second: 2 });
  });

  it('flattens only own enumerable string properties from nested results', function() {
    const symbol = Symbol('ignored');
    const protoValue = { safe: true };
    const nestedResult = Object.assign(Object.create({ inherited: 'ignored' }), {
      owned: 'response',
      [symbol]: 'ignored'
    });
    Object.defineProperty(nestedResult, 'hidden', { value: 'ignored' });
    Object.defineProperty(nestedResult, '__proto__', {
      enumerable: true,
      value: protoValue
    });
    const context = {
      request(name) {
        return typeof name === 'object' ? Requests.request.call(this, name) : nestedResult;
      }
    };

    const replies = context.request({ 'first second': 'argument' });

    expect(replies.owned).to.equal('response');
    expect(replies).to.not.have.property('inherited');
    expect(replies).to.not.have.property('hidden');
    expect(replies).to.not.have.property(symbol);
    expect(Object.getPrototypeOf(replies)).to.equal(Object.prototype);
    expect(Object.hasOwn(replies, '__proto__')).to.be.true;
    expect(Object.getOwnPropertyDescriptor(replies, '__proto__').value)
      .to.equal(protoValue);
  });
});
