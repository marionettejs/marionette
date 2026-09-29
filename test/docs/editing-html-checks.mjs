import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function getPreparations(installedRoot) {
  return Object.fromEntries(['local-editing', 'existing-html'].map(name => {
    const page = readFileSync(join(installedRoot, 'docs/guides', `${name}.md`), 'utf8');
    const markup = [...page.matchAll(/```html\n([\s\S]*?)```/g)];
    assert.equal(markup.length, 1, `${name} needs one tested HTML fixture`);
    return [`guides-${name}-1`, `
document.body.innerHTML = ${JSON.stringify(markup[0][1])};
const originalRoot = document.body.firstElementChild;
const originalButton = document.querySelector('button');
`];
  }));
}

export const assertions = {
  'guides-local-editing-1': `
const input = editor.getUI('title')[0];
const preview = editor.getUI('preview')[0];
assert.equal(input.value, 'Untitled');
assert.equal(preview.textContent, 'Untitled');
input.focus();
input.value = '<New title>';
input.setSelectionRange(4, 4);
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(model.get('title'), '<New title>');
assert.equal(preview.textContent, '<New title>');
assert.equal(preview.children.length, 0);
assert.equal(editor.getUI('title')[0], input);
assert.equal(document.activeElement, input);
assert.equal(input.selectionStart, 4);
model.set('title', 'External update');
assert.equal(input.value, 'External update');
assert.equal(preview.textContent, 'External update');
editor.render();
assert.equal(editor.getUI('title')[0], input);
assert.equal(preview.textContent, 'External update');
assert.equal(input.value, 'External update');
region.empty();
assert.equal(editor.isDestroyed(), true);
assert.equal(model.isDestroyed(), false);
assert.equal(originalRoot.isConnected, true);
assert.equal(input.isConnected, false);
model.set('title', 'After removal');
assert.equal(input.value, 'External update');
assert.equal(preview.textContent, 'External update');
input.value = 'Detached input';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(model.get('title'), 'After removal');
region.destroy();
model.destroy();
`,
  'guides-existing-html-1': `
assert.equal(details.el, originalRoot);
assert.equal(details.getUI('toggle')[0], originalButton);
assert.equal(details.isRendered(), true);
assert.equal(details.isAttached(), true);
const body = details.getUI('body')[0];
assert.equal(body.hidden, true);
originalButton.click();
assert.equal(body.hidden, false);
assert.equal(originalButton.getAttribute('aria-expanded'), 'true');
let renders = 0;
details.on('render', () => renders++);
assert.equal(details.render(), details);
assert.equal(renders, 0);
assert.equal(details.getUI('toggle')[0], originalButton);
assert.equal(details.getUI('body')[0], body);
assert.equal(body.hidden, false);
const lifecycle = [];
const observedRoot = originalRoot.cloneNode(true);
document.body.append(observedRoot);
const ObservedDetails = DetailsView.extend({
  onRender() { lifecycle.push('render'); },
  onAttach() { lifecycle.push('attach'); }
});
const observed = new ObservedDetails({ el: observedRoot });
assert.deepEqual(lifecycle, []);
assert.equal(observed.isRendered(), true);
assert.equal(observed.isAttached(), true);
observed.destroy();
details.destroy();
assert.equal(details.isDestroyed(), true);
assert.equal(originalRoot.isConnected, false);
originalButton.click();
assert.equal(body.hidden, false);
assert.equal(originalButton.getAttribute('aria-expanded'), 'true');
`,
};
