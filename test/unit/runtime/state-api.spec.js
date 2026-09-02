import StateApi, { setStateApi } from '../../../runtime/state-api';
import MarionetteError from '../../../utils/error';

describe('StateApi', function() {
  it('diagnoses observation with the non-observable plain-object default', function() {
    expect(() => StateApi.subscribe({}, 'change', () => {}))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
  });

  it('isolates repeated class-level overlays', function() {
    const Parent = function() {};
    Parent.prototype.State = StateApi;
    const Child = function() {};
    Child.prototype = Object.create(Parent.prototype);
    Child.setStateApi = setStateApi;

    Child.setStateApi({ first: true });
    Child.setStateApi({ second: true });

    expect(Child.prototype.State).to.include({ first: true, second: true });
    expect(Parent.prototype.State).to.equal(StateApi);
  });
});
