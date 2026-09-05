import subscribeBindings, { normalizeCleanup } from '../../../utils/subscribe-bindings';

describe('subscribe bindings', function() {
  it('normalizes an adapter cleanup function as idempotent', function() {
    const dispose = this.sinon.spy();
    const normalized = normalizeCleanup(dispose, 'TestApi.subscribe');

    normalized();
    normalized();

    expect(dispose).to.have.been.calledOnce;
  });

  it('normalizes aggregate binding cleanup as idempotent', function() {
    const dispose = this.sinon.spy();
    const context = { onChange() {} };
    const cleanup = subscribeBindings(
      context,
      { subscribe() { return dispose; } },
      {},
      { change: 'onChange' },
      'TestApi'
    );

    cleanup();
    cleanup();

    expect(dispose).to.have.been.calledOnce;
  });
  it('releases subscriptions when a synchronous callback destroys the context', function() {
    const calls = [];
    const context = { onChange() { this._isDestroyed = true; } };
    const cleanup = subscribeBindings(context, {
      subscribe(source, name, callback, eventContext) {
        calls.push(name);
        callback.call(eventContext);
        return () => calls.push('cleanup');
      }
    }, {}, { first: 'onChange', second: 'onChange' }, 'TestApi');

    cleanup();
    expect(calls).to.deep.equal(['first', 'cleanup']);
  });

});
