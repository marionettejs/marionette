import DataApi, { setDataApi } from '../../../runtime/data-api';
import MarionetteError from '../../../utils/error';

describe('DataApi', function() {
  describe('#setDataApi', function() {
    it('returns the receiving class and overlays own properties', function() {
      const inherited = { inherited: true };
      const mixin = Object.assign(Object.create(inherited), { get: this.sinon.stub() });
      const MyObject = function() {};
      MyObject.prototype.Data = DataApi;
      MyObject.setDataApi = setDataApi;

      expect(MyObject.setDataApi(mixin)).to.equal(MyObject);
      expect(MyObject.prototype.Data.get).to.equal(mixin.get);
      expect(MyObject.prototype.Data).to.not.have.property('inherited');
      expect(MyObject.prototype.Data).to.not.equal(DataApi);
    });

    it('isolates repeated overlays to the receiving class', function() {
      const Parent = function() {};
      Parent.prototype.Data = DataApi;
      const Child = function() {};
      Child.prototype = Object.create(Parent.prototype);
      Child.setDataApi = setDataApi;

      Child.setDataApi({ first: true });
      Child.setDataApi({ second: true });

      expect(Child.prototype.Data).to.include({ first: true, second: true });
      expect(Parent.prototype.Data).to.equal(DataApi);
    });
  });

  it('uses plain object and array data without adaptation', function() {
    const present = { value: undefined };
    const items = [{ name: 'one' }, { name: 'two' }];

    expect(DataApi.key(items[0])).to.equal(items[0]);
    expect(DataApi.get(items[0], 'name')).to.equal('one');
    expect(DataApi.get({}, 'constructor')).to.be.undefined;
    expect(DataApi.get({ constructor: 'value' }, 'constructor')).to.equal('value');
    expect(DataApi.has(present, 'value')).to.be.true;
    expect(DataApi.has({}, 'value')).to.be.false;
    expect(DataApi.has({}, 'constructor')).to.be.false;
    expect(DataApi.has(null, 'value')).to.be.false;
    expect(DataApi.has(undefined, 'value')).to.be.false;
    expect(DataApi.serialize(items[0])).to.equal(items[0]);
    expect(DataApi.items(items)).to.equal(items);
  });

  it('subscribes to Marionette-compatible events with idempotent teardown', function() {
    const entity = { on: this.sinon.spy(), off: this.sinon.spy() };
    const callback = this.sinon.spy();
    const context = {};
    const unsubscribe = DataApi.subscribe(entity, 'change', callback, context);

    expect(entity.on).to.have.been.calledOnce.and.calledWith('change', callback, context);
    unsubscribe();
    unsubscribe();
    expect(entity.off).to.have.been.calledOnce.and.calledWith('change', callback, context);
  });

  it('treats plain collections as non-observable', function() {
    const unsubscribe = DataApi.observeCollection([]);
    expect(unsubscribe).to.be.a('function');
    expect(() => unsubscribe()).to.not.throw();
  });

  it('diagnoses event observation on plain values', function() {
    expect(() => DataApi.subscribe({}, 'change', () => {}))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
    expect(() => DataApi.observeCollection({ items: [] }, () => {}))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0037' });
  });
});
