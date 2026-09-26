import './setup.ts';
import { Application } from 'marionette';
import type { ApplicationOptions, LifecycleContext } from 'marionette';
import { Collection, Model } from '@mnjs/data';
import { notesApi } from './notes.ts';
import { DetailView, LayoutView, LoadingView } from './workspace-views.ts';
import type { Note, NoteRow } from './notes.ts';

const NoteApplication = Application.extend({
  onBeforeStart() { this.showView(new LoadingView()); },
  prepareStart({ id }: { id: string }, { signal }: LifecycleContext) { return notesApi.loadNote(id, { signal }); },
  onStart(app: unknown, options: unknown, note: Note) { this.showView(new DetailView({ model: note })); }
});

export const Workspace = Application.extend({
  notes: undefined! as Collection<Model<NoteRow>>,
  selection: 0,

  initialize(options: ApplicationOptions) {
    void options;
    this.notes = new Collection<Model<NoteRow>>();
    this.addChildApp('detail', new NoteApplication());
  },

  onBeforeStart() {
    const previous = this.getView();
    if (previous) this.stopListening(previous);
    const view = new LayoutView({ collection: this.notes });
    view.showStatus('Loading notes…');
    this.listenTo(view, 'note:open', this.openNote);
    this.listenTo(view, 'reverse', this.reverseNotes);
    this.listenTo(view, 'before:destroy', () => {
      // A host may replace the root before the Application itself stops.
      this.selection++;
      void this.stop().catch(console.error);
      this.stopListening(view);
    });
    this.showView(view);
  },

  prepareStart(options: unknown, { signal }: LifecycleContext) {
    return notesApi.loadNotes({ signal });
  },

  onStart(app: unknown, options: unknown, records: NoteRow[]) {
    this.notes.reset(records);
    this.workspaceView().showStatus('Choose a note.');
  },

  workspaceView(): InstanceType<typeof LayoutView> {
    return this.getView() as InstanceType<typeof LayoutView>;
  },

  openNote(model: Model<NoteRow>) {
    void this.navigate(model.get('id')!).catch(console.error);
  },

  reverseNotes() {
    const order = new Map(this.notes.map((model, index) => [model, index]));
    this.notes.sort((left, right) => order.get(right)! - order.get(left)!);
  },

  async navigate(id: string): Promise<boolean> {
    const view = this.getView() as InstanceType<typeof LayoutView> | undefined;
    if (!this.isRunning() || !view || view.isDestroyed()) return false;
    const selection = ++this.selection;
    const detail = this.getChildApp('detail')!;
    // Each selection replaces the detail feature. Keep the list and its drafts mounted.
    await detail.stop();
    if (selection !== this.selection || !this.isRunning() || view.isDestroyed()) return false;
    view.showStatus('Loading…');
    try {
      const started = await detail.start({ id, region: view.getRegion('detail') });
      if (!started || selection !== this.selection || view.isDestroyed()) return false;
      view.showStatus('Loaded.');
      return true;
    } catch (error) {
      if (selection !== this.selection || view.isDestroyed()) return false;
      // End the failed attempt and its loading View before presenting the retry message.
      await detail.stop();
      if (selection !== this.selection || view.isDestroyed()) return false;
      view.showStatus('Could not load this note. Try again.');
      throw error;
    }
  },

  onStop() { this.selection++; },
  onBeforeDestroy() { this.selection++; },
  onDestroy() { this.notes.destroy(); }
});
