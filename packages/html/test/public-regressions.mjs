// Shared public-API regressions, run in Node and real browsers.
import {html, render, nothing} from '@mnjs/html';
import {repeat} from '@mnjs/html/directives/repeat.js';
import {cache} from '@mnjs/html/directives/cache.js';
import {keyed} from '@mnjs/html/directives/keyed.js';
import {ref} from '@mnjs/html/directives/ref.js';
import {guard} from '@mnjs/html/directives/guard.js';
import {until} from '@mnjs/html/directives/until.js';
import {AsyncDirective, directive} from '@mnjs/html/async-directive';
import {styleMap} from '@mnjs/html/directives/style-map.js';

const equal = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};

export async function keyedRegressions() {
  const root = document.createElement('div');
  document.body.append(root);
  try {
    for (const initialKey of ['a', nothing]) {
      const calls = [];
      const first = node => calls.push(['first', !!node]);
      const second = node => calls.push(['second', !!node]);
      const view = (key, callback) => html`${keyed(key, html`<span ${ref(callback)}>value</span>`)}`;
      render(view(initialKey, first), root);
      const original = root.firstElementChild;
      render(view(initialKey, first), root);
      equal(root.firstElementChild === original, true, 'same key preserves DOM');
      render(view('b', second), root);
      equal(calls, [['first', true], ['first', false], ['second', true]], 'key change disposes before replacement');
      render(nothing, root);
      equal(calls, [['first', true], ['first', false], ['second', true], ['second', false]], 'old ref not cleared twice');
    }

    let resolveOld;
    const old = new Promise(resolve => { resolveOld = resolve; });
    const calls = [];
    const callback = node => calls.push(!!node);
    const view = (key, value) => html`${keyed(key, guard([key], () => value))}`;
    render(view('old', until(old, html`<i ${ref(callback)}>loading</i>`)), root);
    render(view('new', html`<b>new</b>`), root);
    equal(calls, [true, false], 'nested guard/until releases ref');
    const replacementPart = render(view('new', html`<b>new</b>`), root);
    replacementPart.setConnected(false);
    replacementPart.setConnected(true);
    resolveOld(html`<i>stale</i>`);
    await old;
    await Promise.resolve();
    equal(root.textContent, 'new', 'stale promise cannot replace new key');
    render(nothing, root);

    const attribute = (key, value) => html`<p title=${keyed(key, value)} .payload=${keyed(key, value)} ?hidden=${keyed(key, !!value)}></p>`;
    render(attribute('a', 'first'), root);
    render(attribute('b', 'second'), root);
    equal([root.firstElementChild.title, root.firstElementChild.payload, root.firstElementChild.hidden], ['second', 'second', true], 'non-child bindings remain supported');
    const elementCalls = [];
    const first = node => elementCalls.push(['first', !!node]);
    const second = node => elementCalls.push(['second', !!node]);
    const element = (key, callback) => html`<p ${keyed(key, ref(callback))}></p>`;
    render(element('a', first), root);
    render(element('b', second), root);
    render(nothing, root);
    equal(elementCalls, [['first', true], ['first', false], ['second', true], ['second', false]], 'element directive replacement');
    return {keyedCleanup: true, initialNothingKey: true, nestedAsync: true, nonChildBindings: true};
  } finally {
    render(nothing, root).setConnected(false);
    root.remove();
  }
}

export function styleMapRegressions() {
  const root = document.createElement('div');
  const slash = String.fromCharCode(92);
  const cases = [
    ['--with' + slash + ' space', '--with space'],
    ['--' + slash + '31 23', '--123'],
    [slash + '63 olor', 'color'],
    ['--' + slash + '000061', '--a'],
    ['--' + slash + '61\r\nname', '--aname'],
    ['--' + slash + '61\tname', '--aname'],
    ['--' + slash + '1f600', '--😀'],
    ['--colon' + slash + ':name', '--colon:name'],
    ['--slash' + slash + slash + 'name', '--slash' + slash + 'name'],
    ['--' + slash + '0', '--�'],
    ['--' + slash + 'd800', '--�'],
    ['--' + slash + '110000', '--�'],
  ];
  try {
    for (const [escaped, decoded] of cases) {
      const view = values => html`<div style=${styleMap(values)}></div>`;
      render(view({[escaped]: 'red'}), root);
      const style = root.firstElementChild.style;
      equal(style.getPropertyValue(decoded), 'red', `initial ${escaped}`);
      render(view({[escaped]: 'blue !important'}), root);
      equal([style.getPropertyValue(decoded), style.getPropertyPriority(decoded)], ['blue', 'important'], `update ${escaped}`);
      render(view({[escaped]: null}), root);
      equal(style.getPropertyValue(decoded), '', `null ${escaped}`);
      render(view({[escaped]: 'green'}), root);
      equal([style.getPropertyValue(decoded), style.getPropertyPriority(decoded)], ['green', ''], `re-add ${escaped}`);
      render(view({}), root);
      equal(style.getPropertyValue(decoded), '', `delete ${escaped}`);
      render(nothing, root);
    }
    return {escapedStyleCases: cases.length};
  } finally {
    render(nothing, root).setConnected(false);
  }
}


