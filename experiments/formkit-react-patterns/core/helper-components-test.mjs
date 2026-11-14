import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
const dom = new JSDOM('<body></body>', { url: 'https://example.test/' });
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLFormElement', 'Event', 'CustomEvent', 'MutationObserver', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle']) {globalThis[key] = dom.window[key];}
// No network is required or permitted by this focused suite.
let networkCalls = 0;
globalThis.fetch = async() => { networkCalls++; throw new Error('Unexpected network request'); };
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const host = () => { const element = document.createElement('main'); document.body.append(element); return element; };
const { mount } = await import(process.env.BASELINE ? '../../baseline/core/index.mjs' : './index.mjs');
const svg = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>';
const results = [];
const record = name => { results.push(name); console.log('PASS', name); };

if (process.env.BASELINE) {
  for (const name of ['FormKitSummary', 'FormKitMessages', 'FormKitIcon']) {
    assert.throws(() => mount({ host: host(), schema: { $cmp: name, props: { icon: svg } } }), new RegExp(`Unknown component factory: ${name}`));
    record(`baseline public mount rejects missing ${name}`);
  }
  assert.throws(() => mount({ host: host(), fields: [{ name: 'custom', type: 'local' }], inputs: { local: { type: 'input', schema: { $cmp: 'Local' }, library: { Local: () => ({}) } } } }), /Unknown component factory: Local/);
  record('baseline ignores definition.library');
  console.log(JSON.stringify({ mode: 'before', assertions: results }));
  process.exit(0);
}

const { FormKitMessages: formKitMessages, FormKitSummary: formKitSummary, FormKitIcon: formKitIcon } = await import('./helper-components.mjs');
const { createMessage } = await import('@formkit/core');
const { iconRegistry } = await import('@formkit/themes');

// Registration and inherited parent context through the actual public API.
for (const name of ['FormKitMessages', 'FormKitIcon']) {
  const target = host();
  const api = mount({ host: target, schema: { $cmp: name, props: { icon: svg } } });
  await tick();
  if (name === 'FormKitIcon') {assert.ok(target.querySelector('.formkit-icon svg'));}
  api.destroy(); assert.equal(target.children.length, 0);
  record(`public mount registers ${name} with teardown`);
}

let shown = [];
const target = host();
const firstSpec = { name: 'first', id: 'helper-first', label: 'First', validation: 'required', validationVisibility: 'blur' };
const api = mount({ host: target, fields: [firstSpec], data: { force: false }, slots: {
  default: [{ $cmp: 'FormKitSummary', props: { forceShow: '$force', onShow: items => shown.push(items) } }, '$slots.fields']
} });
await tick();
const first = api.node.at('first');
const summaryHost = target.querySelector('[aria-live="polite"]');
assert.ok(summaryHost); assert.equal(summaryHost.querySelector('a'), null);
first.store.set(createMessage({ key: 'server', type: 'error', value: '<img src=x onerror=alert(1)>server' }));
await tick();
assert.equal(summaryHost.querySelector('a'), null);
api.updateData({ force: true }); await tick();
assert.equal(summaryHost.querySelectorAll('a').length, 1);
assert.ok(summaryHost.textContent.includes('<img src=x onerror=alert(1)>server'));
assert.equal(summaryHost.querySelector('img'), null);
assert.equal(summaryHost.querySelector('[data-message-type="validation"]'), null);
record('summary forceShow respects actual validation visibility and renders error text safely');

first.context.handlers.blur(new Event('blur')); await tick();
assert.equal(summaryHost.querySelectorAll('a').length, 2);
first.store.remove('server'); await tick();
assert.equal(summaryHost.querySelectorAll('a').length, 1);
await first.input('valid'); await tick();
assert.equal(summaryHost.querySelector('a'), null);
await first.input(''); await tick();
api.updateData({ force: false }); await tick();
assert.equal(summaryHost.querySelector('a'), null);
await api.submit(); await tick();
const link = summaryHost.querySelector('a');
assert.equal(link.getAttribute('href'), '#helper-first');
assert.equal(document.activeElement, link);
assert.equal(shown.length, 1); assert.equal(shown[0][0].type, 'validation');
link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
assert.equal(document.activeElement, document.getElementById('helper-first'));
record('summary follows validation updates, submit visibility, onShow and link focus navigation');

api.setFields([firstSpec, { name: 'nested', type: 'group', children: [{ name: 'second', id: 'helper-second' }] }]);
await tick();
const second = api.node.at('nested.second');
second.store.set(createMessage({ key: 'new-error', type: 'error', value: 'Nested error' }));
await tick();
assert.ok([...summaryHost.querySelectorAll('a')].some(item => item.getAttribute('href') === '#helper-second'));
second.store.set(createMessage({ key: 'new-error', type: 'error', value: 'Updated nested error' })); await tick();
assert.ok(summaryHost.textContent.includes('Updated nested error'));
api.setFields([firstSpec]); await tick();
assert.ok(!summaryHost.textContent.includes('nested error'));
record('summary subscribes to added descendants and drops removed descendants');

