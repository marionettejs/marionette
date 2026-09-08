import { describe, it, expect, vi } from 'vitest';
import { Events, Region } from 'marionette';
import { triggerMethod } from '@marionette/utils';

describe('Region adoption', function() {
  it('still renders a supported foreign View once across Region adoption', function() {
    const view = {
      ...Events,
      el: document.createElement('article'),
      triggerMethod,
      render: vi.fn(function() { this.el.textContent = 'foreign'; return this; }),
      destroy: vi.fn(function() { this.el.remove(); this.triggerMethod('destroy', this); return this; })
    };
    const first = new Region({ el: document.createElement('section') });
    const second = new Region({ el: document.createElement('aside') });

    first.show(view);
    first.detachView();
    second.show(view);

    expect(view.render).toHaveBeenCalledTimes(1);
    expect(second.currentView).to.equal(view);
    expect(second.el.firstChild).to.equal(view.el);
    expect(view.el.textContent).to.equal('foreign');
    first.destroy();
    second.destroy();
    expect(view.destroy).toHaveBeenCalledTimes(1);
  });

});
