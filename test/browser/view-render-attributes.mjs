import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const browsers = { chromium, firefox, webkit };
const marionette = resolve(import.meta.dirname, '../../dist/marionette.umd.js');
const failures = [];

for (const [browserName, browserType] of Object.entries(browsers)) {
  let browser;

  try {
    browser = await browserType.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<!doctype html><main id="content"></main>');
    await page.addScriptTag({ path: marionette });

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

      const AttributeView = Marionette.View.extend({
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
      selected.Dom.setAttributes(svg, { className: 'owned' });
      const svgClassSet = svg.className.baseVal;
      selected.Dom.setAttributes(svg, { className: null });

      const outcome = {
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
        svgClassAttributeRemoved: !svg.hasAttribute('class')
      };

      previous.destroy();
      selected.destroy();
      return outcome;
    });

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
    assert.equal(result.svgClassSet, 'owned', `${browserName}: direct DomApi sets SVG className`);
    assert.equal(result.svgClassCleared, '', `${browserName}: direct DomApi clears SVG className`);
    assert.equal(result.svgClassAttributeRemoved, true, `${browserName}: direct DomApi removes SVG class`);

    console.log(`${browserName}: root attribute refresh passed`);
  } catch (error) {
    failures.push(new Error(`${browserName}: ${error.message}`, { cause: error }));
  } finally {
    await browser?.close();
  }
}

if (failures.length) {
  throw new AggregateError(failures, 'Root attribute refresh failed.');
}
