import { afterEach, expect, it } from 'vitest';
import { createSchemaRenderer } from '@mnjs/formkit';

const renderers = [];
let sequence = 0;
function render(schema, data = {}) {
  const host = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(host, { schema, data });
  renderers.push(renderer);
  return { host, ...renderer };
}
function elementWithAttributeCallback(callback) {
  const tag = `formkit-event-reentry-${sequence++}`;
  customElements.define(tag, class extends HTMLElement {
    static observedAttributes = ['data-marker'];
    attributeChangedCallback() { callback(this); }
  });
  return tag;
}
afterEach(() => {
  renderers.splice(0).forEach(renderer => renderer.destroy());
  document.body.replaceChildren();
});

it('retains native schema binding order across callback replacements and honors authored reorder', () => {
  const calls = [];
  const first = { onClick: () => calls.push('plain'), onClickPassive: () => calls.push('passive') };
  const schema = { $el: 'button', attrs: first };
  const view = render(schema);
  const button = view.host.firstElementChild;
  button.addEventListener('click', () => calls.push('application'));
  button.click();
  expect(calls).toEqual(['plain', 'passive', 'application']);
  calls.length = 0;
  first.onClick = () => calls.push('next plain');
  view.update();
  button.click();
  expect(calls).toEqual(['next plain', 'passive', 'application']);
  calls.length = 0;
  schema.attrs = { onClickPassive: first.onClickPassive, onClick: first.onClick };
  view.setSchema(schema);
  button.click();
  expect(calls.filter(value => value !== 'application')).toEqual(['passive', 'next plain']);
  view.destroy();
  calls.length = 0;
  button.click();
  expect(calls).toEqual([]);
});

it('retains the element receiver and distinct plain and passive event behavior', () => {
  const seen = [];
  const view = render({ $el: 'button', attrs: {
    onClickPassive(event) { event.preventDefault(); seen.push([this, event.defaultPrevented]); },
    onClick(event) { seen.push([this, event.defaultPrevented]); event.preventDefault(); }
  } });
  const button = view.host.firstElementChild;
  for (let pass = 0; pass < 2; pass++) {
    view.update();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(button.dispatchEvent(event)).toBe(false);
    expect(seen.slice(-2)).toEqual([[button, false], [button, false]]);
  }
});

it('removes a later binding during dispatch without invoking it or duplicating the surviving callback', () => {
  const calls = [];
  let view;
  const schema = { $el: 'button', attrs: {
    onClick() {
      calls.push('first');
      delete schema.attrs.onClickPassive;
      view.setSchema(schema);
    },
    onClickPassive: () => calls.push('removed')
  } };
  view = render(schema);
  const button = view.host.firstElementChild;
  button.click();
  expect(calls).toEqual(['first']);
  button.click();
  expect(calls).toEqual(['first', 'first']);
});

it('delivers the newest callback when an earlier binding replaces a later binding during dispatch', () => {
  const calls = [];
  let view;
  let replaced = false;
  const schema = { $el: 'button', attrs: {
    onClick() {
      calls.push('first');
      if (!replaced) {
        replaced = true;
        schema.attrs.onClickPassive = () => calls.push('new later');
        view.setSchema(schema);
      }
    },
    onClickPassive: () => calls.push('old later')
  } };
  view = render(schema);
  const button = view.host.firstElementChild;
  button.click();
  expect(calls).toEqual(['first', 'new later']);
  button.click();
  expect(calls).toEqual(['first', 'new later', 'first', 'new later']);
  view.destroy();
  button.click();
  expect(calls).toEqual(['first', 'new later', 'first', 'new later']);
});

it('keeps schema bindings unavailable until their original attribute position is reached', () => {
  const calls = [];
  let dispatch = false;
  const tag = elementWithAttributeCallback(element => { if (dispatch) { element.click(); } });
  const view = render({ $el: tag, attrs: { 'data-marker': '$marker', onClick: '$click' } },
    { marker: 'Before', click: () => calls.push('before') });
  dispatch = true;
  view.update({ marker: 'After', click: () => calls.push('after') });
  expect(calls).toEqual([]);
  view.host.firstElementChild.click();
  expect(calls).toEqual(['after']);
});

it('keeps one latest callback after an attribute setter reenters rendering', () => {
  const calls = [];
  let reenter = false;
  let view;
  const tag = elementWithAttributeCallback(() => {
    if (!reenter) { return; }
    reenter = false;
    view.update({ marker: 'Inner', click: () => calls.push('inner') });
  });
  view = render({ $el: tag, attrs: { 'data-marker': '$marker', onClick: '$click' } },
    { marker: 'Before', click: () => calls.push('before') });
  reenter = true;
  view.update({ marker: 'Outer', click: () => calls.push('outer') });
  view.host.firstElementChild.click();
  expect(calls).toEqual(['outer']);
});

it('does not attach a late callback after an attribute setter destroys the renderer', () => {
  const calls = [];
  let stop = false;
  let view;
  const tag = elementWithAttributeCallback(() => { if (stop) { view.destroy(); } });
  view = render({ $el: tag, attrs: { 'data-marker': '$marker', onClick: '$click' } },
    { marker: 'Before', click: () => calls.push('before') });
  const element = view.host.firstElementChild;
  stop = true;
  view.update({ marker: 'After', click: () => calls.push('after') });
  element.click();
  expect(calls).toEqual([]);
});

it('reports an invalid event value after earlier DOM attribute callbacks have run', () => {
  const seen = [];
  const tag = elementWithAttributeCallback(element => seen.push(element.getAttribute('data-marker')));
  const view = render({ $el: tag, attrs: { 'data-marker': '$marker', onClick: '$click' } },
    { marker: 'Before', click() {} });
  seen.length = 0;
  expect(() => view.update({ marker: 'After', click: 'Invalid' })).toThrow('Schema event attributes require function bindings.');
  expect(seen).toEqual(['After']);
  view.destroy();
});
