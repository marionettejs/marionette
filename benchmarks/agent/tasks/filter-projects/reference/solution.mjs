import { View, CollectionView } from 'marionette';
export function createProjects(el, projects) {
  const view = new CollectionView({
    el,
    template: false,
    viewComparator: false
  }).render();
  for (const project of projects) {
    const child = new View({
      template: false
    });
    child.project = project;
    child.el.textContent = project.label;
    view.addChildView(child);
  }
  return {
    view,
    filter(query) {
      const text = query.toLowerCase();
      view.setFilter(child => child.project.label.toLowerCase().includes(text));
    },
    destroy() {
      view.destroy();
    }
  };
}
