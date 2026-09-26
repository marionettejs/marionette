import './setup.ts';
import { CollectionView, View } from 'marionette';
import { Model } from '@mnjs/data';
import type { Collection } from '@mnjs/data';
import type { Note, NoteRow } from './notes.ts';

// Escape text and quoted HTML attributes, not URLs, scripts, or styles.
const escapeHTML = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const RowView = View.extend({
  tagName: 'li',
  initialize(options: { model: Model<NoteRow> }) { void options; },
  template: ({ title }: NoteRow) => `<label>Draft title <input value="${escapeHTML(title)}"></label><button type="button">Open</button>`,
  ui: { input: 'input', open: 'button' },
  triggers: { 'click @ui.open': 'open' },
  modelEvents: { 'change:title': 'updateTitle' },
  getInput(): HTMLInputElement { return this.getUI('input')![0] as HTMLInputElement; },
  updateTitle() {
    if (!this.isRendered()) return;
    const input = this.getInput();
    // Adopt external changes only while clean. A local draft wins until Open.
    const clean = input.value === input.defaultValue;
    const title = String(this.options.model.get('title') ?? '');
    if (clean) input.value = title;
    input.defaultValue = title;
  },
  onOpen() {
    const input = this.getInput();
    this.options.model.set('title', input.value);
    input.defaultValue = input.value;
    this.triggerMethod('note:open', this.options.model);
  }
});

const ListView = CollectionView.extend({
  tagName: 'ul',
  childView: RowView,
  childViewTriggers: { 'note:open': 'note:open' }
});

export const LoadingView = View.extend({
  template: () => '<p>Loading note…</p>'
});

export const DetailView = View.extend({
  template: ({ title, body }: Note) => `<h2>${escapeHTML(title)}</h2><p>${escapeHTML(body)}</p>`
});

const StatusView = View.extend({
  tagName: 'p',
  attributes: { role: 'status' },
  initialize(options: { state: Model<{ message: string }> }) { void options; },
  templateContext() { return this.options.state.toObject(); },
  template: ({ message }: { message: string }) => escapeHTML(message),
  stateEvents: { 'change:message': 'render' }
});

export const LayoutView = View.extend({
  initialize(options: { collection: Collection<Model<NoteRow>> }) { void options; },
  createState() { return new Model({ message: 'Choose a note.' }); },
  template: () => '<h1>Notes</h1><button type="button" data-reorder>Reverse rows</button><div data-list></div><div data-status></div><section aria-label="Selected note" data-detail></section>',
  regions: { list: '[data-list]', status: '[data-status]', detail: '[data-detail]' },
  ui: { reorder: '[data-reorder]' },
  triggers: { 'click @ui.reorder': 'reverse' },
  childViewTriggers: { 'note:open': 'note:open' },
  onRender() {
    this.showChildView('list', new ListView({ collection: this.options.collection }));
    this.showChildView('status', new StatusView({ state: this.getState() }));
  },
  showStatus(message: string) { this.getState().set('message', message); },
  showNote(note: Note) { this.showChildView('detail', new DetailView({ model: note })); }
});
