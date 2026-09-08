import { View, Behavior } from 'marionette';
export function createConnectionStatus(el, statusSource) {
  const Status = Behavior.extend({
    initialize() {
      this.latest = 'Unknown';
    },
    onRender() {
      if (!this.unsubscribe) {
        this.unsubscribe = statusSource.subscribe(value => {
          this.latest = value;
          this.showStatus();
        });
      }
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
