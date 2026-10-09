import { View, Region } from 'marionette';
export function createAsyncPanel(el, load) {
  const region = new Region({
    el
  });
  let generation = 0;
  let destroyed = false;
  return {
    region,
    async open(id) {
      if (destroyed) {
        return false;
      }
      const token = ++generation;
      const text = await load(id);
      if (destroyed || token !== generation) {
        return false;
      }
      const view = new View({
        template: false
      });
      view.el.textContent = text;
      region.show(view);
      return true;
    },
    stop() {
      generation++;
      region.empty();
    },
    destroy() {
      destroyed = true;
      generation++;
      region.destroy();
    }
  };
}
