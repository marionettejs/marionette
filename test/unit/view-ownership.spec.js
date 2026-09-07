import Backbone from 'backbone';
import View from '../../src/modules/view';
import CollectionView from '../../src/modules/collection-view';
import Region from '../../src/modules/region';

describe('managed View ownership', function() {
  it('rejects a remove-only legacy View before a Region takes ownership', function() {
    const region = new Region({ el: document.createElement('div') });
    const legacy = new Backbone.View();
    expect(() => region.show(legacy)).to.throw().with.property('code', 'MN0006');
    expect(region.hasView()).to.equal(false);
    legacy.remove();
    region.destroy();
  });

  it('rejects a legacy child class without invoking it as a resolver', function() {
    const initialized = this.sinon.spy();
    const Legacy = Backbone.View.extend({ initialize: initialized });
    const list = new CollectionView({ collection: new Backbone.Collection([{}]), childView: Legacy });
    expect(() => list.render()).to.throw().with.property('code', 'MN0012');
    expect(initialized).not.to.have.been.called;
    list.destroy();
  });

  it('rejects a legacy emptyView class', function() {
    const list = new CollectionView({ emptyView: Backbone.View });
    expect(() => list.render()).to.throw().with.property('code', 'MN0022');
    list.destroy();
  });

  it('lets a Marionette wrapper own legacy rendering and cleanup', function() {
    const model = new Backbone.Model();
    const received = this.sinon.spy();
    const removed = this.sinon.spy();
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
    expect(received).to.have.been.calledTwice;
    expect(removed).to.have.been.calledOnce;
    region.destroy();
    view.destroy();
    model.set('value', 3);
    expect(received).to.have.been.calledTwice;
    expect(removed).to.have.been.calledTwice;
  });
});
