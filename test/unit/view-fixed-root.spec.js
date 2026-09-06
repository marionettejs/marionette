import Behavior from '../../src/modules/behavior';
import CollectionView from '../../src/modules/collection-view';
import Region from '../../src/modules/region';
import View from '../../src/modules/view';

for (const [name, Base] of [['View', View], ['CollectionView', CollectionView]]) {
  describe(`${name} fixed root`, function() {
    it('resolves the root once before initializing Behaviors and the View', function() {
      const root = document.createElement('section');
      const resolveRoot = this.sinon.stub().returns(root);
      const initialized = [];
      const clicked = this.sinon.spy();
      const triggered = this.sinon.spy();
      const TestBehavior = Behavior.extend({
        events: { 'click button': clicked },
        triggers: { 'focus button': 'action:focused' },
        initialize() { initialized.push(this.el); }
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
      expect(clicked).to.have.been.calledOnce;
      expect(triggered).to.have.been.calledOnce;
      expect(resolveRoot).to.have.been.calledOnce.and.calledOn(view);
      expect(view.el).to.equal(root);
      expect(view._behaviors[0].el).to.equal(root);
      view.destroy();
      button.click();
      button.dispatchEvent(new Event('focus', { bubbles: true }));
      expect(clicked).to.have.been.calledOnce;
      expect(triggered).to.have.been.calledOnce;
      expect(view.el).to.equal(root);
    });

    it('keeps its root and delegation when moved between Regions', function() {
      this.setFixtures('<div id="first"></div><div id="second"></div>');
      const first = new Region({ el: '#first' });
      const second = new Region({ el: '#second' });
      const clicked = this.sinon.spy();
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
      expect(clicked).to.have.been.calledTwice;
      first.destroy();
      second.destroy();
      button.click();
      expect(clicked).to.have.been.calledTwice;
    });
  });
}
