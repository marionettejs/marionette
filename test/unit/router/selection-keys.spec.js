import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Application } from 'marionette';
import { RouteApplication } from '@mnjs/router';

const owners = [];
afterEach(() => { for (const owner of owners.splice(0)) { owner.destroy(); } });
async function pages() {
  let starts = 0;
  const owner = new RouteApplication();
  owners.push(owner);
  const page = owner.addChildApp('page', new (Application.extend({ onStart() { starts++; } }))());
  await owner.start();
  return { owner, page, starts: () => starts };
}
for (const [index, [first, second, same]] of [
  [undefined, undefined, true], [null, null, true], [NaN, NaN, true], [-0, 0, false],
  ['one', 'one', true], [1, '1', false], [true, false, false], [null, undefined, false],
  [{ id: 'one', extra: 2 }, { extra: 2, id: 'one' }, true],
  [{ id: undefined }, {}, false],
  [Object.assign(Object.create(null), { id: 'one' }), Object.freeze({ id: 'one' }), true],
].entries()) {
  it('compares flat key values symmetrically using Object.is, case ' + index, async() => {
    for (const [a, b] of [[first, second], [second, first]]) {
      const { owner, page, starts } = await pages();
      assert.equal(await owner.switchTo('page', { key: a }), page);
      assert.equal(await owner.switchTo('page', { key: b }), page);
      assert.equal(starts(), same ? 1 : 2);
    }
  });
}
for (const [name, key] of [
  ['array', []], ['nested object', { id: {} }], ['nested array', { id: [] }],
  ['class instance', new Date()], ['map', new Map()], ['set', new Set()],
  ['symbol', Symbol('key')], ['bigint', 1n], ['function', () => {}],
  ['foreign prototype', Object.create({ id: 'one' })],
]) {
  it('rejects ' + name + ' before retiring the current selection', async() => {
    const { owner, page, starts } = await pages();
    await owner.switchTo('page', { key: { id: 'one' } });
    await assert.rejects(owner.switchTo('page', { key }), TypeError);
    assert.equal(owner.getCurrent(), page);
    assert.equal(page.isRunning(), true);
    assert.equal(starts(), 1);
  });
}
it('snapshots only own enumerable string-keyed primitive values', async() => {
  const key = Object.create(null);
  Object.defineProperty(key, 'id', { value: 'one', enumerable: true, writable: true });
  Object.defineProperty(key, 'hidden', { value: 'outside identity' });
  key[Symbol('outside identity')] = 'ignored';
  const { owner, starts } = await pages();
  await owner.switchTo('page', { key });
  await owner.switchTo('page', { key: { id: 'one' } });
  assert.equal(starts(), 1);
  key.id = 'two';
  await owner.switchTo('page', { key });
  assert.equal(starts(), 2);
  assert.equal(key.id, 'two');
});

it('snapshots an incoming flat key before the outgoing child stop can mutate it', async() => {
  const incoming = { id: 'before' };
  const owner = new RouteApplication(); owners.push(owner);
  const outgoing = owner.addChildApp('outgoing', new (Application.extend({ onStop() { incoming.id = 'after'; } }))());
  let starts = 0;
  const next = owner.addChildApp('next', new (Application.extend({ onStart() { starts++; } }))());
  await owner.start();
  await owner.switchTo('outgoing');
  await owner.switchTo('next', { key: incoming });
  assert.equal(incoming.id, 'after');
  assert.equal(outgoing.isRunning(), false);
  assert.equal(await owner.switchTo('next', { key: { id: 'before' } }), next);
  assert.equal(starts, 1, 'Selection keeps the incoming value from before the stop callback');
  await owner.switchTo('next', { key: incoming });
  assert.equal(starts, 2);
});
