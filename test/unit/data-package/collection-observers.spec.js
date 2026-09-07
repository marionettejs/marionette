import Backbone from 'backbone';
import { Collection, DataApi } from '../../../packages/data/src/index.ts';

describe('@marionette/data collection notifications', function() {
  it('uses the public event stream in registration order', function() {
    const collection = new Collection();
    const calls = [];
    collection.on('update', () => calls.push('first listener'));
    const stop = DataApi.observeCollection(collection, change => calls.push(change.kind));
    collection.on('update', () => calls.push('last listener'));

    collection.add({ id: 1 });
    expect(calls).to.deep.equal(['first listener', 'update', 'last listener']);
    stop();
    stop();
    calls.length = 0;
    collection.add({ id: 2 });
    expect(calls).to.deep.equal(['first listener', 'last listener']);
    collection.destroy();
  });

  it('delivers independent changes to multiple observers and preserves their context', function() {
    const collection = new Collection();
    const context = {};
    const first = this.sinon.spy();
    const second = this.sinon.spy();
    DataApi.observeCollection(collection, first, context);
    DataApi.observeCollection(collection, second);
    const model = collection.add({ id: 1 });
    collection.remove(model);
    collection.reset([]);

    expect(first).to.have.been.calledOn(context);
    expect(first.args).to.deep.equal(second.args);
    expect(first.args.map(([change]) => change.kind)).to.deep.equal(['update', 'update', 'reset']);
    collection.destroy();
  });

  it('removes a destroyed model from multiple collections through ordinary events, as Backbone does', function() {
    for (const Library of [Backbone, { Collection }]) {
      const first = new Library.Collection([{}]);
      const model = first.at(0);
      const second = new Library.Collection([model]);
      model.destroy();
      expect(first.length).to.equal(0);
      expect(second.length).to.equal(0);
      first.destroy?.();
      second.destroy?.();
    }
  });
});
