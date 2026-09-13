import { describe, it, expect, vi } from 'vitest';
import { View, Region } from 'marionette';

describe('Region adoption', function() {
  it('renders a Marionette View once across Region adoption', function() {
    const onRender = vi.fn();
    const onDestroy = vi.fn();
    const view = new View({ tagName: 'article', template: () => 'adopted' });
    view.on('render', onRender);
    view.on('destroy', onDestroy);
    const first = new Region({ el: document.createElement('section') });
    const second = new Region({ el: document.createElement('aside') });

    first.show(view);
    first.detachView();
    second.show(view);

    expect(onRender).toHaveBeenCalledTimes(1);
    expect(second.currentView).to.equal(view);
    expect(second.el.firstChild).to.equal(view.el);
    expect(view.el.textContent).to.equal('adopted');
    first.destroy();
    second.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

});
