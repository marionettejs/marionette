import { Application } from 'marionette';
import { Collection, Model } from '@mnjs/data';
import { recordsApi } from './records-api.js';
import { DetailView, EmptyDetailView, LoadingView, RecordsLayout, RecordsList } from './records-views.js';

export const RecordsApplication = Application.extend({
  createState() {
    return new Model({ selectedId: null });
  },
  stateEvents: { 'change:selectedId': 'showDetail' },
  onBeforeStart() {
    this.getState().set('selectedId', null);
    this.showView(new LoadingView());
  },
  async prepareStart(options, { signal }) {
    const records = await recordsApi.list({ signal });
    signal.throwIfAborted();
    return new Collection(records);
  },
  onStart(app, options, collection) {
    this.records = collection;
    this.setView(new RecordsLayout({ collection }));
    this.showList();
    this.showDetail();
    this.showView();
  },
  showList() {
    const state = this.getState();
    const list = this.getView().showChildView('list', new RecordsList({ collection: this.records, state }));
    this.listenTo(list, { 'select:record': row => state.set('selectedId', row.model.id) });
  },
  showDetail() {
    const view = this.getView();
    const model = this.records.get(this.getState().get('selectedId'));
    const detail = model ? new DetailView({ model }) : new EmptyDetailView();
    view.showChildView('detail', detail);
  }
});
