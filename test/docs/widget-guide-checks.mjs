export const assertions = {
  'guides-widgets-1': `
assert.equal(help.isRendered(), true);
assert.equal(help.isAttached(), true);
assert.equal(region.currentView, help);
const dialog = help.getUI('dialog')[0];
assert.equal(dialog.tagName, 'DIALOG');
assert.equal(dialog.open, false);
assert.equal(dialog.getAttribute('aria-label'), 'Help');
assert.equal(dialog.querySelector('form').getAttribute('method'), 'dialog');
assert.equal(dialog.querySelector('button').hasAttribute('autofocus'), true);
help.closeDialog();
let removes = 0;
help.on('dom:remove', () => removes++);
help.render();
assert.equal(removes, 1);
assert.notEqual(help.getUI('dialog')[0], dialog);
assert.equal(dialog.isConnected, false);
const currentDialog = help.getUI('dialog')[0];
assert.equal(region.detachView(), help);
assert.equal(help.isDestroyed(), false);
assert.equal(help.isAttached(), false);
assert.equal(currentDialog.isConnected, false);
assert.equal(removes, 2);
region.show(help);
assert.equal(help.isAttached(), true);
assert.equal(help.getUI('dialog')[0], currentDialog);
region.empty();
assert.equal(help.isDestroyed(), true);
assert.equal(currentDialog.isConnected, false);
assert.equal(removes, 3);
region.destroy();
mount.remove();
`,
};
