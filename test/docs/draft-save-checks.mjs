// Execute the guide's draft editor with a transport that deliberately ignores abort.
export const preparations = {
  'guides-local-editing-2': `
const requests = [];
globalThis.fetch = (url, options) => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  requests.push({ url, ...options, resolve, reject });
  return promise;
};
const settle = () => new Promise(resolve => setImmediate(resolve));
`,
};

export const assertions = {
  'guides-local-editing-2': `
const state = draftEditor.getState();
const input = draftEditor.getUI('title')[0];
const form = draftEditor.el.querySelector('form');
const button = draftEditor.el.querySelector('button');
const status = draftEditor.el.querySelector('[role="status"]');
const error = draftEditor.el.querySelector('[role="alert"]');
assert.equal(input.value, 'Original');
input.focus();
input.value = '<Draft>';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(state.get('draftTitle'), '<Draft>');
assert.equal(savedTitle.get('title'), 'Original');
assert.equal(document.activeElement, input);
assert.equal(draftEditor.getUI('title')[0], input);
assert.equal(requests.length, 0);

// The actual button invokes the form's delegated submit operation.
button.click();
assert.equal(requests.length, 1);
assert.equal(requests[0].url, '/api/titles/1');
assert.equal(requests[0].method, 'PATCH');
assert.equal(requests[0].headers['Content-Type'], 'application/json');
assert.deepEqual(JSON.parse(requests[0].body), { title: '<Draft>' });
assert.ok(requests[0].signal instanceof AbortSignal);
assert.equal(requests[0].signal.aborted, false);
assert.equal(savedTitle.get('title'), 'Original');
assert.equal(state.get('saving'), true);
assert.equal(input.readOnly, true);
assert.equal(button.getAttribute('aria-disabled'), 'true');
assert.equal(button.disabled, false);
assert.equal(status.textContent, 'Saving…');
button.click();
const duplicateSubmit = new window.Event('submit', { bubbles: true, cancelable: true });
form.dispatchEvent(duplicateSubmit);
assert.equal(duplicateSubmit.defaultPrevented, true);
assert.equal(await draftEditor.save(), false);
assert.equal(requests.length, 1);

requests[0].resolve(new Response('', { status: 503 }));
await settle();
assert.equal(state.get('saving'), false);
assert.equal(state.get('draftTitle'), '<Draft>');
assert.equal(savedTitle.get('title'), 'Original');
assert.equal(input.value, '<Draft>');
assert.equal(draftEditor.getUI('title')[0], input);
assert.equal(input.readOnly, false);
assert.equal(button.getAttribute('aria-disabled'), 'false');
assert.equal(button.disabled, false);
assert.equal(status.textContent, '');
assert.equal(error.textContent, 'Could not save. Your draft is still here; try again.');
assert.equal(error.children.length, 0);

button.click();
assert.equal(requests.length, 2);
assert.deepEqual(JSON.parse(requests[1].body), { title: '<Draft>' });
assert.equal(error.textContent, '');
requests[1].resolve(new Response(JSON.stringify({ title: '<Accepted draft>' })));
await settle();
assert.equal(savedTitle.get('title'), '<Accepted draft>');
assert.equal(state.get('draftTitle'), '<Accepted draft>');
assert.equal(input.value, '<Accepted draft>');
assert.equal(draftEditor.getUI('title')[0], input);
assert.equal(status.textContent, 'Saved.');
assert.equal(state.get('saving'), false);
assert.equal(input.readOnly, false);
assert.equal(button.getAttribute('aria-disabled'), 'false');
assert.equal(button.disabled, false);

// External source changes leave the current draft intact.
savedTitle.set('title', 'External title');
assert.equal(state.get('draftTitle'), '<Accepted draft>');
assert.equal(input.value, '<Accepted draft>');
input.value = 'Unfinished next draft';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
button.click();
const abandonedState = state.toObject();
draftRegion.empty();
assert.equal(draftEditor.isDestroyed(), true);
assert.equal(state.isDestroyed(), true);
assert.equal(savedTitle.isDestroyed(), false);
assert.equal(input.isConnected, false);
assert.equal(requests[2].signal.aborted, true);
assert.equal(await draftEditor.save(), false);
assert.equal(requests.length, 3);
requests[2].resolve(new Response(JSON.stringify({ title: 'Obsolete success' })));
await settle();
assert.equal(savedTitle.get('title'), 'External title');
assert.deepEqual(state.toObject(), abandonedState);
assert.equal(input.value, 'Unfinished next draft');
assert.equal(status.textContent, 'Saving…');
assert.equal(error.textContent, '');

// A late rejection is guarded too, and the next editor starts from the source.
const nextEditor = new DraftEditor({ model: savedTitle });
draftRegion.show(nextEditor);
const nextState = nextEditor.getState();
const nextInput = nextEditor.getUI('title')[0];
assert.equal(nextInput.value, 'External title');
nextEditor.el.querySelector('button').click();
const nextSnapshot = nextState.toObject();
const nextError = nextEditor.el.querySelector('[role="alert"]');
draftRegion.empty();
assert.equal(requests[3].signal.aborted, true);
requests[3].reject(new Error('Obsolete failure'));
await settle();
assert.equal(savedTitle.get('title'), 'External title');
assert.deepEqual(nextState.toObject(), nextSnapshot);
assert.equal(nextError.textContent, '');
assert.equal(nextInput.value, 'External title');
assert.equal(nextState.isDestroyed(), true);
draftRegion.destroy();
savedTitle.destroy();
mount.remove();
`,
};