// Messages uses Core context.messages, not raw store: hidden validation stays hidden.
const messagesHost = host();
const outlet = formKitMessages({ host: messagesHost, props: { node: first } });
assert.equal(first.context.defaultMessagePlacement, false);
assert.equal(messagesHost.querySelector('li').id, 'helper-first-rule_required');
first.store.set(createMessage({ key: 'live', type: 'error', value: 'Live error' })); await tick();
assert.ok(messagesHost.textContent.includes('Live error'));
first.store.set(createMessage({ key: 'live', type: 'error', value: 'Changed live error' })); await tick();
assert.ok(messagesHost.textContent.includes('Changed live error'));
first.store.remove('live'); await tick();
assert.ok(!messagesHost.textContent.includes('live error'));
const secondOutlet = formKitMessages({ host: host(), props: { node: first } });
outlet.destroy(); assert.equal(first.context.defaultMessagePlacement, false);
secondOutlet.destroy(); await tick();
assert.equal(first.context.defaultMessagePlacement, true);
record('messages follows add/update/remove, stable message IDs, shared placement ownership and cleanup');

const otherTarget = host();
const other = mount({ host: otherTarget, fields: [{ name: 'other', id: 'helper-other', validation: 'required', validationVisibility: 'blur' }] });
await tick();
const otherNode = other.node.at('other');
const swapHost = host();
const swap = formKitMessages({ host: swapHost, props: { node: first } });
swap.update({ node: otherNode, defaultPosition: true, sectionsSchema: { messages: { attrs: { 'data-outlet': 'changed' } } } });
await tick();
assert.equal(first.context.defaultMessagePlacement, true);
assert.equal(otherNode.context.defaultMessagePlacement, true);
assert.equal(swapHost.querySelector('li'), null);
otherNode.context.handlers.blur(new Event('blur')); await tick();
assert.equal(swapHost.querySelector('ul').dataset.outlet, 'changed');
assert.equal(swapHost.querySelector('li').id, 'helper-other-rule_required');
const detachedList = swapHost.querySelector('ul');
other.destroy(); await tick();
assert.equal(swapHost.querySelector('li'), null);
assert.equal(detachedList.isConnected, false);
swap.destroy(); swap.destroy();
record('messages rebinds node/defaultPosition/sections and clears immediately on node destruction');

// Observe teardown through later submissions and updates, without private spies.
const directSummaryHost = host();
let directShows = 0;
const directSummary = formKitSummary({ host: directSummaryHost, props: { node: api.node, forceShow: true, onShow: () => directShows++ } });
directSummary.destroy(); directSummary.destroy();
api.node.emit('submit-raw');
first.store.set(createMessage({ key: 'after-summary-destroy', type: 'error', value: 'Changed after summary destroy' })); await tick();
assert.equal(directShows, 0); assert.equal(directSummaryHost.children.length, 0);
record('destroyed summary ignores later submissions, descendant updates and queued show work');

// Official theme registry, inline SVG, precedence and keyboard behavior.
iconRegistry['helper-registry'] = svg;
const iconTarget = host(); let clicks = 0;
const iconApi = mount({ host: iconTarget, schema: { $cmp: 'FormKitIcon', props: { icon: '$icon', className: '$className', onClick: () => clicks++ } }, data: { icon: 'helper-registry', className: 'one' } });
await tick();
const iconSpan = iconTarget.querySelector('.formkit-icon');
assert.equal(iconSpan.getAttribute('role'), 'button'); assert.equal(iconSpan.tabIndex, 0);
iconSpan.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
assert.equal(clicks, 1);
iconApi.updateData({ icon: 'helper-registry', className: 'two' }); await tick();
assert.equal(iconTarget.querySelector('.formkit-icon'), iconSpan); assert.ok(iconSpan.classList.contains('two'));
iconApi.updateData({ icon: '', className: 'two' }); await tick();
assert.equal(iconTarget.querySelector('.formkit-icon'), null);
iconSpan.click(); assert.equal(clicks, 1);
iconApi.destroy();
record('icon uses official registry and supports reactive props, keyboard clicks and listener cleanup');

// No promise completion may repaint a newer icon or a destroyed owner.
const pending = new Map();
const loader = name => new Promise((resolve, reject) => pending.set(name, { resolve, reject }));
const asyncHost = host();
const asyncIcon = formKitIcon({ host: asyncHost, props: { icon: 'helper-slow-one', iconLoader: loader } });
await tick(); assert.ok(pending.has('helper-slow-one'));
asyncIcon.update({ icon: 'helper-fast-two', iconLoader: loader }); await tick();
pending.get('helper-fast-two').resolve('<svg><circle r="2"/></svg>'); await tick();
assert.ok(asyncHost.querySelector('circle'));
pending.get('helper-slow-one').resolve(svg); await tick();
assert.ok(asyncHost.querySelector('circle')); assert.equal(asyncHost.querySelector('path'), null);
asyncIcon.update({ icon: 'helper-rejected', iconLoader: loader }); await tick();
pending.get('helper-rejected').reject(new Error('expected loader failure')); await tick();
assert.equal(asyncHost.querySelector('svg'), null);
asyncIcon.update({ icon: 'helper-after-destroy', iconLoader: loader }); await tick();
asyncIcon.destroy(); asyncIcon.destroy();
pending.get('helper-after-destroy').resolve(svg); await tick();
assert.equal(asyncHost.children.length, 0);
record('icon drops stale async results, handles loader rejection and ignores post-destroy completion');

