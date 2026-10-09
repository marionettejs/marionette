import { View, Behavior } from 'marionette';
export function createEditor(el, onSave) {
  const Save = Behavior.extend({
    events: {
      keydown(event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          onSave(this.view.el.querySelector('textarea').value);
        }
      }
    }
  });
  const Editor = View.extend({
    template: () => '<textarea aria-label="Draft"></textarea>',
    behaviors: [Save]
  });
  return new Editor({
    el
  }).render();
}
