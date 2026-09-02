import subscribeBindings, { normalizeDisposer } from '../../../utils/subscribe-bindings';

describe('subscribe bindings', function() {
  it('normalizes an adapter disposer as idempotent', function() {
    const dispose = this.sinon.spy();
    const normalized = normalizeDisposer(dispose, 'TestApi.subscribe');

    normalized();
    normalized();

    expect(dispose).to.have.been.calledOnce;
  });

  it('normalizes aggregate binding cleanup as idempotent', function() {
    const dispose = this.sinon.spy();
    const context = { onChange() {} };
    const unsubscribe = subscribeBindings(
      context,
      { subscribe() { return dispose; } },
      {},
      { change: 'onChange' },
      'TestApi'
    );

    unsubscribe();
    unsubscribe();

    expect(dispose).to.have.been.calledOnce;
  });
});
