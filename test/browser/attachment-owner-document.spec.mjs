import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

for (const imported of [false, true]) {
  test(`${imported ? 'imported' : 'direct'} template content attaches parent and child once`, async({ umdPage: page }) => {
    const result = await page.evaluate(importedClone => {
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
          parentAttached: parent.isAttached(),
          childAttached: child.isAttached(),
          parentAttach,
          childAttach
        };

        const region = new Marionette.Region({ el: '#content' });
        region.show(parent);

        const outcome = {
          before,
          after: {
            parentAttached: parent.isAttached(),
            childAttached: child.isAttached(),
            parentAttach,
            childAttach
          }
        };
        region.destroy();
        return outcome;
      }

      const template = document.createElement('template');
      template.innerHTML = '<section><div class="child-region"></div></section>';
      const clone = template.content.firstElementChild;
      return exercise(importedClone ? document.importNode(clone, true) : clone, '.child-region');
    }, imported);
    assert.deepEqual(result.before, {
      hasDocumentElement: imported,
      parentAttached: false,
      childAttached: false,
      parentAttach: 0,
      childAttach: 0
    });
    assert.deepEqual(result.after, {
      parentAttached: true,
      childAttached: true,
      parentAttach: 1,
      childAttach: 1
    });
  });
}
