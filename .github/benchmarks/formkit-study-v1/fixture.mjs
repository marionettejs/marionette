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
let dispose, initial, trusted, count, shape;
window.study = {
  mount(n, workload) {
    if (dispose || ![450, 1500].includes(n) || !['flat', 'validated', 'rows'].includes(workload)) throw Error('Bad invocation');
    count = n; shape = workload; trusted = 0;
    dispose = attach(host, { id: formId, type: 'form', actions: false }, specs(n, workload));
    window.study.onInput = event => { if (event.isTrusted && event.target.id === id(count - 1)) trusted++; };
    host.addEventListener('input', window.study.onInput);
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
    const value = shape === 'rows' ? root?.value?.rows?.[count / 5 - 1]?.[name(count - 1)] : root?.value?.[name(count - 1)];
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
  unmount() {
    host.removeEventListener('input', window.study.onInput);
    dispose(); dispose = undefined; initial = undefined;
  },
  clean() {
    return host.childNodes.length === 0 && !getNode(formId) &&
      Array.from({ length: count }, (_, i) => !getNode(id(i))).every(Boolean);
  }
};
