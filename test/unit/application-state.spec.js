import { vi, describe, it, expect } from 'vitest';
import { Application } from 'marionette';

describe('Application state source composition', function() {
  it('preserves borrowed state across stop and restart without disposing it', async function() {
    const state = { count: 1 };
    const disposeOwned = vi.fn();
    const StatefulApplication = Application.extend({});
    StatefulApplication.setStateApi({ disposeOwned });
    const app = new StatefulApplication({ state });

    await app.start();
    state.count = 2;
    await app.stop();
    await app.restart();

    expect(app.getState()).to.equal(state);
    expect(state.count).to.equal(2);
    expect(disposeOwned).not.toHaveBeenCalled();
    await app.destroy();
    expect(disposeOwned).not.toHaveBeenCalled();
  });

  it('disposes owned factory state only at Application destroy', async function() {
    const state = {};
    const disposeOwned = vi.fn();
    const StatefulApplication = Application.extend({ createState() { return state; } });
    StatefulApplication.setStateApi({ disposeOwned });
    const app = new StatefulApplication();

    app.getState();
    await app.start();
    await app.stop();
    await app.restart();
    expect(disposeOwned).not.toHaveBeenCalled();

    await app.destroy();
    expect(disposeOwned).toHaveBeenCalledTimes(1);
    expect(disposeOwned.mock.calls.map(args => args.slice(0, 1))).toContainEqual([state]);
  });
});
