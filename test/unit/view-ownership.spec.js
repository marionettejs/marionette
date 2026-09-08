import { vi, describe, it, expect } from 'vitest';
import '../setup/backbone.js';
import Backbone from 'backbone';
import { View, Region } from 'marionette';

describe('managed View ownership', function() {

  it('lets a Marionette wrapper own legacy rendering and cleanup', function() {
    const model = new Backbone.Model();
    const received = vi.fn();
    const removed = vi.fn();
    const Legacy = Backbone.View.extend({
      initialize() { this.listenTo(this.model, 'change', received); },
      render() { this.el.textContent = 'legacy'; return this; },
      remove() { removed(); return Backbone.View.prototype.remove.call(this); }
    });
    const Wrapper = View.extend({
      template: () => '<section class="legacy"></section>',
      onRender() {
        this.legacy?.remove();
        this.legacy = new Legacy({ el: this.$('.legacy')[0], model });
        this.legacy.render();
      },
      onDestroy() { this.legacy?.remove(); }
    });
    const region = new Region({ el: document.createElement('div') });
    const view = new Wrapper();
    region.show(view);
    model.set('value', 1);
    view.render();
    model.set('value', 2);
    expect(view.el.textContent).to.equal('legacy');
    expect(received).toHaveBeenCalledTimes(2);
    expect(removed).toHaveBeenCalledTimes(1);
    region.destroy();
    view.destroy();
    model.set('value', 3);
    expect(received).toHaveBeenCalledTimes(2);
    expect(removed).toHaveBeenCalledTimes(2);
  });
});
