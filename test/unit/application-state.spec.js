import Application from '../../modules/application';

describe('Application state source composition', function() {
  it('preserves borrowed state across stop and restart without disposing it', async function() {
    const state = { count: 1 };
    const disposeOwned = this.sinon.spy();
    const StatefulApplication = Application.extend({});
    StatefulApplication.setStateApi({ disposeOwned });
    const app = new StatefulApplication({ state });

    await app.start();
    state.count = 2;
    await app.stop();
    await app.restart();

    expect(app.getState()).to.equal(state);
    expect(state.count).to.equal(2);
    expect(disposeOwned).to.not.have.been.called;
    await app.destroy();
    expect(disposeOwned).to.not.have.been.called;
  });

  it('disposes owned factory state only at Application destroy', async function() {
    const state = {};
    const disposeOwned = this.sinon.spy();
    const StatefulApplication = Application.extend({ createState() { return state; } });
    StatefulApplication.setStateApi({ disposeOwned });
    const app = new StatefulApplication();

    app.getState();
    await app.start();
    await app.stop();
    await app.restart();
    expect(disposeOwned).to.not.have.been.called;

    await app.destroy();
    expect(disposeOwned).to.have.been.calledOnce.and.calledWith(state);
  });
});
