import { vi, describe, it, expect } from 'vitest';
import callHandler from '../../../packages/utils/src/call-handler.ts';

describe('callHandler', function() {
  it('applies callbacks with more than three arguments', function() {
    const context = {};
    const callback = vi.fn().mockReturnValue('result');

    expect(callHandler(callback, context, [1, 2, 3, 4])).to.equal('result');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.contexts).toContain(context);
    expect(callback.mock.calls.map(args => args.slice(0, 4))).toContainEqual([1, 2, 3, 4]);
  });
});
