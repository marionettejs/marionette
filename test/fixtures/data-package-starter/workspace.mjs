import { createMarionette } from 'marionette';
import { Collection, DataApi, Model } from '@mnjs/data';

// This feature owns its runtime, Regions, subscriptions and pending selection.
// The loader may ignore abort; its result must still be rejected after cancellation.
export function createWorkspace({ el, loadNote }) {
  const { Region, View, CollectionView } = createMarionette();
  View.setDataApi(DataApi);
  CollectionView.setDataApi(DataApi);
  const notes = new Collection([
    new Model({ id: 'first', title: 'First note' }),
    new Model({ id: 'second', title: 'Second note' })
  ]);
  let pending;
  let destroyed = false;
  const Row = View.extend({
    tagName: 'li',
    template: () => '<label>Draft title <input></label><button type="button">Open</button>',
    events: { 'click button': 'open' },
    onRender() { this.el.querySelector('input').value = this.model.get('title'); },
    open() {
      this.model.set('title', this.el.querySelector('input').value);
      void navigate(this.model.get('id')).catch(() => {
        status.textContent = 'Could not load this note. Try again.';
      });
    }
  });
  const List = CollectionView.extend({ tagName: 'ul', childView: Row });
  const Detail = View.extend({
    template: () => '<h2></h2><p></p>',
    onRender() {
      this.el.querySelector('h2').textContent = this.model.title;
      this.el.querySelector('p').textContent = this.model.body;
    }
  });
  const Shell = View.extend({
    template: () => '<h1>Notes</h1><button type="button" data-reorder>Reverse rows</button><div data-list></div><p role="status"></p><section aria-label="Selected note" data-detail></section>',
    regions: { list: '[data-list]', detail: '[data-detail]' },
    events: { 'click [data-reorder]': 'reverse' },
    reverse() { notes.move(notes.at(0), notes.length - 1); },
    onRender() { this.showChildView('list', new List({ collection: notes })); }
  });
  const region = new Region({ el });
  const shell = new Shell();
  region.show(shell);
  const status = shell.el.querySelector('[role="status"]');

  async function navigate(id) {
    if (destroyed) { return false; }
    pending?.abort();
    const request = new AbortController();
    pending = request;
    status.textContent = 'Loading…';
    try {
      const note = await loadNote(id, { signal: request.signal });
      if (request.signal.aborted || destroyed) { return false; }
      shell.showChildView('detail', new Detail({ model: note }));
      status.textContent = 'Loaded.';
      return true;
    } catch (error) {
      if (request.signal.aborted || destroyed) { return false; }
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
