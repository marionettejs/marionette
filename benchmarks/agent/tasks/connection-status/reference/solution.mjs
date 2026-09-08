import { View, Behavior } from 'marionette';
export function createConnectionStatus(el, statusSource) {
  const Status = Behavior.extend({
    initialize() {
      this.latest = 'Unknown';
      this.unsubscribe = statusSource.subscribe(value => {
        this.latest = value;
        if (this.view.isRendered()) {
          this.showStatus();
        }
      });
    },
    onRender() {
      this.showStatus();
    },
    showStatus() {
      this.view.el.querySelector('output').textContent = this.latest;
    },
    onDestroy() {
      this.unsubscribe();
    }
  });
  const StatusView = View.extend({
    template: () => '<output></output>',
    behaviors: [Status]
  });
  return new StatusView({
    el
  }).render();
}
