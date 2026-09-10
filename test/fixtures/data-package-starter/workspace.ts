import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@mnjs/data';

const escapeHTML = (value: string) => value.replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export type Note = { title: string; body: string };
export type NoteRow = { id: string; title: string };
export type WorkspaceOptions = {
  el: HTMLElement;
  loadNote: (id: string, context: { signal: AbortSignal }) => Promise<Note>;
};

// This feature owns its runtime, Regions, subscriptions and pending selection.
// The loader may ignore abort; its result must still be rejected after cancellation.
export function createWorkspace({ el, loadNote }: WorkspaceOptions) {
  const { Region, View, CollectionView } = createMarionette();
  View.setDataApi(DataApi);
  View.setStateApi(StateApi);
  CollectionView.setDataApi(DataApi);
  const notes = new Collection([
    new Model<NoteRow>({ id: 'first', title: 'First note' }),
    new Model<NoteRow>({ id: 'second', title: 'Second note' })
  ]);
  let pending: AbortController | undefined;
  let destroyed = false;
  const Row = View.extend({
    tagName: 'li',
    initialize(options: { model: Model<NoteRow> }) { void options; },
    template: ({ title }: NoteRow) => `<label>Draft title <input value="${escapeHTML(title)}"></label><button type="button">Open</button>`,
    ui: { input: 'input', open: 'button' },
    triggers: { 'click @ui.open': 'click:open' },
    inputValue(): string {
      const input = this.getUI('input')?.[0];
      if (!input || !('value' in input) || typeof input.value !== 'string') {
        throw new Error('Row template requires an input');
      }
      return input.value;
    },
    onClickOpen() {
      const model = this.options.model;
      const id = model.get('id');
      if (id === undefined) { throw new Error('A note requires an id'); }
      model.set('title', this.inputValue());
      void navigate(id).catch(() => undefined); // navigate owns the visible error state.
    }
  });
  const List = CollectionView.extend({ tagName: 'ul', childView: Row });
  const Detail = View.extend({
    initialize(options: { model: Note }) { void options; },
    templateContext() { return this.options.model; },
    template: ({ title, body }: Note) => `<h2>${escapeHTML(title)}</h2><p>${escapeHTML(body)}</p>`
  });
  const Status = View.extend({
    tagName: 'p',
    attributes: { role: 'status' },
    initialize(options: { state: Model<{ message: string }> }) { void options; },
    templateContext() { return this.options.state.toObject(); },
    template: ({ message }: { message: string }) => escapeHTML(message),
    stateEvents: { 'change:message': 'render' }
  });
  const Shell = View.extend({
    createState() { return new Model({ message: 'Choose a note.' }); },
    template: () => '<h1>Notes</h1><button type="button" data-reorder>Reverse rows</button><div data-list></div><div data-status></div><section aria-label="Selected note" data-detail></section>',
    regions: { list: '[data-list]', status: '[data-status]', detail: '[data-detail]' },
    ui: { reorder: '[data-reorder]' },
    triggers: { 'click @ui.reorder': 'click:reverse' },
    onClickReverse() {
      const first = notes.at(0);
      if (first) { notes.move(first, notes.length - 1); }
    },
    onRender() {
      this.showChildView('list', new List({ collection: notes }));
      this.showChildView('status', new Status({ state: this.getState() }));
    }
  });
  const region = new Region({ el });
  const shell = new Shell();
  region.show(shell);

  async function navigate(id: string): Promise<boolean> {
    if (destroyed) { return false; }
    pending?.abort();
    const request = new AbortController();
    pending = request;
    shell.getState().set('message', 'Loading…');
    try {
      const note = await loadNote(id, { signal: request.signal });
      if (request.signal.aborted || destroyed) { return false; }
      shell.showChildView('detail', new Detail({ model: note }));
      shell.getState().set('message', 'Loaded.');
      return true;
    } catch (error) {
      if (request.signal.aborted || destroyed) { return false; }
      shell.getState().set('message', 'Could not load this note. Try again.');
      throw error;
    } finally {
      if (pending === request) { pending = undefined; }
    }
  }

  function destroy() {
    if (destroyed) { return; }
    destroyed = true;
    pending?.abort();
    pending = undefined;
    region.destroy();
    notes.destroy();
  }
  return { notes, navigate, destroy };
}
