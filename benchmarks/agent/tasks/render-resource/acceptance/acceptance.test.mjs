import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View } from 'marionette';
import * as solution from '../solution.mjs';
function resourceProbe() {
  const records = [];
  const log = [];
  const acquire = () => {
    const id = records.length;
    const record = { disposals: 0, dispose() { this.disposals++; log.push(`dispose:${id}`); } };
    records.push(record); log.push(`acquire:${id}`); return record;
  };
  return { records, log, acquire };
}

test('render resource survives creation and releases once on replacement and destruction', t => {
  const { records, log, acquire } = resourceProbe();
  const view = solution.createHost(acquire); t.after(() => view.destroy());
  assert.ok(view instanceof View);
  let renders = 0;
  view.on('render', () => renders++);
  view.render();
  assert.equal(records.length, 1); assert.equal(records[0].disposals, 0);
  view.render();
  assert.equal(records.length, 2); assert.equal(records[0].disposals, 1); assert.equal(records[1].disposals, 0);
  assert.deepEqual(log, ['acquire:0', 'dispose:0', 'acquire:1']);
  view.render();
  assert.equal(records.length, 3); assert.equal(records[1].disposals, 1); assert.equal(records[2].disposals, 0);
  assert.equal(renders, 3);
  view.destroy(); view.destroy(); view.render();
  assert.equal(view.isDestroyed(), true); assert.equal(records.length, 3);
  assert.deepEqual(records.map(r => r.disposals), [1, 1, 1]);
});
test('destroying an unrendered host acquires nothing', t => {
  const { records, acquire } = resourceProbe(); const view = solution.createHost(acquire); t.after(() => view.destroy());
  view.destroy(); view.destroy(); view.render(); assert.equal(records.length, 0);
});
