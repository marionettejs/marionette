import DataApi from '../../src/runtime/data-api';
import CollectionView from '../../src/modules/collection-view';
import View from '../../src/modules/view';
import MarionetteError from '../../src/modules/error';

describe('plain data integration', function() {
  const PlainView = View.extend({
    template(data) {
      return data.name;
    }
  });
  PlainView.setDataApi(DataApi);

  const PlainCollectionView = CollectionView.extend({ childView: PlainView });
  PlainCollectionView.setDataApi(DataApi);

  it('renders a plain object without Backbone-shaped properties', function() {
    const model = { name: 'plain' };
    const view = new PlainView({ model });

    view.render();

    expect(view.el.textContent).to.equal('plain');
    expect(view.serializeModel()).to.equal(model);
  });

  it('renders and indexes plain collection models by reference', function() {
    const collection = [
      { cid: 'same', name: 'one' },
      { cid: 'same', name: 'two' }
    ];
    const view = new PlainCollectionView({ collection });

    view.render();

    expect(view.children.pluck('model')).to.deep.equal(collection);
    expect(view.children.findByModel(collection[0]).model).to.equal(collection[0]);
    expect(view.children.findByModel(collection[1]).model).to.equal(collection[1]);
    expect(view.children.findByModelCid).to.be.undefined;
  });

  it('serializes a plain array for a View template', function() {
    const collection = [{ name: 'one' }, { name: 'two' }];
    const PlainListView = View.extend({
      template: ({ models }) => models.map(model => model.name).join(',')
    });
    PlainListView.setDataApi(DataApi);
    const plainView = new PlainListView({ collection });
    plainView.render();

    expect(plainView.el.textContent).to.equal('one,two');
    expect(plainView.serializeCollection()).to.deep.equal(collection);
  });

  it('reads plain properties for string comparators and object filters', function() {
    const collection = [
      { name: 'two', rank: 2, visible: undefined },
      { name: 'hidden', rank: 1 },
      { name: 'one', rank: 1, visible: undefined }
    ];
    const view = new PlainCollectionView({
      collection,
      viewComparator: 'rank',
      viewFilter: { visible: undefined }
    });

    view.render();

    expect(view.children.pluck('model')).to.deep.equal([collection[2], collection[0]]);
  });

  it('reflects plain array mutations on explicit render', function() {
    const collection = [{ name: 'one' }];
    const view = new PlainCollectionView({ collection });
    view.render();

    collection.push({ name: 'two' });
    expect(view.children).to.have.lengthOf(1);

    view.render();
    expect(view.children.pluck('model')).to.deep.equal(collection);
  });

  it('releases entity subscriptions when an initial notification destroys the View', function() {
    const calls = [];
    const model = {};
    const collection = [];
    const Owner = View.extend({
      modelEvents: { ready() { this.destroy(); }, change() {} },
      collectionEvents: { update() {} }
    });
    Owner.setDataApi({
      subscribe(source, eventName, callback, context) {
        calls.push(eventName);
        callback.call(context, source);
        return () => calls.push('cleanup');
      }
    });
    const owner = new Owner({ model, collection });

    expect(owner.isDestroyed()).to.be.true;
    expect(calls).to.deep.equal(['ready', 'cleanup']);
    owner.undelegateEntityEvents();
    expect(calls).to.deep.equal(['ready', 'cleanup']);
  });

  it('diagnoses declarative events on unobservable plain data', function() {
    const ModelEventsView = PlainView.extend({ modelEvents: { change() {} } });
    ModelEventsView.setDataApi(DataApi);
    expect(() => new ModelEventsView({ model: {} }))
      .to.throw(MarionetteError).and.include({ code: 'MN0037' });

    const CollectionEventsView = PlainView.extend({ collectionEvents: { add() {} } });
    CollectionEventsView.setDataApi(DataApi);
    expect(() => new CollectionEventsView({ collection: [] }))
      .to.throw(MarionetteError).and.include({ code: 'MN0037' });
  });

  it('diagnoses an invalid DataApi entity cleanup value', function() {
    const InvalidView = PlainView.extend({ modelEvents: { change() {} } });
    InvalidView.setDataApi({ subscribe() {} });

    expect(() => new InvalidView({ model: {} }))
      .to.throw(MarionetteError).and.include({ code: 'MN0038' });
  });

  it('integrates a neutral observable collection adapter', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const collection = { models: [first, second] };
    const observerDisposed = this.sinon.spy();
    let emit;
    const ObservableCollectionView = PlainCollectionView.extend({});

    ObservableCollectionView.setDataApi({
      key(model) {
        return model.id;
      },
      models(source) {
        return source.models;
      },
      observeCollection(source, callback, context) {
        expect(source).to.equal(collection);
        emit = change => callback.call(context, change);
        return observerDisposed;
      }
    });

    const view = new ObservableCollectionView({ collection });
    view.render();

    collection.models.reverse();
    emit({ kind: 'reorder' });
    expect(view.children.pluck('model')).to.deep.equal([second, first]);

    const replacement = { id: 1, name: 'replacement' };
    collection.models = [replacement, second];
    const originalView = view.children.findByModel(first);
    emit({
      kind: 'update',
      added: [],
      removed: [],
      updated: [{ previous: first, current: replacement }]
    });
    expect(view.children.pluck('model')).to.deep.equal(collection.models);
    expect(view.children.findByModel(replacement).model).to.equal(replacement);
    expect(view.children.findByModel(replacement)).to.not.equal(originalView);
    expect(originalView.isDestroyed()).to.be.true;

    const reset = { id: 3, name: 'reset' };
    collection.models = [reset];
    emit({ kind: 'reset' });
    expect(view.children.pluck('model')).to.deep.equal([reset]);

    view.destroy();
    expect(observerDisposed).to.have.been.calledOnce;
  });
});