const unsafeHost = host();
const unsafe = formKitIcon({ host: unsafeHost, props: { icon: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><div>bad</div></foreignObject><use href="https://evil.test/a"/><path style="fill:url(https://evil.test/a)" onclick="alert(1)" fill="url(https://evil.test/a)" d="M0 0"/></svg>', innerHTML: '<script>bad</script>' } });
assert.ok(unsafeHost.querySelector('svg path'));
assert.equal(unsafeHost.querySelector('script,foreignObject,[onload],[onclick],[style],[href],[fill]'), null);
unsafe.update({ icon: '<img src=x onerror=alert(1)>' });
assert.equal(unsafeHost.querySelector('img,svg'), null);
unsafe.destroy();
const keyHost = host(); let preventedClicks = 0;
const keyboardIcon = formKitIcon({ host: keyHost, props: { icon: svg, onClick: () => preventedClicks++, onKeyDown: event => event.preventDefault(), role: 'switch', tabIndex: 4 } });
keyHost.querySelector('span').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
assert.equal(preventedClicks, 0); assert.equal(keyHost.querySelector('span').getAttribute('role'), 'switch');
keyboardIcon.destroy();
record('icon sanitizes arbitrary markup and honors explicit keyboard/role/tabindex handlers');


// Parent loader takes precedence over a helper URL; explicit helper loader wins.
const precedenceHost = host(); const loaderCalls = [];
first.props.iconLoader = name => { loaderCalls.push(`parent:${name}`); return svg; };
const precedenceIcon = formKitIcon({ host: precedenceHost, parentNode: first, props: { icon: 'helper-parent-loader', iconLoaderUrl: () => { throw new Error('parent loader must win'); } } });
await tick(); assert.deepEqual(loaderCalls, ['parent:helper-parent-loader']);
precedenceIcon.update({ icon: 'helper-explicit-loader', iconLoader: name => { loaderCalls.push(`explicit:${name}`); return '<svg><circle r="3"/></svg>'; } });
await tick(); assert.ok(precedenceHost.querySelector('circle'));
assert.equal(loaderCalls[1], 'explicit:helper-explicit-loader');
precedenceIcon.destroy(); first.props.iconLoader = undefined;
const defaultFetch = globalThis.fetch; let requestedUrl;
globalThis.fetch = async url => { requestedUrl = url; return { text: async() => svg }; };
const urlIcon = formKitIcon({ host: precedenceHost, props: { icon: 'helper-url-loader', iconLoaderUrl: name => `https://icons.example.test/${name}.svg` } });
await tick(); assert.equal(requestedUrl, 'https://icons.example.test/helper-url-loader.svg'); assert.ok(precedenceHost.querySelector('svg'));
urlIcon.destroy(); globalThis.fetch = defaultFetch;
record('icon honors explicit/parent loader precedence and official iconLoaderUrl resolution');

const rebindApi = mount({ host: host(), fields: [{ name: 'new', id: 'summary-new' }] });
rebindApi.node.at('new').store.set(createMessage({ key: 'server', type: 'error', value: 'Rebound summary error' })); await tick();
const rebindHost = host();
const reboundSummary = formKitSummary({ host: rebindHost, props: { node: api.node, forceShow: true } });
reboundSummary.update({ node: rebindApi.node, forceShow: true, sectionsSchema: { summaryHeader: { $el: 'h3' } } });
await tick(); assert.equal(rebindHost.querySelectorAll('a').length, 1); assert.ok(rebindHost.querySelector('h3'));
assert.equal(rebindHost.querySelector('a').getAttribute('href'), '#summary-new');
first.store.set(createMessage({ key: 'old-root', type: 'error', value: 'Old root error' })); await tick();
assert.ok(!rebindHost.textContent.includes('Old root error'));
rebindApi.destroy(); await tick(); assert.equal(rebindHost.children.length, 0); reboundSummary.destroy();
record('summary rebinds node and sections without retaining old tree presentation');

const pendingParentHost = host();
const pendingParentIcon = formKitIcon({ host: pendingParentHost, parentNode: first, props: { icon: 'helper-parent-destroy', iconLoader: loader } });
await tick(); assert.ok(pending.has('helper-parent-destroy'));
api.destroy(); await tick(); assert.equal(target.children.length, 0);
pending.get('helper-parent-destroy').resolve(svg); await tick();
assert.equal(pendingParentHost.children.length, 0); pendingParentIcon.destroy();
record('icon cancels pending rendering when its Core parent is destroyed');
assert.equal(networkCalls, 0);
assert.throws(() => formKitSummary({ host: host(), props: {} }), /must have a FormKit parent/);
console.log(JSON.stringify({ mode: 'after', newlySupportedComponents: ['FormKitSummary', 'FormKitMessages', 'FormKitIcon'], assertions: results }));
