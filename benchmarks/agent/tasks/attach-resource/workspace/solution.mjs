import { View, Region } from 'marionette';
export function createPanel(el, connect) {
  const Panel = View.extend({
    template: () => '<span>Panel</span>',
    onAttach() {
      const connection = connect(this);
      let released = false;
      const release = () => { if (!released) { released = true; connection.dispose(); } };
      this.once('attach', release);
      this.once('destroy', release);
    }
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
