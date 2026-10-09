import { View, CollectionView } from 'marionette';
export function createRankedProjects(el, projects) {
  const view = new CollectionView({
    el,
    template: false,
    viewComparator: false
  });
  const rows = new Map();
  for (const project of projects) {
    const child = new View({
      template: () => '<input aria-label="Project name">'
    });
    child.projectId = project.id;
    view.addChildView(child);
    child.el.querySelector('input').value = project.label;
    rows.set(project.id, child);
  }
  return {
    view,
    reorder(ids) {
      if (ids.length !== rows.size || new Set(ids).size !== ids.length || ids.some(id => !rows.has(id))) {
        throw new Error('Expected every current project id exactly once');
      }
      const rank = new Map(ids.map((id, index) => [id, index]));
      view.setComparator(child => rank.get(child.projectId));
    },
    remove(id) {
      const row = rows.get(id);
      if (row) {
        view.removeChildView(row);
        rows.delete(id);
      }
    },
    destroy() {
      view.destroy();
      rows.clear();
    }
  };
}
