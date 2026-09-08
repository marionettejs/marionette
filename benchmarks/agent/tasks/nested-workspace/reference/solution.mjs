import { View } from 'marionette';
export function createWorkspace(el) {
  const Root = View.extend({
    template: () => '<h2>Workspace</h2><section class="detail"></section>',
    regions: {
      detail: '.detail'
    }
  });
  const view = new Root({
    el
  }).render();
  return {
    view,
    showDetail(label) {
      const child = new View({
        template: false
      });
      child.el.textContent = label;
      view.showChildView('detail', child);
      return child;
    },
    clear() {
      view.getRegion('detail').empty();
    },
    destroy() {
      view.destroy();
    }
  };
}
