export const preparations = {
  'guides-typescript-3': `
const requests = [];
globalThis.fetch = async (url, options) => {
  requests.push({ url, signal: options.signal });
  return new Response(JSON.stringify({ title: '<Summary>' }));
};
`,
};

export const assertions = {
  'guides-typescript-1': `
assert.equal(label, 'Count');
assert.equal(count, 0);
counter.el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert.equal(counter.getState().count, 1);
const other = new CounterView({ label: 'Other' });
assert.equal(other.getState().count, 0);
other.destroy();
counter.destroy();
`,
  'guides-typescript-2': `
const input = editor.getUI('title')[0];
const preview = editor.el.querySelector('.preview');
assert.equal(document.activeElement, input);
input.value = '<Edited title>';
input.setSelectionRange(3, 3);
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(editor.getState().title, '<Edited title>');
assert.equal(preview.textContent, '<Edited title>');
assert.equal(preview.children.length, 0);
assert.equal(editor.getUI('title')[0], input);
assert.equal(input.selectionStart, 3);
editor.destroy();
input.value = 'After teardown';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(editor.getState().title, '<Edited title>');
`,
  'guides-typescript-3': `
assert.equal(activated, true);
assert.equal(app.isRunning(), true);
assert.equal(mount.textContent, '<Summary>');
assert.equal(mount.querySelector('summary'), null);
assert.equal(requests.length, 1);
assert.equal(requests[0].url, '/summary.json');
assert.equal(requests[0].signal instanceof AbortSignal, true);
assert.equal(app.stop(), true);
assert.equal(app.isRunning(), false);
assert.equal(mount.textContent, '');
globalThis.fetch = async () => new Response(JSON.stringify({ title: 42 }));
await assert.rejects(app.start(), /Invalid summary response/);
assert.equal(app.isRunning(), false);
assert.equal(mount.textContent, '');
app.destroy();
mount.remove();
`,
  'guides-typescript-4': `
assert.equal(current, 'Overview');
assert.equal(title.el.textContent, 'Overview');
model.set('title', '<Changed>');
assert.equal(title.el.textContent, '<Changed>');
assert.equal(title.el.querySelector('changed'), null);
model.unset('title');
assert.equal(title.el.textContent, 'Untitled');
title.destroy();
assert.equal(model.isDestroyed(), false);
model.set('title', 'After teardown');
assert.equal(title.el.textContent, 'Untitled');
model.destroy();
`,
};
