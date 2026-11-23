import { getNode } from '@formkit/core';
import { attach } from '#binding';

const host = document.getElementById('host');
const formId = 'study-form';
const id = (index) => 'study-input-' + index;
const name = (index) => 'field_' + index;
const field = (index, validated) => ({
  id: id(index), name: name(index), key: id(index), label: 'Field ' + (index + 1),
  type: 'text', value: '', ...(validated ? { validation: 'required|length:3' } : {})
});
function specs(count, shape) {
  if (shape !== 'rows') {
    return Array.from({ length: count }, (_, i) => field(i, shape === 'validated'));
  }
  return [{ type: 'list', name: 'rows', key: 'rows', children: Array.from({ length: count / 5 }, (_, row) => ({
    type: 'group', key: 'row-' + row, index: row,
    children: Array.from({ length: 5 }, (_, offset) => field(row * 5 + offset, false))
  })) }];
}
let dispose, initial, trusted, count, shape, timed;
function targetValue(root) {
  return shape === 'rows' ? root?.value?.rows?.[count / 5 - 1]?.[name(count - 1)] : root?.value?.[name(count - 1)];
}
window.study = {
  mount(n, workload, measure = false) {
    if (dispose || ![450, 1500].includes(n) || !['flat', 'validated', 'rows'].includes(workload)) throw Error('Bad invocation');
    count = n; shape = workload; trusted = 0;
    timed = measure ? { mountStart: performance.now(), edits: [{ value: 'valid' }, { value: 'warmer' }], next: 0 } : null;
    dispose = attach(host, { id: formId, type: 'form', actions: false }, specs(n, workload));
    if (timed) {
      timed.mountReturn = performance.now();
      timed.root = getNode(formId);
      if (!timed.root) throw Error('Missing root after mount');
      timed.receipt = timed.root.on('commit', () => {
        const edit = timed?.edits[timed.next];
        if (!edit || edit.input === undefined || targetValue(timed.root) !== edit.value) return;
        const leaf = getNode(id(count - 1));
        const sibling = getNode(id(count - 2));
        if (leaf?.value !== edit.value || sibling?.value !== '') return;
        edit.commit = performance.now();
        timed.next++;
      });
    }
    window.study.onInput = event => {
      if (!event.isTrusted || event.target.id !== id(count - 1)) return;
      trusted++;
      const edit = timed?.edits[timed.next];
      if (edit && event.target.value === edit.value && edit.input === undefined) edit.input = performance.now();
    };
    host.addEventListener('input', window.study.onInput, true);
  },
  initial() {
    initial = Array.from(host.querySelectorAll('input'));
    const last = getNode(id(count - 1));
    return initial.length === count && new Set(initial.map(el => el.id)).size === count &&
      initial.every((el, i) => el.id === id(i) && el.name === name(i) && el.labels?.length === 1 &&
        el.labels[0].textContent.trim() === 'Field ' + (i + 1)) && !!last && !!getNode(formId);
  },
  committed(expected) {
    const root = getNode(formId);
    const node = getNode(id(count - 1));
    const sibling = getNode(id(count - 2));
    const value = targetValue(root);
    return trusted > 0 && node?.value === expected && value === expected && sibling?.value === '';
  },
  identityRetained() {
    const actual = Array.from(host.querySelectorAll('input'));
    return actual.length === initial.length && initial.every((element, index) => actual[index] === element);
  },
  errorContains(fragment) {
    const input = document.getElementById(id(count - 1));
    const described = (input?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
      .map(key => document.getElementById(key)?.textContent?.toLowerCase() ?? '');
    return fragment ? described.some(text => text.includes(fragment)) : !described.some(Boolean);
  },
  measuredReady(index) {
    return !!timed && timed.edits[index]?.commit !== undefined;
  },
  unmount() {
    host.removeEventListener('input', window.study.onInput, true);
    if (timed) {
      timed.root.off(timed.receipt);
      timed.root = undefined;
      timed.destroyStart = performance.now();
    }
    dispose(); dispose = undefined; initial = undefined;
    if (timed) timed.destroyReturn = performance.now();
  },
  measurement() {
    if (!this.clean() || timed?.next !== 2 || !(timed.destroyStart <= timed.destroyReturn)) throw Error('Incomplete sample');
    const [first, warm] = timed.edits;
    if (!(timed.mountStart <= timed.mountReturn && timed.mountReturn <= first.input &&
      first.input <= first.commit && first.commit <= warm.input && warm.input <= warm.commit &&
      warm.commit <= timed.destroyStart)) throw Error('Nonmonotonic sample');
    return {
      mountMs: timed.mountReturn - timed.mountStart,
      mountToFirstCommitMs: first.commit - timed.mountStart,
      firstInputToCommitMs: first.commit - first.input,
      warmInputToCommitMs: warm.commit - warm.input,
      destroyMs: timed.destroyReturn - timed.destroyStart
    };
  },
  clean() {
    return host.childNodes.length === 0 && !getNode(formId) &&
      Array.from({ length: count }, (_, i) => !getNode(id(i))).every(Boolean);
  }
};
