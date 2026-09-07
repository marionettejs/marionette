import { renderView, destroyView } from '../../../src/modules/common/view';
import View from '../../../src/modules/view';

describe('common view methods', function() {
  it('uses the View render lifecycle once when ensuring rendered content', function() {
    const view = new View({ template: () => '<span>Rendered</span>' });
    const beforeRender = this.sinon.spy();
    const render = this.sinon.spy();
    view.on('before:render', beforeRender);
    view.on('render', render);
    renderView(view);
    renderView(view);
    expect(view.el.textContent).to.equal('Rendered');
    expect(beforeRender).to.have.been.calledOnce;
    expect(render).to.have.been.calledOnce;
    view.destroy();
  });

  it('delegates destruction and the detach-events setting to the View', function() {
    const view = new View();
    const beforeDestroy = this.sinon.spy();
    const destroy = this.sinon.spy();
    view.on('before:destroy', beforeDestroy);
    view.on('destroy', destroy);
    destroyView(view, true);
    expect(view._disableDetachEvents).to.equal(true);
    expect(view.isDestroyed()).to.equal(true);
    expect(beforeDestroy).to.have.been.calledOnce;
    expect(destroy).to.have.been.calledOnce;
  });
});
