import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Collection, DataApi, Model } from '@marionette/data';

describe('@marionette/data Collection', function() {
  let collection;
  let changes;
  let dispose;

  beforeEach(function() {
    collection = new Collection([{ id: 1, name: 'one' }, { id: 2, name: 'two' }]);
    changes = [];
    dispose = DataApi.observeCollection(collection, change => changes.push(change));
  });

  afterEach(function() {
    dispose();
    collection.destroy();
  });

  it('provides ordered collection access and iteration', function() {
    expect(collection.length).to.equal(2);
    expect(collection.at(0)).to.equal(collection.get(1));
    expect(collection.indexOf(collection.get(2))).to.equal(1);
    expect(collection.map(entry => entry.id)).to.deep.equal([1, 2]);
    const ids = [];
    collection.forEach(model => ids.push(model.id));
    expect(ids).to.deep.equal([1, 2]);
    expect([...collection].map(model => model.id)).to.deep.equal([1, 2]);
    expect(collection.toArray()).to.deep.equal([
      { id: 1, name: 'one' },
      { id: 2, name: 'two' }
    ]);
  });

  it('adds and removes exact models with one normalized change each', function() {
    const add = vi.fn();
    const remove = vi.fn();
    const update = vi.fn();
    collection.on('add', add);
    collection.on('remove', remove);
    collection.on('update', update);
    const third = collection.add({ id: 3, name: 'three' }, { at: 1 });

    expect(third).to.be.instanceOf(Model);
    expect(collection.map(model => model.id)).to.deep.equal([1, 3, 2]);
    expect(changes).to.deep.equal([
      { kind: 'update', added: [third], removed: [], updated: [] }
    ]);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.map(args => args.slice(0, 2))).toContainEqual([third, collection]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls.at(0)[1].changes).to.equal(changes[0]);

    expect(collection.add({ id: 3 })).toBeUndefined();
    expect(collection.remove(3)).to.equal(third);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.map(args => args.slice(0, 2))).toContainEqual([third, collection]);
    expect(changes[1]).to.deep.equal({
      kind: 'update', added: [], removed: [third], updated: []
    });
    expect(update.mock.calls.at(1)[1].changes).to.equal(changes[1]);
  });

  it('deduplicates additions in one linear batch', function() {
    const third = new Model({ id: 3 });
    const added = collection.add([third, third, { id: 3 }, { id: 4 }]);

    expect(added.map(model => model.id)).to.deep.equal([3, 4]);
    expect(added[0]).to.equal(third);
    expect(collection.map(model => model.id)).to.deep.equal([1, 2, 3, 4]);
  });

  it('does not construct models for duplicate raw identities', function() {
    let initializeCount = 0;
    const CountingModel = Model.extend({
      idAttribute: 'uuid',
      initialize() {
        initializeCount++;
      }
    });
    const counted = new Collection([{ uuid: 1 }], { model: CountingModel });

    const added = counted.add([
      { uuid: 1 },
      { uuid: 2 },
      { uuid: 2 },
      { name: 'keyless' }
    ]);

    expect(added.map(model => model.id)).to.deep.equal([2, undefined]);
    expect(initializeCount).to.equal(3);
    counted.destroy();
  });

  it('preserves supplied Model subclasses through construction, add, and reset', function() {
    const Input = Model.extend({ inputOnly() { return this.get('label'); } });
    const Factory = Model.extend({ idAttribute: 'uuid' });
    const first = new Input({ id: 7, label: 'seven' });
    const second = new Model({ id: 8, label: 'eight' });
    const custom = new Collection([first], { model: Factory });
    expect(custom.at(0)).to.equal(first);
    expect(custom.add(second)).to.equal(second);
    expect(custom.add({ uuid: 9 })).to.be.instanceOf(Factory);
    custom.reset([second, first]);
    expect(custom.toArray()).to.deep.equal([
      { id: 8, label: 'eight' }, { id: 7, label: 'seven' }
    ]);
    const changed = vi.fn();
    custom.on('change:label', changed);
    first.set('label', 'SEVEN');
    expect(changed).toHaveBeenCalledTimes(1);
    first.destroy();
    expect(custom.models).to.deep.equal([second]);
    custom.destroy();
    expect(second.isDestroyed()).toBe(false);
  });

  it('uses exact instance, id, then cid precedence independently of order', function() {
    const first = new Model({ id: 1 });
    const second = new Model({ id: first.cid });
    const third = new Model({ id: first });
    collection.reset([first, second, third]);
    expect(collection.get(first.cid)).to.equal(second);
    expect(collection.get(first)).to.equal(first);
    collection.move(second, 0);
    expect(collection.get(first.cid)).to.equal(second);
    expect(collection.get(first)).to.equal(first);
    expect(collection.remove([first.cid, first])).to.deep.equal([second, first]);
    expect(collection.models).to.deep.equal([third]);
    expect(collection.get(first)).to.equal(third);
  });

  it('resolves mixed bulk identities against current ids and preserves removal order', function() {
    const first = collection.at(0);
    const second = collection.at(1);
    const third = collection.add({ id: NaN });
    first.set('id', 10, { silent: true });
    expect(collection.remove([null, undefined, 'missing', second.cid, third, 10, first]))
      .to.deep.equal([second, third, first]);
    expect(collection.length).to.equal(0);
  });

  it('keeps first-id lookup consistent for single and bulk removal after duplicate id writes', function() {
    const first = collection.at(0);
    const second = collection.at(1);
    second.set('id', first.id);
    expect(collection.get(first.id)).to.equal(first);
    expect(collection.remove([first.id, 'missing'])).to.deep.equal([first]);
    expect(collection.models).to.deep.equal([second]);
  });

  it('handles array, keyless, custom-model, and empty mutation boundaries', function() {
    const CustomModel = Model.extend({});
    const custom = new Collection(null, { model: CustomModel });
    const keyless = new CustomModel({ name: 'keyless' });

    expect(custom.add(null)).toBeUndefined();
    expect(custom.add([])).to.deep.equal([]);
    expect(custom.add([keyless, keyless])).to.deep.equal([keyless]);
    expect(custom.remove([keyless, keyless])).to.deep.equal([keyless]);
    expect(custom.remove([])).to.deep.equal([]);
    expect(custom.reset(null)).to.equal(custom);

    custom.destroy();
  });

  it('does not resolve nullish identities to a keyless Model', function() {
    const keyless = new Model({ name: 'keyless' });
    collection.reset([keyless], { silent: true });

    expect(collection.get(null)).toBeUndefined();
    expect(collection.get(undefined)).toBeUndefined();
    expect(collection.remove(undefined)).toBeUndefined();
    expect(collection.move(null, 0)).toBeUndefined();
    expect(collection.models).to.deep.equal([keyless]);
  });

  it('uses SameValueZero matching for NaN ids', function() {
    const model = new Model({ id: NaN, name: 'one' });
    collection.reset([model], { silent: true });

    expect(collection.get(NaN)).to.equal(model);
    expect(collection.add({ id: NaN })).toBeUndefined();
    model.set('name', 'two');
    expect(collection.remove(NaN)).to.equal(model);
  });

  it('treats null construction and mutation options as no options', function() {
    const custom = new Collection([], null);
    const first = custom.add({ id: 1 }, null);
    const second = custom.add({ id: 2 }, null);

    expect(custom.move(first, 1, null)).to.equal(first);
    expect(custom.sort('id', null)).to.equal(custom);
    expect(custom.remove(second, null)).to.equal(second);
    expect(custom.reset([], null)).to.equal(custom);
    custom.destroy();
  });

  it('rejects duplicate reset snapshots without changing membership', function() {
    const first = collection.get(1);
    const second = collection.get(2);

    expect(() => collection.reset([first, first])).to.throw(TypeError, 'unique instances and ids');
    expect(() => collection.reset([{ id: 3 }, { id: 3 }]))
      .to.throw(TypeError, 'unique instances and ids');
    expect(collection.models).to.deep.equal([first, second]);
    expect(changes).to.deep.equal([]);
  });

  it('resets, moves, and sorts with exact records', function() {
    const reset = vi.fn();
    const reorder = vi.fn();
    collection.on('reset', reset);
    collection.on('sort', reorder);

    collection.move(1, 1);
    expect(collection.map(model => model.id)).to.deep.equal([2, 1]);
    collection.move(2, 1);
    expect(collection.map(model => model.id)).to.deep.equal([1, 2]);
    collection.sort((left, right) => right.id - left.id);
    expect(collection.map(model => model.id)).to.deep.equal([2, 1]);
    collection.sort('name');
    expect(collection.map(model => model.id)).to.deep.equal([1, 2]);
    collection.reset([{ id: 4 }]);

    expect(changes.map(change => change.kind)).to.deep.equal([
      'reorder', 'reorder', 'reorder', 'reorder', 'reset'
    ]);
    expect(reorder).toHaveBeenCalledTimes(4);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset.mock.calls.map(args => args.slice(0, 1))).toContainEqual([collection]);
  });

  it('re-emits model events without structural notifications', function() {
    const changeName = vi.fn();
    const onChangeName = vi.fn();
    collection.onChangeName = onChangeName;
    collection.on('change:name', changeName);
    const model = collection.get(1);

    model.set('name', 'ONE');
    expect(changeName).toHaveBeenCalledTimes(1);
    expect(changeName.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, 'ONE']);
    expect(onChangeName).toHaveBeenCalledTimes(1);
    expect(onChangeName.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, 'ONE']);
    expect(changes).to.deep.equal([]);
    model.destroy();
    expect(collection.get(1)).toBeUndefined();
    expect(changes[0].removed).to.deep.equal([model]);
  });

  it('removes a directly destroyed Model from every containing Collection', function() {
    const model = collection.get(1);
    const other = new Collection([model]);
    const otherChanges = [];
    const stopObserving = DataApi.observeCollection(other, change => otherChanges.push(change));

    model.destroy();

    expect(collection.get(1)).toBeUndefined();
    expect(other.get(1)).toBeUndefined();
    expect(changes[0].removed).to.deep.equal([model]);
    expect(otherChanges[0].removed).to.deep.equal([model]);
    stopObserving();
    other.destroy();
  });

  it('forwards model destruction options to collection removal', function() {
    const model = collection.get(1);
    const options = { source: 'editor' };
    const remove = vi.fn();
    const update = vi.fn();
    collection.on('remove', remove);
    collection.on('update', update);

    model.destroy(options);

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.map(args => args.slice(0, 3))).toContainEqual([model, collection, options]);
    expect(update.mock.calls.at(0)[1].source).to.equal('editor');
    expect(changes[0].removed).to.deep.equal([model]);
  });

  it('honors silent destruction for removal while still forwarding destroy', function() {
    const model = collection.get(1);
    const options = { silent: true };
    const destroy = vi.fn();
    const remove = vi.fn();
    collection.on('destroy', destroy);
    collection.on('remove', remove);

    model.destroy(options);

    expect(collection.get(1)).toBeUndefined();
    expect(remove).not.toHaveBeenCalled();
    expect(changes).to.deep.equal([]);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, options]);
  });

  it('notifies a collection once when another collection removes the destroyed Model first', function() {
    const model = collection.get(1);
    const other = new Collection([model]);
    const remove = vi.fn();
    const update = vi.fn();
    collection.on('remove', remove);
    collection.on('update', update);
    other.on('remove', () => collection.remove(model));

    model.destroy();

    expect(collection.get(1)).toBeUndefined();
    expect(other.get(1)).toBeUndefined();
    expect(changes).to.deep.equal([
      { kind: 'update', added: [], removed: [model], updated: [] }
    ]);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    other.destroy();
  });

  it('supports silent and no-op mutations', function() {
    const first = collection.get(1);
    expect(collection.move(first, 0)).to.equal(first);
    expect(() => collection.move(first, 1.5)).to.throw(TypeError, 'requires an integer index');
    expect(collection.move('missing', 0)).toBeUndefined();
    expect(collection.remove('missing')).toBeUndefined();
    expect(collection.sort()).to.equal(collection);
    collection.add({ id: 3 }, { silent: true });
    collection.remove(3, { silent: true });
    collection.move(first, 1, { silent: true });
    collection.sort((left, right) => right.id - left.id, { silent: true });
    collection.reset([], { silent: true });
    expect(changes).to.deep.equal([]);
  });

  it('emits sort even when the order remains unchanged, as Backbone does', function() {
    collection.sort('id');
    expect(collection.map(model => model.id)).to.deep.equal([1, 2]);
    expect(changes).to.deep.equal([{ kind: 'reorder' }]);
  });

  it('keeps stable order when sorting equal string values', function() {
    collection.reset([
      { id: 1, name: 'same' },
      { id: 2, name: 'zebra' },
      { id: 3, name: 'same' }
    ], { silent: true });

    collection.sort('name');
    expect(collection.map(model => model.id)).to.deep.equal([1, 3, 2]);
  });

  it('releases structural and model observation on idempotent destroy', function() {
    const destroy = vi.fn();
    const modelChange = vi.fn();
    const model = collection.get(1);
    collection.on('destroy', destroy);
    collection.on('change', modelChange);

    dispose();
    dispose();
    collection.destroy({ source: 'test' });
    collection.destroy();
    model.set('name', 'ignored by collection');
    collection.add({ id: 3 });
    collection.sort((left, right) => right.id - left.id);

    expect(collection.add([])).to.deep.equal([]);
    expect(collection.remove(1)).toBeUndefined();
    expect(collection.remove([1])).to.deep.equal([]);
    expect(collection.reset()).to.equal(collection);
    expect(collection.move(model, 0)).toBeUndefined();
    expect(collection.map(entry => entry.id)).to.deep.equal([1, 2]);

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([collection, { source: 'test' }]);
    expect(modelChange).not.toHaveBeenCalled();
    expect(collection.isDestroyed()).toBe(true);
    expect(changes).to.deep.equal([]);
    expect(model.isDestroyed()).toBe(false);
  });

});
