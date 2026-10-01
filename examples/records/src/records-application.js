import { Application } from 'marionette';
import { Collection, Model } from '@mnjs/data';
import { recordsApi } from './records-api.js';
import { DetailView, EmptyDetailView, LoadingView, RecordsLayout, RecordsList, RecordsStatus } from './records-views.js';

export const RecordsApplication = Application.extend({
  createState() {
    return new Model({ selectedId: null, count: 0, loading: false, error: '' });
  },
  stateEvents: { 'change:selectedId': 'showDetail' },
  onBeforeStart() {
    const state = this.getState();
    state.set({ loading: true, error: '' });
    if (!this.isRunning()) {
      state.set('selectedId', null);
      this.showView(new LoadingView());
    }
  },
  async prepareStart(options, { signal }) {
    const records = await recordsApi.list({ signal });
    return new Collection(records);
  },
  onStart(app, options, collection) {
    this.records = collection;
    const state = this.getState();
    if (!(this.getView() instanceof RecordsLayout)) {
      const layout = this.setView(new RecordsLayout());
      layout.showChildView('status', new RecordsStatus({ model: state }));
    }
    this.showList();
    this.showDetail();
    state.set({ count: collection.length, loading: false, error: '' });
    this.showView();
  },
  showList() {
    const state = this.getState();
    const list = this.getView().showChildView('list', new RecordsList({ collection: this.records, state }));
    this.listenTo(list, { 'select:record': row => state.set('selectedId', row.model.id) });
  },
  showDetail() {
    const model = this.records.get(this.getState().get('selectedId'));
    const detail = model ? new DetailView({ model }) : new EmptyDetailView();
    this.getView().showChildView('detail', detail);
  }
});
