import { View, Region } from 'marionette';
export function createDismissibleOverlay(el, documentEvents) {
  const region = new Region({
    el
  });
  let listening = false;
  const stop = () => {
    if (listening) {
      documentEvents.removeEventListener('keydown', dismiss);
      listening = false;
    }
  };
  const dismiss = event => {
    if (event.key === 'Escape') {
      region.empty();
      stop();
    }
  };
  return {
    region,
    open(view) {
      if (!(view instanceof View) || view.isDestroyed()) {
        throw new Error('Expected a live View');
      }
      region.show(view);
      if (!listening) {
        documentEvents.addEventListener('keydown', dismiss);
        listening = true;
      }
    },
    destroy() {
      stop();
      region.destroy();
    }
  };
}
