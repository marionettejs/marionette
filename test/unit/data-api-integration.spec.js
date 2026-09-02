import DataApi from '../../runtime/data-api';
import CollectionView from '../../modules/collection-view';
import View from '../../modules/view';

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

  it('renders and indexes plain collection items by reference', function() {
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
      template: ({ items }) => items.map(item => item.name).join(',')
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

  it('integrates a neutral observable collection adapter', function() {
    const first = { id: 1, name: 'one' };
    const second = { id: 2, name: 'two' };
    const collection = { items: [first, second] };
    const observerDisposed = this.sinon.spy();
    let emit;
    const ObservableCollectionView = PlainCollectionView.extend({});

    ObservableCollectionView.setDataApi({
      key(model) {
        return model.id;
      },
      items(source) {
        return source.items;
      },
      observeCollection(source, callback, context) {
        expect(source).to.equal(collection);
        emit = change => callback.call(context, change);
        return observerDisposed;
      }
    });

    const view = new ObservableCollectionView({ collection });
    view.render();

    emit({ type: 'unknown' });
    expect(view.children.pluck('model')).to.deep.equal([first, second]);

    collection.items.reverse();
    emit({ type: 'reorder' });
    expect(view.children.pluck('model')).to.deep.equal([second, first]);

    const replacement = { id: 1, name: 'replacement' };
    collection.items = [replacement, second];
    emit({ type: 'update', added: [replacement], removed: [first], updated: [] });
    expect(view.children.pluck('model')).to.deep.equal(collection.items);
    expect(view.children.findByModel(replacement).model).to.equal(replacement);

    const reset = { id: 3, name: 'reset' };
    collection.items = [reset];
    emit({ type: 'reset' });
    expect(view.children.pluck('model')).to.deep.equal([reset]);

    view.destroy();
    expect(observerDisposed).to.have.been.calledOnce;
  });
});
