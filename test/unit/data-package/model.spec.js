import { vi, describe, it, expect } from 'vitest';
import { Collection, Model, triggerMethod } from '../../../packages/data/src/index.ts';

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
    expect(model.toObject()).to.deep.equal({ enabled: true, id: 1, name: 'one' });
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
    const nameChange = vi.fn();
    const idChange = vi.fn();
    const change = vi.fn();
    model.on('change:name', nameChange);
    model.on('change:id', idChange);
    model.on('change', change);

    expect(model.set('name', 'one')).to.equal(model);
    expect(model.changed).to.deep.equal({});
    expect(change).not.toHaveBeenCalled();

    model.set({ id: 2, name: 'two' }, { source: 'set' });
    expect(model.id).to.equal(2);
    expect(nameChange).toHaveBeenCalledTimes(1);
    expect(nameChange.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, 'two']);
    expect(idChange).toHaveBeenCalledTimes(1);
    expect(idChange.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, 2]);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change.mock.calls.at(0)[1]).to.deep.include({ source: 'set' });
    expect(change.mock.calls.at(0)[1].previous).to.deep.equal({ id: 1, name: 'one' });

    model.unset('name');
    expect(model.has('name')).to.be.false;
    model.clear({ silent: true });
    expect(model.toObject()).to.deep.equal({});
    model.reset({ id: 3 });
    expect(model.toObject()).to.deep.equal({ id: 3 });
  });

  it('treats missing mutation keys and attributes as no-ops', function() {
    const model = new Model({ id: 1 });
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
    expect(model.toObject()).to.deep.equal({ '  ': 'value' });
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
    const change = vi.fn();
    model.on('change change:name', change);

    model.set('name', 'two', { silent: true });
    model.unset('name', { silent: true });
    model.reset({ name: 'three' }, { silent: true });
    model.clear({ silent: true });

    expect(change).not.toHaveBeenCalled();
  });

  it('treats null mutation options as no options', function() {
    const model = new Model({ first: 1 });

    expect(model.set({ second: 2 }, null)).to.equal(model);
    expect(model.set('third', 3, null)).to.equal(model);
    expect(model.unset('first', null)).to.equal(model);
    expect(model.reset({ fourth: 4 }, null)).to.equal(model);
    expect(model.clear(null)).to.equal(model);
    expect(model.toObject()).to.deep.equal({});
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

  it('keeps collection lookup current when a member id changes', function() {
    const model = new Model({ id: 1 });
    const first = new Collection([model]);
    const second = new Collection([model]);

    model.set('id', 2);
    expect(first.get(1)).to.be.undefined;
    expect(first.get(2)).to.equal(model);
    expect(second.get(2)).to.equal(model);
    model.unset('id');
    expect(first.get(2)).to.be.undefined;
    expect(first.get(model.cid)).to.equal(model);
    first.destroy();
    second.destroy();
    expect(model.isDestroyed()).to.be.false;
  });

  it('copies an own __proto__ attribute without changing object prototypes', function() {
    const attributes = { name: 'safe' };
    const value = { polluted: true };
    Object.defineProperty(attributes, '__proto__', { enumerable: true, value });

    const model = new Model(attributes);
    const serialized = model.toObject();

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
    const once = vi.fn();
    const all = vi.fn();
    const onSave = vi.fn().mockReturnValue('saved');
    model.onSave = onSave;

    model.on({ 'first second': handler }, context);
    model.once('first', once);
    model.on('all', all);
    model.trigger('first second', 'value');
    model.trigger('first');
    expect(context.calls).to.equal(3);
    expect(once).toHaveBeenCalledTimes(1);
    expect(once.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['value']);
    expect(all.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['first', 'value']);

    model.off('first second', handler, context);
    model.trigger('first second');
    expect(context.calls).to.equal(3);
    expect(triggerMethod.call(model, 'save', 1)).to.equal('saved');
    expect(onSave.mock.calls.map(args => args.slice(0, 1))).toContainEqual([1]);
  });

  it('destroys once after notifying observers', function() {
    const model = new Model();
    const destroy = vi.fn();
    model.on('destroy', destroy);

    expect(model.destroy({ source: 'test' })).to.equal(model);
    const finalChange = model.changed;
    expect(model.destroy()).to.equal(model);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, { source: 'test' }]);
    expect(model.isDestroyed()).to.be.true;
    expect(model.set('ignored', true)).to.equal(model);
    expect(model.set(null)).to.equal(model);
    expect(model.changed).to.equal(finalChange);
    expect(model.has('ignored')).to.be.false;
  });

  it('does not evaluate defaults when resetting a destroyed model', function() {
    const defaults = vi.fn().mockReturnValue({ ready: false });
    const StatefulModel = Model.extend({ defaults });
    const model = new StatefulModel();

    model.destroy();
    expect(model.reset()).to.equal(model);
    expect(defaults).toHaveBeenCalledTimes(1);
  });

});
