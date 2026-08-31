import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const browsers = { chromium, firefox, webkit };
const distribution = resolve(import.meta.dirname, '../../dist/marionette.umd.js');

for (const [browserName, browserType] of Object.entries(browsers)) {
  const browser = await browserType.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><main id="content"></main>');
    await page.addScriptTag({ path: distribution });

    const result = await page.evaluate(() => {
      function exercise(element, selector) {
        const childElement = element.ownerDocument.createElement('article');
        let parentAttach = 0;
        let childAttach = 0;

        const Child = Marionette.View.extend({
          el: childElement,
          template: false,
          onAttach() { childAttach += 1; }
        });
        const Parent = Marionette.View.extend({
          el: element,
          template: false,
          regions: { child: selector },
          onAttach() { parentAttach += 1; }
        });
        const parent = new Parent();
        const child = new Child();

        parent.showChildView('child', child);

        const before = {
          hasDocumentElement: !!element.ownerDocument.documentElement,
          parentAttached: parent._isAttached,
          childAttached: child._isAttached,
          parentAttach,
          childAttach
        };

        new Marionette.Region({ el: '#content' }).show(parent);

        return {
          before,
          after: {
            parentAttached: parent._isAttached,
            childAttached: child._isAttached,
            parentAttach,
            childAttach
          }
        };
      }

      const template = document.createElement('template');
      template.innerHTML = '<section><div class="child-region"></div></section>';
      const directClone = template.content.firstElementChild;
      const importedClone = document.importNode(directClone, true);

      const direct = exercise(directClone, '.child-region');
      document.querySelector('#content').replaceChildren();
      const imported = exercise(importedClone, '.child-region');

      return { direct, imported };
    });

    assert.deepEqual(result.direct.before, {
      hasDocumentElement: false,
      parentAttached: false,
      childAttached: false,
      parentAttach: 0,
      childAttach: 0
    }, `${browserName}: direct template-content clone starts detached`);
    assert.deepEqual(result.direct.after, {
      parentAttached: true,
      childAttached: true,
      parentAttach: 1,
      childAttach: 1
    }, `${browserName}: direct template-content clone attaches once`);
    assert.deepEqual(result.imported.before, {
      hasDocumentElement: true,
      parentAttached: false,
      childAttached: false,
      parentAttach: 0,
      childAttach: 0
    }, `${browserName}: imported clone starts detached`);
    assert.deepEqual(result.imported.after, {
      parentAttached: true,
      childAttached: true,
      parentAttach: 1,
      childAttach: 1
    }, `${browserName}: imported clone attaches once`);

    console.log(`${browserName}: attachment lifecycle passed`);
  } finally {
    await browser.close();
  }
}
