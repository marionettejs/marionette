import { vi, describe, it, expect } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import { Behavior, CollectionView, Region, View } from 'marionette';

for (const [name, Base] of [['View', View], ['CollectionView', CollectionView]]) {
  describe(`${name} fixed root`, function() {
    it('resolves the root once before initializing Behaviors and the View', function() {
      const root = document.createElement('section');
      const resolveRoot = vi.fn().mockReturnValue(root);
      const initialized = [];
      let behavior;
      const clicked = vi.fn();
      const triggered = vi.fn();
      const TestBehavior = Behavior.extend({
        events: { 'click button': clicked },
        triggers: { 'focus button': 'action:focused' },
        initialize() { behavior = this; initialized.push(this.el); }
      });
      const TestView = Base.extend({
        behaviors: [TestBehavior],
        initialize() { initialized.push(this.el); }
      });
      const view = new TestView({ el: resolveRoot, template: () => '<button>Action</button>' });
      view.on('action:focused', triggered);
      expect(initialized).to.deep.equal([root, root]);
      expect(view).not.to.have.property('setElement');
      view.render();
      view.render();
      view.delegateEvents();
      const button = root.querySelector('button');
      button.click();
      button.dispatchEvent(new Event('focus', { bubbles: true }));
      expect(clicked).toHaveBeenCalledTimes(1);
      expect(triggered).toHaveBeenCalledTimes(1);
      expect(resolveRoot).toHaveBeenCalledTimes(1);
      expect(resolveRoot.mock.contexts).toContain(view);
      expect(view.el).to.equal(root);
      expect(behavior.el).to.equal(root);
      view.destroy();
      button.click();
      button.dispatchEvent(new Event('focus', { bubbles: true }));
      expect(clicked).toHaveBeenCalledTimes(1);
      expect(triggered).toHaveBeenCalledTimes(1);
      expect(view.el).to.equal(root);
    });

    it('keeps its root and delegation when moved between Regions', function() {
      setFixtures('<div id="first"></div><div id="second"></div>');
      const first = new Region({ el: '#first' });
      const second = new Region({ el: '#second' });
      const clicked = vi.fn();
      const view = new Base({ template: () => '<button>Action</button>',
        events: { 'click button': clicked } });
      const root = view.el;
      first.show(view);
      const button = root.querySelector('button');
      button.click();
      first.detachView();
      second.show(view);
      button.click();
      expect(view.el).to.equal(root);
      expect(root.parentNode).to.equal(second.el);
      expect(root.querySelector('button')).to.equal(button);
      expect(clicked).toHaveBeenCalledTimes(2);
      first.destroy();
      second.destroy();
      button.click();
      expect(clicked).toHaveBeenCalledTimes(2);
    });
  });
}
