import { Collection, Model, triggerMethod } from '../../../packages/data/src/index.js';

describe('@marionette/data Model', function() {
  it('initializes defaults, identity, attributes, and subclasses', function() {
    const CustomModel = Model.extend({
      defaults() { return { enabled: true }; },
      initialize(attributes, options) {
        this.initializedWith = [attributes, options];
        this.initialChanged = this.changed;
      }
    }, { category: 'custom' });
    const attributes = { id: 1, name: 'one' };
    const options = { source: 'test' };
    const model = new CustomModel(attributes, options);

    expect(model.cid).to.match(/^mnd\d+$/);
    expect(model.id).to.equal(1);
    expect(model.toJSON()).to.deep.equal({ enabled: true, id: 1, name: 'one' });
    expect(model.initializedWith).to.deep.equal([attributes, options]);
    expect(model.initialChanged).to.deep.equal({});
    expect(model.changed).to.deep.equal({});
    expect(CustomModel.category).to.equal('custom');
    expect(model).to.be.instanceOf(Model);

    class FieldDefaultsModel extends Model {
      defaults = { ignoredDuringConstruction: true };
    }
    const fieldDefaults = new FieldDefaultsModel();
    expect(fieldDefaults.get('ignoredDuringConstruction')).to.be.undefined;
    expect(fieldDefaults.defaults).to.deep.equal({ ignoredDuringConstruction: true });
  });

  it('sets, unsets, clears, and resets attributes with exact change events', function() {
    const model = new Model({ id: 1, name: 'one' });
    const nameChange = this.sinon.spy();
    const idChange = this.sinon.spy();
    const change = this.sinon.spy();
    model.on('change:name', nameChange);
    model.on('change:id', idChange);
    model.on('change', change);

    expect(model.set('name', 'one')).to.equal(model);
    expect(model.changed).to.deep.equal({});
    expect(change).to.not.have.been.called;

    model.set({ id: 2, name: 'two' }, { source: 'set' });
    expect(model.id).to.equal(2);
    expect(nameChange).to.have.been.calledOnceWith(model, 'two');
    expect(idChange).to.have.been.calledOnceWith(model, 2);
    expect(change).to.have.been.calledOnce;
    expect(change.firstCall.args[1]).to.deep.include({ source: 'set' });
    expect(change.firstCall.args[1].previous).to.deep.equal({ id: 1, name: 'one' });

    model.unset('name');
    expect(model.has('name')).to.be.false;
    model.clear({ silent: true });
    expect(model.toJSON()).to.deep.equal({});
    model.reset({ id: 3 });
    expect(model.toJSON()).to.deep.equal({ id: 3 });
  });

  it('treats missing mutation keys and attributes as no-ops', function() {
    const model = new Model({ id: 1 });
    const primitive = new Model('ignored');
    const constructionChange = model.changed;

    expect(model.set(null)).to.equal(model);
    expect(model.changed).to.deep.equal({});
    expect(model.changed).to.not.equal(constructionChange);
    model.set('name', 'one');
    const nameChange = model.changed;
    expect(model.unset(null)).to.equal(model);
    expect(model.changed).to.deep.equal({});
    expect(model.changed).to.not.equal(nameChange);
    expect(model.unset('missing')).to.equal(model);
    expect(model.get('missing')).to.be.undefined;
    expect(model.reset({ id: 1 })).to.equal(model);
    expect(primitive.toJSON()).to.deep.equal({});
  });

  it('distinguishes own undefined values from absent values', function() {
    const model = new Model({ present: undefined });

    expect(model.has('present')).to.be.true;
    expect(model.get('present')).to.be.undefined;
    expect(model.has('absent')).to.be.false;
  });

  it('accepts whitespace keys as ordinary own properties', function() {
    const model = new Model();

    expect(model.set('  ', 'value')).to.equal(model);
    expect(model.has('  ')).to.be.true;
    expect(model.get('  ')).to.equal('value');
    expect(model.changed).to.deep.equal({ '  ': 'value' });
    expect(model.toJSON()).to.deep.equal({ '  ': 'value' });
  });

  it('preserves absence separately from own undefined in change snapshots', function() {
    const model = new Model();
    const changes = [];
    model.on('change', (changedModel, options) => changes.push(options));

    model.set('value', undefined);
    model.set('value', 'present');

    expect(Object.hasOwn(changes[0].changed, 'value')).to.be.true;
    expect(Object.hasOwn(changes[0].previous, 'value')).to.be.false;
    expect(Object.hasOwn(changes[1].previous, 'value')).to.be.true;
    expect(changes[1].previous.value).to.be.undefined;
  });

  it('does not emit for silent writes', function() {
    const model = new Model({ name: 'one' });
    const change = this.sinon.spy();
    model.on('change change:name', change);

    model.set('name', 'two', { silent: true });
    model.unset('name', { silent: true });
    model.reset({ name: 'three' }, { silent: true });
    model.clear({ silent: true });

    expect(change).to.not.have.been.called;
  });

  it('treats null mutation options as no options', function() {
    const model = new Model({ first: 1 });

    expect(model.set({ second: 2 }, null)).to.equal(model);
    expect(model.set('third', 3, null)).to.equal(model);
    expect(model.unset('first', null)).to.equal(model);
    expect(model.reset({ fourth: 4 }, null)).to.equal(model);
    expect(model.clear(null)).to.equal(model);
    expect(model.toJSON()).to.deep.equal({});
  });

  it('completes nested writes synchronously as independent changes', function() {
    const model = new Model({ first: 0, second: 0 });
    const changes = [];
    model.on('change:first', () => {
      changes.push(['first', model.get('first'), model.get('second')]);
      model.set('second', 2);
    });
    model.on('change:second', () => {
      changes.push(['second', model.get('first'), model.get('second')]);
    });
    model.on('change', (changedModel, options) => {
      changes.push(['change', Object.keys(options.changed)]);
    });

    model.set('first', 1);

    expect(changes).to.deep.equal([
      ['first', 1, 0],
      ['second', 1, 2],
      ['change', ['second']],
      ['change', ['first']]
    ]);
  });

  it('keeps ids stable while a Model belongs to a Collection', function() {
    const model = new Model({ id: 1 });
    const first = new Collection([model]);
    const second = new Collection([model]);

    expect(() => model.set('id', 2)).to.throw(TypeError, 'cannot change a Model id');
    expect(() => model.unset('id')).to.throw(TypeError, 'cannot change a Model id');
    expect(model.id).to.equal(1);
    model.idAttribute = 'uuid';
    expect(() => model.set('name', 'blocked')).to.throw(TypeError, 'cannot change a Model id');
    model.idAttribute = 'id';
    first.remove(model);
    expect(() => model.set('id', 2)).to.throw(TypeError, 'cannot change a Model id');
    second.remove(model);
    expect(model.set('id', 2)).to.equal(model);
    expect(model.id).to.equal(2);

    const keyless = new Model({ id: null });
    const keylessOwner = new Collection([keyless]);
    expect(keyless.unset('id')).to.equal(keyless);
    expect(keyless.id).to.be.undefined;
    expect(keyless.set('id', null)).to.equal(keyless);
    expect(keyless.id).to.be.null;
    keylessOwner.destroy();
    first.destroy();
    second.destroy();
  });

  it('copies an own __proto__ attribute without changing object prototypes', function() {
    const attributes = { name: 'safe' };
    const value = { polluted: true };
    Object.defineProperty(attributes, '__proto__', { enumerable: true, value });

    const model = new Model(attributes);
    const serialized = model.toJSON();

    expect(Object.getPrototypeOf(model.attributes)).to.equal(Object.prototype);
    expect(Object.getPrototypeOf(serialized)).to.equal(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(serialized, '__proto__').value).to.equal(value);
    serialized.name = 'changed';
    expect(model.get('name')).to.equal('safe');
  });

  it('supports event maps, contexts, once, all, removal, and triggerMethod', function() {
    const model = new Model();
    const context = { calls: 0 };
    const handler = function() { this.calls++; };
    const once = this.sinon.spy();
    const all = this.sinon.spy();
    const onSave = this.sinon.stub().returns('saved');
    model.onSave = onSave;

    model.on({ 'first second': handler }, context);
    model.once('first', once);
    model.on('all', all);
    model.trigger('first second', 'value');
    model.trigger('first');
    expect(context.calls).to.equal(3);
    expect(once).to.have.been.calledOnceWith('value');
    expect(all).to.have.been.calledWith('first', 'value');

    model.off('first second', handler, context);
    model.trigger('first second');
    expect(context.calls).to.equal(3);
    expect(triggerMethod.call(model, 'save', 1)).to.equal('saved');
    expect(onSave).to.have.been.calledWith(1);
  });

  it('destroys once after notifying observers', function() {
    const model = new Model();
    const destroy = this.sinon.spy();
    model.on('destroy', destroy);

    expect(model.destroy({ source: 'test' })).to.equal(model);
    const finalChange = model.changed;
    expect(model.destroy()).to.equal(model);
    expect(destroy).to.have.been.calledOnceWith(model, { source: 'test' });
    expect(model.isDestroyed()).to.be.true;
    expect(model.set('ignored', true)).to.equal(model);
    expect(model.set(null)).to.equal(model);
    expect(model.changed).to.equal(finalChange);
    expect(model.has('ignored')).to.be.false;
  });

  it('does not evaluate defaults when resetting a destroyed model', function() {
    const defaults = this.sinon.stub().returns({ ready: false });
    const StatefulModel = Model.extend({ defaults });
    const model = new StatefulModel();

    model.destroy();
    expect(model.reset()).to.equal(model);
    expect(defaults).to.have.been.calledOnce;
  });

  it('releases owned listeners when construction or destruction throws', function() {
    const source = new Model();
    const constructionCallback = this.sinon.spy();
    const constructionError = new Error('construction failed');
    const cleanupError = new Error('cleanup failed');
    const BrokenModel = Model.extend({
      initialize() {
        this.listenTo(source, 'change', constructionCallback);
        throw constructionError;
      },
      off() { throw cleanupError; }
    });

    expect(() => new BrokenModel()).to.throw(constructionError);
    source.set('phase', 'after-construction');
    expect(constructionCallback).to.not.have.been.called;

    const failedCollection = new Collection();
    const unbindingError = new Error('unbinding failed');
    const OwnedDuringConstruction = Model.extend({
      initialize() {
        failedCollection.add(this);
        throw constructionError;
      },
      off() { throw unbindingError; }
    });
    expect(() => new OwnedDuringConstruction()).to.throw(constructionError);
    expect(failedCollection.length).to.equal(0);
    failedCollection.destroy();

    const model = new Model();
    const destructionCallback = this.sinon.spy();
    const destructionError = new Error('destruction failed');
    model.listenTo(source, 'change', destructionCallback);
    model.on('destroy', () => { throw destructionError; });

    expect(() => model.destroy()).to.throw(destructionError);
    source.set('phase', 'after-destruction');
    expect(destructionCallback).to.not.have.been.called;
    expect(model.isDestroyed()).to.be.true;
  });
});
