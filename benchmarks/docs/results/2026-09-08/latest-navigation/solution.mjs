import { Region, View } from 'marionette';

const RecordView = View.extend({
  template: () => '<h1></h1>',
  onRender() {
    this.el.querySelector('h1').textContent = this.model.title;
  },
});

export function createNavigation({ el, loadRecord }) {
  const region = new Region({ el });
  let pending;
  let disposed = false;

  async function navigate(id) {
    if (disposed) return false;

    const request = new AbortController();
    const previous = pending;
    pending = request;
    previous?.abort();

    const isCurrent = () => !disposed && pending === request && !request.signal.aborted;
    try {
      if (!isCurrent()) return false;
      const record = await loadRecord(id, { signal: request.signal });
      if (!isCurrent()) return false;

      region.show(new RecordView({ model: record }));
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      throw error;
    } finally {
      if (pending === request) pending = undefined;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    const request = pending;
    pending = undefined;
    request?.abort();
    region.destroy();
  }

  return { navigate, dispose };
}
