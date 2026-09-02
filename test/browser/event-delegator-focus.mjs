import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const browsers = { chromium, firefox, webkit };
const distribution = resolve(import.meta.dirname, '../../dist/marionette.umd.js');
const failures = [];

for (const [browserName, browserType] of Object.entries(browsers)) {
  let browser;

  try {
    browser = await browserType.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<!doctype html><main id="content"></main>');
    await page.addScriptTag({ path: distribution });

    const results = await page.evaluate(() => {
      function exercise(eventName, stopPropagation) {
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
      }

      return {
        blurDefault: exercise('blur', undefined),
        blurOpen: exercise('blur', false),
        focusDefault: exercise('focus', undefined),
        focusOpen: exercise('focus', false)
      };
    });

    assert.deepEqual(results, {
      blurDefault: {
        beforePostDestroyDispatch: ['trigger'],
        afterPostDestroyDispatch: ['trigger', 'target']
      },
      blurOpen: {
        beforePostDestroyDispatch: ['trigger', 'target'],
        afterPostDestroyDispatch: ['trigger', 'target', 'target']
      },
      focusDefault: {
        beforePostDestroyDispatch: ['trigger'],
        afterPostDestroyDispatch: ['trigger', 'target']
      },
      focusOpen: {
        beforePostDestroyDispatch: ['trigger', 'target'],
        afterPostDestroyDispatch: ['trigger', 'target', 'target']
      }
    }, `${ browserName }: delegated focus and blur ordering and teardown`);

    console.log(`${ browserName }: delegated focus and blur ordering and teardown passed`);
  } catch (error) {
    failures.push(new Error(`${ browserName }: ${ error.message }`, { cause: error }));
  } finally {
    await browser?.close();
  }
}

if (failures.length) {
  throw new AggregateError(failures, 'Delegated focus and blur ordering failed.');
}
