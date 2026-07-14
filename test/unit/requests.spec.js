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
});
