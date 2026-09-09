import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@mnjs/data';

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
    template: () => '<label>Draft title <input></label><button type="button">Open</button>',
    events: { 'click button': 'open' },
    onRender() { this.input().value = this.options.model.get('title') ?? ''; },
    input(): HTMLInputElement {
      const input = this.el.querySelector('input');
      if (!input) { throw new Error('Row template requires an input'); }
      return input;
    },
    open() {
      const model = this.options.model;
      const id = model.get('id');
      if (id === undefined) { throw new Error('A note requires an id'); }
      model.set('title', this.input().value);
      void navigate(id).catch(() => undefined); // navigate owns the visible error state.
    }
  });
  const List = CollectionView.extend({ tagName: 'ul', childView: Row });
  const Detail = View.extend({
    initialize(options: { model: Note }) { void options; },
    template: () => '<h2></h2><p></p>',
    onRender() {
      const heading = this.el.querySelector('h2');
      const body = this.el.querySelector('p');
      if (!heading || !body) { throw new Error('Detail template is incomplete'); }
      heading.textContent = this.options.model.title;
      body.textContent = this.options.model.body;
    }
  });
  const Shell = View.extend({
    createState() { return new Model({ message: 'Choose a note.' }); },
    stateEvents: { 'change:message': 'showStatus' },
    showStatus() {
      const status = this.el.querySelector('[role="status"]');
      if (status) { status.textContent = this.getState().get('message') ?? ''; }
    },
    template: () => '<h1>Notes</h1><button type="button" data-reorder>Reverse rows</button><div data-list></div><p role="status"></p><section aria-label="Selected note" data-detail></section>',
    regions: { list: '[data-list]', detail: '[data-detail]' },
    events: { 'click [data-reorder]': 'reverse' },
    reverse() {
      const first = notes.at(0);
      if (first) { notes.move(first, notes.length - 1); }
    },
    onRender() {
      this.showChildView('list', new List({ collection: notes }));
      this.showStatus();
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
  }
  return { notes, navigate, destroy };
}
