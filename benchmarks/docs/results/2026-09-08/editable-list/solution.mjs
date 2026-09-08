import { CollectionView, Region, View } from 'marionette';
import { Collection, DataApi } from '@marionette/data';

const RowView = View.extend({
  tagName: 'li',
  attributes() {
    return { 'data-id': this.model.get('id') };
  },
  template: () => '<label>Label <input type="text"></label>',
  onRender() {
    this.el.querySelector('input').value = this.model.get('label');
  }
});

const ListView = CollectionView.extend({
  tagName: 'ul',
  childView: RowView
});

// Observable record data is the only integration this feature needs.
RowView.setDataApi(DataApi);
ListView.setDataApi(DataApi);

export function createList({ el, records }) {
  const collection = new Collection(records);
  const view = new ListView({ collection });
  const region = new Region({ el });
  region.show(view);

  return {
    view,
    collection,
    add(record) {
      return collection.add(record);
    },
    remove(id) {
      return collection.remove(id);
    },
    move(id, index) {
      return collection.move(id, index);
    },
    dispose() {
      region.destroy();
      collection.destroy();
    }
  };
}
