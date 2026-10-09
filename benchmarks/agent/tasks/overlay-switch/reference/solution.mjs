import { View, Region } from 'marionette';
export function createOverlayHost(el, position) {
  const region = new Region({
    el
  });
  return {
    region,
    open(view, anchor) {
      if (!(view instanceof View) || view.isDestroyed()) {
        throw new Error('Expected a live View');
      }
      region.show(view);
      position(view.el, anchor);
    },
    close() {
      region.empty();
    },
    destroy() {
      region.destroy();
    }
  };
}
