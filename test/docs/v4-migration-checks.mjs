// Run the v5 side of the guide's actual diffs. Only the method fragment needs a
// surrounding class; test setup supplies the form and the retained Backbone model.
export function migrationAfter(diff, index) {
  const after = diff.split('\n').filter(line => !line.startsWith('-'))
    .map(line => /^[ +]/.test(line) ? line.slice(1) : line).join('\n');
  return index === 1 ? `const Editor = View.extend({\n${after}\n});` : after;
}

export const preparations = {
  'guides-migration-2': `
import { View, setDataApi } from 'marionette';
import BackboneApi from '@mnjs/adapters/backbone';
setDataApi(BackboneApi);
`,
};

export const assertions = {
  'guides-migration-1': `
const { default: Backbone } = await import('backbone');
const model = new Backbone.Model({ title: 'Before' });
const view = new Editor({ model, template: ({ title }) => title }).render();
assert.equal(view.el.textContent, 'Before');
model.set('title', 'After');
assert.equal(view.el.textContent, 'After');
const channel = Radio.channel('migration');
channel.reply('title', () => model.get('title'));
assert.equal(Radio.channel('migration').request('title'), 'After');
Radio.reset('migration');
view.destroy();
model.set('title', 'After destruction');
assert.equal(view.el.textContent, 'After');
`,
  'guides-migration-2': `
const { default: Backbone } = await import('backbone');
const saves = [];
const PersistentModel = Backbone.Model.extend({
  save(attributes) { saves.push(attributes); this.set(attributes); },
});
const model = new PersistentModel();
const view = new Editor({ model, tagName: 'form',
  template: () => '<input name="title">', ui: { title: 'input' },
  events: { submit: 'onSave' },
}).render();
document.body.append(view.el);
view.getUI('title')[0].value = 'Migrated title';
const event = new Event('submit', { bubbles: true, cancelable: true });
assert.equal(view.el.dispatchEvent(event), false);
assert.equal(event.defaultPrevented, true);
assert.deepEqual(saves, [{ title: 'Migrated title' }]);
assert.equal(model.get('title'), 'Migrated title');
view.destroy();
assert.equal(document.body.contains(view.el), false);
`,
};
