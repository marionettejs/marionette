import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('a surviving owner releases replaced screens after their final notifications', async({ page }) => {
  await page.evaluate(async() => {
    const { Behavior, MnObject, Region, View } = await import('marionette');
    const host = document.querySelector('#content');
    const owner = new MnObject();
    const region = new Region({ el: host });
    const results = [];
    let current;
    let sequence = 0;
    const ScreenBehavior = Behavior.extend({
      initialize() {
        this.on('destroy', () => results.push('behavior:destroy'));
      }
    });
    const Screen = View.extend({
      behaviors: [ScreenBehavior],
      template: () => '<button>Next screen</button>',
      triggers: { 'click button': 'next' },
      onDestroy() { results.push('view:destroy'); }
    });
    function showNext() {
      const previous = current;
      const next = new Screen();
      owner.listenTo(next, 'next', showNext);
      owner.listenTo(next, 'destroy', () => results.push('owner:destroy'));
      region.show(next);
      current = next;
      sequence++;
      if (previous) {
        let unsubscriptions = 0;
        const originalOff = previous.off;
        previous.off = function(...args) {
          unsubscriptions++;
          return originalOff.apply(this, args);
        };
        owner.stopListening(previous);
        results.push(unsubscriptions === 0 ? 'released' : 'retained');
        previous.off = originalOff;
        previous.trigger('next');
      }
      host.dataset.sequence = String(sequence);
    }
    showNext();
    window.cleanupEvidence = {
      results,
      finish() {
        region.destroy();
        owner.destroy();
      }
    };
  });

  try {
    for (let index = 0; index < 10; index++) {
      await page.getByRole('button', { name: 'Next screen' }).click();
      assert.equal(await page.locator('#content').getAttribute('data-sequence'), String(index + 2));
    }
    assert.deepEqual(await page.evaluate(() => window.cleanupEvidence.results),
      Array.from({ length: 10 }, () => ['view:destroy', 'owner:destroy', 'behavior:destroy', 'released']).flat());
  } finally {
    await page.evaluate(() => {
      window.cleanupEvidence.finish();
      delete window.cleanupEvidence;
    });
  }
});
