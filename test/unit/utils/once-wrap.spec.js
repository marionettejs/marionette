import { vi, describe, it, expect } from 'vitest';
import onceWrap from '../../../packages/utils/src/once-wrap.ts';

describe('onceWrap', function() {
  it('unbinds before invoking the callback and memoizes its result', function() {
    const context = {};
    const calls = [];
    const callback = vi.fn().mockImplementation(function(...args) {
      calls.push('callback');
      expect(this).to.equal(context);
      expect(args).to.deep.equal([1, 2]);
      return 'result';
    });
    const offCallback = vi.fn().mockImplementation(wrapper => {
      calls.push('off');
      expect(wrapper).to.equal(onceCallback);
    });
    const onceCallback = onceWrap(callback, offCallback);

    expect(onceCallback._callback).to.equal(callback);
    expect(onceCallback.call(context, 1, 2)).to.equal('result');
    expect(onceCallback.call({}, 3)).to.equal('result');
    expect(calls).to.deep.equal(['off', 'callback']);
    expect(offCallback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('is consumed before cleanup and callback reentrancy', function() {
    const callback = vi.fn().mockImplementation(() => onceCallback());
    const offCallback = vi.fn().mockImplementation(() => onceCallback());
    const onceCallback = onceWrap(callback, offCallback);

    expect(onceCallback()).to.be.undefined;
    expect(offCallback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not retry after cleanup throws', function() {
    const error = new Error('cleanup');
    const callback = vi.fn();
    const onceCallback = onceWrap(callback, () => { throw error; });

    expect(() => onceCallback()).to.throw(error);
    expect(onceCallback()).to.be.undefined;
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not retry after the callback throws', function() {
    const error = new Error('callback');
    const offCallback = vi.fn();
    const onceCallback = onceWrap(() => { throw error; }, offCallback);

    expect(() => onceCallback()).to.throw(error);
    expect(onceCallback()).to.be.undefined;
    expect(offCallback).toHaveBeenCalledTimes(1);
  });
});