export async function syncAncestorRegressions() {
  const root = document.createElement('div');
  document.body.append(root);
  try {
    let resolveOld;
    const promise = new Promise(resolve => { resolveOld = resolve; });
    const view = value => html`${value}`;
    render(view(guard(['old'], () => until(promise, 'waiting'))), root);
    const replacementPart = render(view('replacement'), root);
    replacementPart.setConnected(false);
    replacementPart.setConnected(true);
    resolveOld('stale');
    await promise;
    await Promise.resolve();
    equal(root.textContent, 'replacement', 'plain sync ancestor replacement suppresses stale async value');

    const events = [];
    class Subscription extends AsyncDirective {
      render(id) {
        this.id = id;
        events.push([id, this.isConnected ? 'initial-connected' : 'initial-detached']);
        return id;
      }
      disconnected() { events.push([this.id, 'disconnected']); }
      reconnected() { events.push([this.id, 'reconnected']); }
    }
    const subscription = directive(Subscription);
    const wrapped = id => guard([id], () => guard([id], () => subscription(id)));
    const part = render(view(wrapped('old')), root);
    part.setConnected(false);
    part.setConnected(false);
    part.setConnected(true);
    part.setConnected(true);
    equal(events, [['old', 'initial-connected'], ['old', 'disconnected'], ['old', 'reconnected']], 'nested sync ancestors reconnect exactly once');
    part.setConnected(false);
    render(view(wrapped('new')), root);
    part.setConnected(true);
    render(nothing, root);
    part.setConnected(false);
    part.setConnected(true);
    equal(events, [['old', 'initial-connected'], ['old', 'disconnected'], ['old', 'reconnected'], ['old', 'disconnected'], ['new', 'initial-detached'], ['new', 'reconnected'], ['new', 'disconnected']], 'replacement while detached never reconnects disposed child');
    // A second evaluation of the same public module has a distinct class identity.
    const {Directive: OtherDirective, directive: otherDirective} = await import(
      import.meta.resolve('@mnjs/html/directive') + '?same-version-copy'
    );
    class Wrapper extends OtherDirective { render(value) { return value; } }
    const wrap = otherDirective(Wrapper);
    events.length = 0;
    render(view(wrap(subscription('copy'))), root);
    render(view('done'), root);
    equal(events, [['copy', 'initial-connected'], ['copy', 'disconnected']], 'same-version duplicate Directive class disposes descendants');
    events.length = 0;
    const rows = ids => html`${repeat(ids, id => id, id => html`<p data-id=${id}>${wrapped(id)}</p>`)}`;
    render(rows(['a', 'b']), root);
    const first = root.firstElementChild;
    render(rows(['b', 'a']), root);
    equal(root.lastElementChild === first, true, 'repeat preserves wrapped subscription node');
    equal(events, [['a', 'initial-connected'], ['b', 'initial-connected']], 'repeat reorder does not disconnect');
    render(rows(['b']), root);
    equal(events.at(-1), ['a', 'disconnected'], 'repeat deletion disposes once');
    render(nothing, root);
    equal(events.filter(([id, phase]) => id === 'a' && phase === 'disconnected').length, 1, 'removed repeated row stays disposed');

    events.length = 0;
    const cached = show => html`${cache(show ? html`<section>${wrapped('cached')}</section>` : html`<aside>other</aside>`)}`;
    render(cached(true), root);
    const cachedNode = root.firstElementChild;
    render(cached(false), root);
    render(cached(true), root);
    equal(root.firstElementChild === cachedNode, true, 'cache restores same DOM');
    equal(events, [['cached', 'initial-connected'], ['cached', 'disconnected'], ['cached', 'reconnected']], 'cached sync ancestors reconnect rather than dispose');
    render(nothing, root);
    equal(events.at(-1), ['cached', 'disconnected'], 'cache removal releases child');

    let resolveAttribute;
    const pendingAttribute = new Promise(resolve => { resolveAttribute = resolve; });
    const attribute = value => html`<p title="prefix ${value} / ${'neighbor'}"></p>`;
    render(attribute(guard(['attr'], () => until(pendingAttribute, 'waiting'))), root);
    const attributePart = render(attribute('replacement'), root);
    attributePart.setConnected(false);
    attributePart.setConnected(true);
    resolveAttribute('stale');
    await pendingAttribute;
    await Promise.resolve();
    equal(root.firstElementChild.title, 'prefix replacement / neighbor', 'disposed async attribute cannot overwrite slot or neighbor');
    return {plainSyncAncestorReplacement: true, nestedReconnect: true, detachedReplacement: true, duplicateDirectiveClass: true, repeatOwnership: true, cacheReconnect: true, attributeOwnership: true};
  } finally {
    render(nothing, root).setConnected(false);
    root.remove();
  }
}

export function commentCloseRegressions() {
  const templates = [
    value => html`<!--x--><p title=${value}>${value}</p>`,
    value => html`<!--x--!><p title=${value}>${value}</p>`,
    value => html`<!-- ${'ignored'} --!><p title=${value}>${value}</p>`,
  ];
  for (const template of templates) {
    const root = document.createElement('div');
    try {
      const value = '<img src=x onerror=alert(1)>';
      render(template(value), root);
      const p = root.querySelector('p');
      equal([p.title, p.textContent, p.querySelector('img')], [value, value, null], 'comment close preserves escaped attribute/text bindings');
      render(template('updated'), root);
      equal([root.querySelector('p') === p, p.title, p.textContent], [true, 'updated', 'updated'], 'comment close subsequent update');
    } finally { render(nothing, root); }
  }
  const root = document.createElement('div');
  let error;
  try { render(html`<!--x--!><button @click=${() => {}}>button</button>`, root); }
  catch (caught) { error = String(caught); }
  equal(error?.includes('MN_HTML_EVENT_BINDING'), true, 'alternate comment close preserves forbidden event binding diagnostic');
  return {commentCloseBindings: true, alternateCloseEventDiagnostic: true};
}
