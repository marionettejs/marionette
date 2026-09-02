import StateApi from '../../../runtime/state-api';
import MnObject from '../../../modules/object';
import MarionetteError from '../../../utils/error';

describe('StateApi', function() {
  it('diagnoses observation with the non-observable plain-object default', function() {
    expect(() => StateApi.subscribe({}, 'change', () => {}))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
  });

  it('isolates repeated class-level overlays', function() {
    const source = {};
    const subscribe = this.sinon.stub().returns(() => {});
    const disposeOwned = this.sinon.spy();
    const Parent = MnObject.extend({ stateEvents: { change() {} } });
    const Child = Parent.extend({ createState() { return source; } });
    Child.setStateApi({ subscribe });
    Child.setStateApi({ disposeOwned });

    const child = new Child();
    expect(subscribe).to.have.been.calledOnce;
    child.destroy();
    expect(disposeOwned).to.have.been.calledOnceWith(source);

    expect(() => new Parent())
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
  });
});
