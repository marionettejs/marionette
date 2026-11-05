import assert from 'node:assert/strict';
import { Application } from 'marionette';
import { ChildAppSwitcher } from '@mnjs/router';

function graph(id) {
  const leaf = { id };
  let key = leaf;
  for (let index = 0; index < 28; index++) { key = { left: key, right: key }; }
  return { key, leaf };
}
function pairedGraph(id) {
  let left = { id };
  let right = { id };
  for (let index = 0; index < 28; index++) {
    [left, right] = [{ left, right }, { left: right, right: left }];
  }
  return left;
}
let starts = 0;
const Page = Application.extend({ onStart() { starts++; } });
const pages = new ChildAppSwitcher();
const page = pages.addChildApp('page', new Page());
try {
  await pages.start();
  const first = graph('one');
  assert.equal(await pages.switchTo('page', { key: first.key }), page);
  assert.equal(await pages.switchTo('page', { key: pairedGraph('one') }), page);
  assert.equal(starts, 1);
  first.leaf.id = 'two';
  assert.equal(await pages.switchTo('page', { key: first.key }), page);
  assert.equal(starts, 2);
  pages.clear();
  assert.equal(await pages.switchTo('page', { key: pairedGraph('two') }), page);
  assert.equal(await pages.switchTo('page', { key: graph('two').key }), page);
  assert.equal(starts, 3);
  console.log('Aliased key graphs: depth 28, different sharing layouts in both directions, equal-value reuse and changed-value restart passed under a 64 MiB heap.');
} finally { pages.destroy(); }
