import disposeAll from '../../../src/utils/dispose-all.ts';

function captureError(callback) {
  try {
    callback();
    return { threw: false };
  } catch (error) {
    return { threw: true, error };
  }
}

describe('disposeAll', function() {
  const falsyErrors = [undefined, null, false, 0, 0n, '', NaN];

  it('runs cleanup in reverse order and skips absent registrations', function() {
    const calls = [];

    const result = disposeAll([
      () => calls.push('first'),
      undefined, null, false, 0, 0n, '', NaN,
      () => calls.push('last')
    ]);

    expect(calls).to.deep.equal(['last', 'first']);
    expect(result).to.be.undefined;
  });

  it('preserves an explicitly supplied falsy error while attempting every cleanup', function() {
    for (const error of falsyErrors) {
      const calls = [];
      const caught = captureError(() => disposeAll([
        () => calls.push('first'),
        () => { throw new Error('cleanup failure'); },
        () => calls.push('last')
      ], error));

      expect(caught.threw).to.be.true;
      expect(Object.is(caught.error, error)).to.be.true;
      expect(calls).to.deep.equal(['last', 'first']);
    }
  });

  it('retains the first thrown cleanup error even when it is falsy', function() {
    for (const error of falsyErrors) {
      const calls = [];
      const caught = captureError(() => disposeAll([
        () => calls.push('first'),
        () => { throw new Error('later failure'); },
        () => calls.push('last'),
        () => { throw error; }
      ]));

      expect(caught.threw).to.be.true;
      expect(Object.is(caught.error, error)).to.be.true;
      expect(calls).to.deep.equal(['last', 'first']);
    }
  });

  it('distinguishes an omitted error from an explicitly supplied undefined error', function() {
    expect(captureError(() => disposeAll([]))).to.deep.equal({ threw: false });
    expect(captureError(() => disposeAll([], undefined))).to.deep.equal({ threw: true, error: undefined });
  });
});
