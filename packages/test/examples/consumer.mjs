import { withQueries } from '@mnjs/test/testing-library';
import * as cypressAdapter from '@mnjs/test/cypress';
import { createGallery } from '@mnjs/test/playwright';
import assert from 'node:assert/strict';
import { createMarionette, Application, View } from 'marionette';
import { createTestScope, mountApplication, mountView } from '@mnjs/test';
import { createTestScope as createScopeOnly } from '@mnjs/test/scope';
import { createRadio } from '@mnjs/radio';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
for (const createOwner of [createTestScope, createScopeOnly,
  require('@mnjs/test').createTestScope, require('@mnjs/test/scope').createTestScope]) {
  for (const named of [false, true]) {
    const radio = createRadio();
    const channel = radio.channel('hash');
    const owner = createOwner();
    const receiver = { prefix: 'owned:' };
    const replies = { answer(value) { return this.prefix + value; }, disabled: false, ['__proto__']: 0 };
    const returned = named ? owner.reply(radio, 'hash', replies, receiver) : owner.reply(channel, replies, receiver);
    assert.equal(returned, channel);
    assert.equal(channel.request('answer', 'yes'), 'owned:yes');
    assert.equal(channel.request('disabled'), false);
    assert.equal(channel.request('__proto__'), 0);
    channel.reply('answer', replies.answer, receiver);
    await owner.cleanup();
    assert.equal(channel.request('answer', 'later'), 'owned:later');
    assert.equal(channel.request('disabled'), undefined);
    assert.equal(channel.request('__proto__'), undefined);
  }
}
console.log('Installed root/scope ESM/CommonJS: per-key hash ownership and replacement safety passed.');

const scope = createTestScope();
const runtime = createMarionette();
const Card = runtime.View.extend({ template: () => '<h1>Consumer</h1>' });
const options = { regionClass: runtime.Region };
const mounted = withQueries(scope.own(mountView(new Card(), options)));
options.container = document.body;
assert.equal(mounted.getByRole('heading', { name: 'Consumer' }).textContent, 'Consumer');
assert.equal(mounted.view.isAttached(), true);
const detached = mounted.region.detachView();
scope.defer(() => detached.destroy());
assert.equal(mounted.el, undefined);
let commits = 0;
const Feature = Application.extend({ onStart() { commits++; this.showView(new View({ template: () => 'late' })); } });
const app = mountApplication(() => new Feature());
const cleanup = app.cleanup();
assert.equal(await app.ready, false);
await cleanup;
assert.equal(commits, 0);
await scope.cleanup();
assert.equal(detached.isDestroyed(), true);
assert.equal(mounted.container.isConnected, false);
console.log('Installed ESM: isolation, attachment, ownership and immediate cancellation passed.');

assert.deepEqual(Object.keys(cypressAdapter).sort(), ['mount', 'mountApplication', 'setupCypress', 'testScope', 'unmount']);
assert.equal(typeof createGallery, 'function');
assert.equal(typeof globalThis.Cypress, 'undefined');
