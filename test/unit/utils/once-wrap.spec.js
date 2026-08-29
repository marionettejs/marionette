import onceWrap from '../../../utils/once-wrap';

describe('onceWrap', function() {
  it('unbinds before invoking the callback and memoizes its result', function() {
    const context = {};
    const calls = [];
    const callback = this.sinon.stub().callsFake(function(...args) {
      calls.push('callback');
      expect(this).to.equal(context);
      expect(args).to.deep.equal([1, 2]);
      return 'result';
    });
    const offCallback = this.sinon.stub().callsFake(wrapper => {
      calls.push('off');
      expect(wrapper).to.equal(onceCallback);
    });
    const onceCallback = onceWrap(callback, offCallback);

    expect(onceCallback._callback).to.equal(callback);
    expect(onceCallback.call(context, 1, 2)).to.equal('result');
    expect(onceCallback.call({}, 3)).to.equal('result');
    expect(calls).to.deep.equal(['off', 'callback']);
    expect(offCallback).to.have.been.calledOnce;
    expect(callback).to.have.been.calledOnce;
  });

  it('is consumed before cleanup and callback reentrancy', function() {
    const callback = this.sinon.stub().callsFake(() => onceCallback());
    const offCallback = this.sinon.stub().callsFake(() => onceCallback());
    const onceCallback = onceWrap(callback, offCallback);

    expect(onceCallback()).to.be.undefined;
    expect(offCallback).to.have.been.calledOnce;
    expect(callback).to.have.been.calledOnce;
  });

  it('does not retry after cleanup throws', function() {
    const error = new Error('cleanup');
    const callback = this.sinon.stub();
    const onceCallback = onceWrap(callback, () => { throw error; });

    expect(() => onceCallback()).to.throw(error);
    expect(onceCallback()).to.be.undefined;
    expect(callback).to.not.have.been.called;
  });

  it('does not retry after the callback throws', function() {
    const error = new Error('callback');
    const offCallback = this.sinon.stub();
    const onceCallback = onceWrap(() => { throw error; }, offCallback);

    expect(() => onceCallback()).to.throw(error);
    expect(onceCallback()).to.be.undefined;
    expect(offCallback).to.have.been.calledOnce;
  });
});
