import { CollectionView, View } from 'marionette';
import { html } from 'lit-html';

export const LoadingView = View.extend({
  template: () => html`<p role="status">Loading records…</p>`
});

export const ErrorView = View.extend({
  template: () => html`
    <p role="alert">Could not open records.</p>
    <button type="button" class="js-retry">Retry</button>`,
  triggers: { 'click .js-retry': 'retry' }
});

export const RecordsLayout = View.extend({
  className: 'records',
  templateContext() { return { count: this.collection.length }; },
  template: ({ count }) => html`
    <h2>Records</h2>
    <p role="status">${count} ${count === 1 ? 'record' : 'records'}</p>
    <div class="records-columns">
      <div class="js-list"></div>
      <section class="js-detail" aria-label="Record details"></section>
    </div>`,
  regions: {
    list: '.js-list',
    detail: '.js-detail'
  }
});

const RecordRow = View.extend({
  tagName: 'li',
  modelEvents: { change: 'render' },
  stateEvents: { 'change:selectedId': 'render' },
  templateContext() {
    return { selected: this.getState().get('selectedId') === this.model.id };
  },
  template: ({ title, selected }) => html`
    <button type="button" aria-pressed=${selected}>${title}</button>`,
  triggers: { 'click button': 'select' }
});

export const RecordsList = CollectionView.extend({
  tagName: 'ul',
  attributes: { 'aria-label': 'Records' },
  childView: RecordRow,
  childViewOptions() { return { state: this.getState() }; },
  childViewTriggers: { select: 'select:record' }
});

export const EmptyDetailView = View.extend({
  template: () => html`<p>Select a record.</p>`
});

export const DetailView = View.extend({
  template: ({ title, description }) => html`<h3>${title}</h3><p>${description}</p>`
});
