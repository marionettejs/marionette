import { View, Region } from 'marionette';
export function createPanel(el, connect) {
  let current;
  const release = () => { if (current) { current.dispose(); current = undefined; } };
  const Panel = View.extend({
    template: () => '<span>Panel</span>',
    onAttach() { current = connect(this); },
    onBeforeDetach: release,
    onBeforeDestroy: release
  });
  const view = new Panel();
  const region = new Region({ el });
  return {
    view,
    show() { region.show(view); },
    hide() { region.detachView(); },
    destroy() { region.destroy(); view.destroy(); }
  };
}
