export type Note = { title: string; body: string };
export type NoteRow = { id: string; title: string };

// Local demonstration data. Replace these methods with your application's data client.
export const notesApi = {
  async loadNotes({ signal }: { signal: AbortSignal }): Promise<NoteRow[]> {
    signal.throwIfAborted();
    return [{ id: 'first', title: 'First note' }, { id: 'second', title: 'Second note' }];
  },
  async loadNote(id: string, { signal }: { signal: AbortSignal }): Promise<Note> {
    await new Promise(resolve => setTimeout(resolve, id === 'first' ? 600 : 50));
    signal.throwIfAborted();
    return { title: `Selected: ${id}`, body: 'Your draft titles stay in the list while notes load.' };
  }
};
