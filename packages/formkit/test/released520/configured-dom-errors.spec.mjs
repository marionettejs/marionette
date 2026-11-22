import {afterEach, expect, it} from 'vitest';
import {DomApi} from 'marionette';
import {FormKitView} from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  for (const view of owners.splice(0).reverse()) {view.destroy();}
  document.body.replaceChildren();
});
function styled(styles, Form = FormKitView) {
  const view = new Form({fields: [], schema: [{$el: 'button', attrs: {style: '$styles'}, children: 'Styled'}], data: {styles}, formProps: {actions: false}});
  owners.push(view);document.body.append(view.el);view.render();
  return {view, button: view.el.querySelector('button')};
}
it('preserves the exact root-slot primary error after its cleanup throws', () => {
  const primary = new Error('root slot attribute primary'), secondary = new Error('root slot detach secondary');
  const calls = [];let cleanup = true, primaryOccurred = false, actual, view;
  class Form extends FormKitView {}
  Form.setDomApi({
    setAttributes(element, attrs) {
      expect(this).toBe(Form.prototype.Dom);
      if ('data-fail' in attrs) {primaryOccurred = true;calls.push('attribute-primary');throw primary;}
      return DomApi.setAttributes.call(this, element, attrs);
    },
    detachEl(element) {
      expect(this).toBe(Form.prototype.Dom);
      if (cleanup && primaryOccurred) {calls.push('detach-secondary');throw secondary;}
      return DomApi.detachEl.call(this, element);
    }
  });
  try {
    view = new Form({fields: [], slots: {default: [{$el: 'aside', attrs: {'data-fail': 'yes'}}]}, formProps: {actions: false}});
    owners.push(view);document.body.append(view.el);view.render();
  } catch (error) {actual = error;} finally {cleanup = false;}
  expect(actual).toBe(primary);expect(calls[0]).toBe('attribute-primary');expect(calls.slice(1)).toContain('detach-secondary');
});
it('releases the unclaimed root slot normally without retrying its failed attribute', () => {
  const primary = new Error('root slot attribute');let failures = 0, detachedSlot = 0;
  class Form extends FormKitView {}
  Form.setDomApi({
    setAttributes(element, attrs) {
      if ('data-fail' in attrs) {failures++;throw primary;}
      return DomApi.setAttributes.call(this, element, attrs);
    },
    detachEl(element) {
      if (failures && element.localName === 'span' && element.style.display === 'contents') {detachedSlot++;}
      return DomApi.detachEl.call(this, element);
    }
  });
  expect(() => new Form({fields: [], slots: {default: [{$el: 'aside', attrs: {'data-fail': 'yes'}}]}, formProps: {actions: false}})).toThrow(primary);
  expect(failures).toBe(1);expect(detachedSlot).toBe(1);
});
it('retains completed style removals when a later style membership test throws', () => {
  const primary = new Error('later style membership');
  const {view, button} = styled({color: 'red', backgroundColor: 'blue'});
  const next = new Proxy({}, {has(_target, key) {if (key === 'backgroundColor') {throw primary;} return false;}});
  expect(() => view.updateData({styles: next})).toThrow(primary);
  expect(button.style.color).toBe('');expect(button.style.backgroundColor).toBe('blue');
});
it('applies custom-property removal before later membership failures through the owning receiver', () => {
  const primary = new Error('membership');const calls = [];let recording = false;
  class Form extends FormKitView {}
  Form.setDomApi({setAttributes(element, attrs) {
    expect(this).toBe(Form.prototype.Dom);
    if (recording && element.localName === 'button' && 'style' in attrs) {calls.push('write');}
    return DomApi.setAttributes.call(this, element, attrs);
  }});
  const {view, button} = styled({'--tone': '1', backgroundColor: 'blue'}, Form);recording = true;
  const next = new Proxy({}, {has(_target, key) {calls.push('has:' + String(key));if (key === 'backgroundColor') {throw primary;} return false;}});
  expect(() => view.updateData({styles: next})).toThrow(primary);
  expect(calls).toEqual(['has:--tone', 'write', 'has:backgroundColor']);
  expect(button.style.getPropertyValue('--tone')).toBe('');expect(button.style.backgroundColor).toBe('blue');
});
it('retains removals before later entry getters fail without partially applying those entries', () => {
  const primary = new Error('style getter');const {view, button} = styled({color: 'red', backgroundColor: 'blue'});let failing = true;
  // Dependency capture may read first; fail only after normalization's removal.
  const next = {get backgroundColor() {if (failing && button.style.color === '') {throw primary;} return 'green';}};
  try {
    expect(() => view.updateData({styles: next})).toThrow(primary);
    expect(button.style.color).toBe('');expect(button.style.backgroundColor).toBe('blue');
  } finally {failing = false;}
  // End the deliberately failing producer; this is not a retry/recovery contract.
  view.destroy();
});
it('does not allocate or write a style normalizer for equal declared styles', () => {
  let creates = 0, writes = 0;
  class Form extends FormKitView {}
  Form.setDomApi({
    createElement(tag) {creates++;return DomApi.createElement.call(this, tag);},
    setAttributes(element, attrs) {if ('style' in attrs) {writes++;} return DomApi.setAttributes.call(this, element, attrs);}
  });
  const {view, button} = styled({color: 'red', '--tone': '1'}, Form);const previous = {creates, writes};
  view.updateData({styles: {color: 'red', '--tone': '1'}});
  expect({creates, writes}).toEqual(previous);expect(button.style.color).toBe('red');expect(button.style.getPropertyValue('--tone')).toBe('1');
});
