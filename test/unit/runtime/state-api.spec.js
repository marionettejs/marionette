import { vi, describe, it, expect } from 'vitest';
import { StateApi } from 'marionette';
import { MnObject } from 'marionette';
import { MarionetteError } from '@marionette/utils';

describe('StateApi', function() {
  it('diagnoses observation with the non-observable plain-object default', function() {
    expect(() => StateApi.subscribe({}, 'change', () => {}))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
  });

  describe('#setStateApi', function() {
    it('isolates repeated class-level overlays', function() {
      const source = {};
      const subscribe = vi.fn().mockReturnValue(() => {});
      const disposeOwned = vi.fn();
      const Parent = MnObject.extend({ stateEvents: { change() {} } });
      const Child = Parent.extend({ createState() { return source; } });
      Child.setStateApi({ subscribe });
      Child.setStateApi({ disposeOwned });

      const child = new Child();
      expect(subscribe).toHaveBeenCalledTimes(1);
      child.destroy();
      expect(disposeOwned).toHaveBeenCalledTimes(1);
      expect(disposeOwned.mock.calls.map(args => args.slice(0, 1))).toContainEqual([source]);

      expect(() => new Parent())
        .to.throw(MarionetteError)
        .and.include({ code: 'MN0037' });
    });
  });
});
