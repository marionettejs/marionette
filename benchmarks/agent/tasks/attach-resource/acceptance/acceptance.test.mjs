import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View } from 'marionette';
import * as solution from '../solution.mjs';
function resourceProbe() {
  const records = [];
  const acquire = view => {
    const record = { view, disposals: 0, dispose() {
      this.disposals++;
    } };
    records.push(record);
    return record;
  };
  return { records, acquire };
}

test('connection follows attachment across rerender hide and reattachment', t => {
  const el = document.createElement('main');
  document.body.append(el);
  t.after(() => el.remove());
  const { records, acquire } = resourceProbe();
  const panel = solution.createPanel(el, acquire);
  t.after(() => panel.destroy());
  const view = panel.view;
  assert.ok(view instanceof View);
  panel.hide();
  assert.equal(records.length, 0);
  panel.show();
  assert.equal(view.el.isConnected, true);
  assert.equal(records.length, 1);
  assert.equal(records[0].disposals, 0);
  assert.ok(records[0].view === view, 'Acquisition must receive the owning View');
  panel.show();
  view.render();
  assert.equal(records.length, 1);
  assert.equal(records[0].disposals, 0);
  assert.ok(records[0].view === view, 'Acquisition must receive the owning View');
  panel.hide();
  panel.hide();
  assert.equal(records[0].disposals, 1);
  assert.equal(view.isDestroyed(), false);
  assert.equal(view.el.isConnected, false);
  panel.show();
  assert.equal(panel.view, view);
  assert.equal(view.el.isConnected, true);
  assert.equal(records.length, 2);
  assert.equal(records[1].disposals, 0);
  assert.ok(records[1].view === view, 'Acquisition must receive the owning View');
  panel.destroy();
  panel.destroy();
  panel.show();
  assert.equal(view.isDestroyed(), true);
  assert.equal(view.el.isConnected, false);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(r => r.disposals), [1, 1]);
});
test('detached panel destruction does not dispose an old connection twice', t => {
  const el = document.createElement('main');
  document.body.append(el);
  t.after(() => el.remove());
  const { records, acquire } = resourceProbe();
  const panel = solution.createPanel(el, acquire);
  t.after(() => panel.destroy());
  panel.show();
  panel.hide();
  panel.destroy();
  panel.destroy();
  assert.equal(records.length, 1);
  assert.equal(records[0].disposals, 1);
  assert.equal(panel.view.isDestroyed(), true);
});
