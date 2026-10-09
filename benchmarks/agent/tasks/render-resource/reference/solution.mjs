import { View } from 'marionette';
export function createHost(makeResource) {
  let current;
  const release = () => { if (current) { current.dispose(); current = undefined; } };
  const Host = View.extend({
    template: () => '<span>Host</span>',
    onBeforeRender: release,
    onRender() { current = makeResource(this); },
    onBeforeDestroy: release
  });
  return new Host();
}
