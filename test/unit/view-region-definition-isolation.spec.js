import { expect, it } from 'vitest';
import { Region, View } from 'marionette';

for (const objectForm of [false, true]) {
  it(`resolves shared ${objectForm ? 'options-object' : 'string'} Region definitions for each View`, () => {
    const definition = objectForm ? Object.freeze({ el: '@ui.content' }) : '@ui.content';
    const regions = Object.freeze({ content: definition });
    const Layout = View.extend({
      regions,
      template: () => '<section class="first"></section><section class="second"></section>',
    });
    let first;
    let second;
    const firstChild = new View({ template: () => 'First' });
    const secondChild = new View({ template: () => 'Second' });

    try {
      first = new Layout({ ui: { content: '.first' } });
      second = new Layout({ ui: { content: '.second' } });
      first.showChildView('content', firstChild);
      second.showChildView('content', secondChild);
      expect(first.el.querySelector('.first').firstElementChild).toBe(firstChild.el);
      expect(second.el.querySelector('.second').firstElementChild).toBe(secondChild.el);
      expect(first.getRegion('content')).not.toBe(second.getRegion('content'));
      expect(regions.content).toBe(definition);
      if (objectForm) {
        expect(definition.el).toBe('@ui.content');
      } else {
        expect(regions.content).toBe('@ui.content');
      }
    } finally {
      first?.destroy();
      second?.destroy();
      firstChild.destroy();
      secondChild.destroy();
    }
  });
}

it('isolates dynamically added definitions and preserves Region instances and constructors', () => {
  const definition = Object.freeze({ el: '@ui.content', replaceElement: true });
  const regions = Object.freeze({ content: definition });
  const first = new View({ template: false, ui: { content: '.first' } });
  const second = new View({ template: false, ui: { content: '.second' } });
  const supplied = new Region({ el: document.createElement('section') });
  const CustomRegion = Region.extend({ el: document.createElement('aside') });

  try {
    first.addRegions(regions);
    second.addRegions(regions);
    expect(first.getRegion('content').el).toBe('.first');
    expect(second.getRegion('content').el).toBe('.second');
    expect(first.getRegion('content').replaceElement).toBe(true);
    expect(definition.el).toBe('@ui.content');
    expect(first.addRegion('supplied', supplied)).toBe(supplied);
    expect(first.addRegion('custom', CustomRegion)).toBeInstanceOf(CustomRegion);
    first.destroy();
    expect(supplied.isDestroyed()).toBe(true);
  } finally {
    first.destroy();
    second.destroy();
    supplied.destroy();
  }
});
