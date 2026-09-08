import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

for (const event of ['focus', 'blur']) {
  for (const stops of [undefined, false]) {
    test(`${event} ${stops === false ? 'allows' : 'stops'} target propagation and releases triggers on destroy`, async({ umdPage: page }) => {
      const result = await page.evaluate(({ eventName, stopPropagation }) => {
        const root = document.createElement('section');
        const field = document.createElement('input');
        const other = document.createElement('input');
        const order = [];
        field.className = 'field';
        root.append(field, other);
        document.querySelector('#content').append(root);

        field.addEventListener(eventName, () => order.push('target'));

        const EventView = Marionette.View.extend({
          triggers: {
            [`${ eventName } .field`]: {
              event: `${ eventName }:field`,
              stopPropagation
            }
          }
        });
        const view = new EventView({ el: root });
        view.on(`${ eventName }:field`, () => order.push('trigger'));

        if (eventName === 'focus') {
          field.focus();
        } else {
          field.focus();
          order.length = 0;
          other.focus();
        }

        view.destroy();
        const beforePostDestroyDispatch = [...order];
        field.dispatchEvent(new FocusEvent(eventName));
        root.remove();
        return { beforePostDestroyDispatch, afterPostDestroyDispatch: order };
      }, { eventName: event, stopPropagation: stops });
      const before = stops === false ? ['trigger', 'target'] : ['trigger'];
      assert.deepEqual(result, {
        beforePostDestroyDispatch: before,
        afterPostDestroyDispatch: [...before, 'target']
      });
    });
  }
}
