import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('root attribute refresh preserves browser state', async({ umdPage: page, browserName }) => {
  const result = await page.evaluate(() => {
    class AttributeRowElement extends HTMLElement {
      connectedCallback() {
        this.connectedCount = (this.connectedCount || 0) + 1;
      }

      disconnectedCallback() {
        this.disconnectedCount = (this.disconnectedCount || 0) + 1;
      }
    }

    customElements.define('mn-attribute-row', AttributeRowElement);

    const AttributeView = window.Marionette.View.extend({
      tagName: 'mn-attribute-row',

      attributes() {
        return {
          'aria-selected': this.isSelected ? 'true' : 'false'
        };
      },

      className() {
        return this.isSelected ? 'danger' : null;
      },

      events: {
        'click button': 'onClick'
      },

      onClick() {
        this.clickCount = (this.clickCount || 0) + 1;
      },

      onRender() {
        this.renderCount = (this.renderCount || 0) + 1;
      },

      template() {
        return '<button>select</button><input value="preserve focus">';
      }
    });

    const previous = new AttributeView();
    const selected = new AttributeView();
    previous.render();
    selected.render();
    document.querySelector('#content').append(previous.el, selected.el);

    const selectedRoot = selected.el;
    const selectedInput = selected.el.querySelector('input');
    const initialConnected = selectedRoot.connectedCount;

    previous.isSelected = true;
    previous.renderAttributes();
    selectedInput.focus();
    selectedInput.setSelectionRange(2, 8);
    previous.isSelected = false;
    previous.renderAttributes();
    selected.isSelected = true;
    selected.renderAttributes();
    selected.el.querySelector('button').click();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    selected.Dom.setAttributes(svg, { class: 'owned' });
    const svgClassSet = svg.className.baseVal;
    selected.Dom.setAttributes(svg, { class: null });

    const form = document.createElement('form');
    const list = document.createElement('datalist');
    const input = document.createElement('input');
    form.id = 'attribute-form';
    list.id = 'attribute-list';
    document.body.append(form, list, input);
    selected.Dom.setAttributes(input, { form: form.id, list: list.id });
    const inputAssociated = input.form === form && input.list === list;
    selected.Dom.setAttributes(input, { form: null, list: null });
    const inputCleared = input.form === null && input.list === null &&
      !input.hasAttribute('form') && !input.hasAttribute('list');
    input.remove();
    form.remove();
    list.remove();

    const host = document.createElement('button');
    host.setAttribute('data-external', 'keep');
    host.setAttribute('title', 'host title');
    host.disabled = true;
    const HostView = window.Marionette.View.extend({
      attributes: { title: undefined, disabled: null, 'aria-pressed': false }
    });
    const hostView = new HostView({ el: host });
    hostView.renderAttributes();
    const hostAttributesPreserved = host.getAttribute('data-external') === 'keep' &&
      host.getAttribute('title') === 'host title' && !host.disabled &&
      host.getAttribute('aria-pressed') === 'false';
    hostView.destroy();

    const outcome = {
      hostAttributesPreserved,
      rootPreserved: selected.el === selectedRoot,
      focused: document.activeElement === selectedInput,
      selectionStart: selectedInput.selectionStart,
      selectionEnd: selectedInput.selectionEnd,
      selectedClass: selected.el.className,
      selectedAria: selected.el.getAttribute('aria-selected'),
      previousClass: previous.el.className,
      previousAria: previous.el.getAttribute('aria-selected'),
      selectedRenderCount: selected.renderCount,
      previousRenderCount: previous.renderCount,
      clickCount: selected.clickCount,
      connectedCount: selectedRoot.connectedCount,
      disconnectedCount: selectedRoot.disconnectedCount || 0,
      initialConnected,
      svgClassSet,
      svgClassCleared: svg.className.baseVal,
      svgClassAttributeRemoved: !svg.hasAttribute('class'),
      inputAssociated,
      inputCleared
    };

    previous.destroy();
    selected.destroy();
    return outcome;
  });

  assert.equal(result.hostAttributesPreserved, true, `${browserName}: explicit refresh preserves unmanaged attributes`);
  assert.equal(result.rootPreserved, true, `${browserName}: root identity is preserved`);
  assert.equal(result.focused, true, `${browserName}: focus is preserved`);
  assert.equal(result.selectionStart, 2, `${browserName}: selection start is preserved`);
  assert.equal(result.selectionEnd, 8, `${browserName}: selection end is preserved`);
  assert.equal(result.selectedClass, 'danger', `${browserName}: selected class is refreshed`);
  assert.equal(result.selectedAria, 'true', `${browserName}: selected aria state is refreshed`);
  assert.equal(result.previousClass, '', `${browserName}: previous class is removed`);
  assert.equal(result.previousAria, 'false', `${browserName}: previous aria state is refreshed`);
  assert.equal(result.selectedRenderCount, 1, `${browserName}: selected contents render once`);
  assert.equal(result.previousRenderCount, 1, `${browserName}: previous contents render once`);
  assert.equal(result.clickCount, 1, `${browserName}: delegated events remain bound`);
  assert.equal(result.connectedCount, result.initialConnected, `${browserName}: root is not reconnected`);
  assert.equal(result.disconnectedCount, 0, `${browserName}: root is not disconnected`);
  assert.equal(result.svgClassSet, 'owned', `${browserName}: direct DomApi sets SVG class`);
  assert.equal(result.svgClassCleared, '', `${browserName}: direct DomApi clears SVG class`);
  assert.equal(result.svgClassAttributeRemoved, true, `${browserName}: direct DomApi removes SVG class`);
  assert.equal(result.inputAssociated, true, `${browserName}: read-only properties use DOM attributes`);
  assert.equal(result.inputCleared, true, `${browserName}: read-only properties allow attribute removal`);
});
