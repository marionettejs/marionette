// Copied beside the extracted package for Node, served separately for browsers.
// All renderer imports use the package's public export names.
export async function smoke(manifest, development) {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const exports = Object.keys(manifest.exports).filter(key => key !== './package.json');
  for (const key of exports) await import(key === '.' ? '@mnjs/html' : `@mnjs/html/${key.slice(2)}`);
  const {html, render, nothing} = await import('@mnjs/html');
  const {repeat} = await import('@mnjs/html/directives/repeat.js');
  const {until} = await import('@mnjs/html/directives/until.js');
  const {default: api, HtmlDomApi, setContents} = await import('@mnjs/html/marionette');
  assert(api === HtmlDomApi && api.setContents === setContents, 'adapter exports agree');
  assert((typeof render.setSanitizer === 'function') === development, 'correct export condition');
  const root = document.createElement('div');
  document.body.append(root);
  const view = ids => html`<p>${'<img src=x>'}</p>${repeat(ids, id => id, id => html`<input data-id=${id}>`)}`;
  render(view(['a', 'b']), root);
  const first = root.querySelector('input');
  first.value = 'edited';
  render(view(['b', 'a']), root);
  assert(root.querySelectorAll('input')[1] === first && first.value === 'edited', 'keyed identity and edited state');
  assert(!root.querySelector('img') && root.querySelector('p').textContent === '<img src=x>', 'text escaping');
  render(until(Promise.resolve('settled'), 'pending'), root);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert(root.textContent === 'settled', 'async directive settlement');
  render(nothing, root).setConnected(false);
  const owned = document.createElement('div');
  api.notifyAttach(owned);
  api.setContents(owned, html`<span>first</span>`);
  const regionChild = document.createElement('aside');
  owned.append(regionChild);
  api.setContents(owned, html`<span>updated</span>`);
  assert(owned.lastChild === regionChild && owned.querySelector('span').textContent === 'updated', 'bounded adapter ownership');
  api.notifyDetach(owned);
  root.remove();
  return {exports: exports.length, condition: development ? 'development' : 'default', runtime: 'passed'};
}
