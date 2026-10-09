import { View } from 'marionette';
export function createHost(makeResource) {
  const Host = View.extend({
    template: () => '<span>Host</span>',
    onRender() {
      const resource = makeResource(this);
      let released = false;
      const release = () => { if (!released) { released = true; resource.dispose(); } };
      this.once('render', release);
      this.once('destroy', release);
    }
  });
  return new Host();
}
