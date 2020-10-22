import Backbone from 'backbone';

import { renderView, destroyView } from '../../../src/common/view';

describe('common view methods', function() {
  let view;

  beforeEach(function() {
    view = new Backbone.View();
    view.triggerMethod = this.sinon.stub();
  });

  describe('#renderView', function() {
    beforeEach(function() {
      view.render = this.sinon.stub();
    });

    describe('when render lifecycle is supported', function() {
      beforeEach(function() {
        view.supportsRenderLifecycle = true;
        renderView(view);
      });

      it('should call render', function() {
        expect(view.render).to.be.calledOnce;
      });

      it('should not trigger events', function() {
        expect(view.triggerMethod).to.not.be.called;
      });

      describe('when view is rendered twice', function() {
        it('should call not call render again', function() {
          renderView(view);

          expect(view.render)
            .to.have.been.calledOnce
            .to.not.have.been.calledTwice;
        });
      });
    });

    describe('when render lifecycle is not supported', function() {
      beforeEach(function() {
        view.supportsRenderLifecycle = false;
        renderView(view);
      });

      it('should trigger before:render', function() {
        expect(view.triggerMethod).to.be.calledWith('before:render', view);
      });

      it('should call render', function() {
        expect(view.render).to.be.calledOnce;
      });

      it('should trigger render', function() {
        expect(view.triggerMethod)
          .to.be.calledWith('render', view);
      });

      describe('when view is rendered twice', function() {
        it('should call not call render again', function() {
          renderView(view);

          expect(view.render)
            .to.have.been.calledOnce
            .to.not.have.been.calledTwice;
        });
      });
    });
  });

  describe('#destroyView', function() {
    beforeEach(function() {
      this.sinon.spy(view, 'remove');
    });

    describe('when view has a native destroy method', function() {
      beforeEach(function() {
        view.destroy = this.sinon.stub();
        destroyView(view, 'foo');
      });

      it('should call the view destroy', function() {
        expect(view.destroy).to.be.calledOnce;
      });

      it('should not call view remove', function() {
        expect(view.remove).to.not.be.called;
      });

      it('should not trigger events', function() {
        expect(view.triggerMethod).to.not.be.called;
      });

      // Internal only test
      it('should attach shouldDisableEvents flag to the view', function() {
        expect(view._disableDetachEvents).to.equal('foo');
      });
    });

    describe('when destroy lifecycle is supported', function() {
      beforeEach(function() {
        view.supportsDestroyLifecycle = true;
        destroyView(view);
      });

      it('should remove the view', function() {
        expect(view.remove).to.be.calledOnce;
      });

      it('should not trigger destroy events', function() {
        expect(view.triggerMethod)
          .to.not.be.calledWith('before:destroy', view)
          .and.not.calledWith('destroy', view);
      });

      // Internal test
      it('should mark the view destroyed', function() {
        expect(view._isDestroyed).to.be.true;
      });
    });

    describe('when destroy lifecycle is not supported', function() {
      beforeEach(function() {
        view.supportsDestroyLifecycle = false;
        destroyView(view);
      });

      it('should trigger before:destroy event', function() {
        expect(view.triggerMethod).to.be.calledWith('before:destroy', view)
      });

      it('should remove the view', function() {
        expect(view.remove).to.be.calledOnce;
      });

      it('should trigger destroy event', function() {
        expect(view.triggerMethod).to.be.calledWith('destroy', view)
      });

      // Internal test
      it('should mark the view destroyed', function() {
        expect(view._isDestroyed).to.be.true;
      });
    });

    // _isAttached is internal Mn flag added by Region or CollectionView
    describe('when view is attached', function() {
      beforeEach(function() {
        view._isAttached = true;
      });

      describe('when disabling events', function() {
        beforeEach(function() {
          destroyView(view, true);
        });

        it('should not trigger detach events', function() {
          expect(view.triggerMethod)
            .to.not.be.calledWith('before:detach', view)
            .and.not.calledWith('detach', view);
        });
      });

      describe('when not disabling events', function() {
        beforeEach(function() {
          destroyView(view, false);
        });

        it('should trigger before:detach event', function() {
          expect(view.triggerMethod).to.be.calledWith('before:detach', view);
        });

        it('should trigger detach event', function() {
          expect(view.triggerMethod).to.be.calledWith('detach', view);
        });
      });
    });

    describe('when view is not attached', function() {
      beforeEach(function() {
        view._isAttached = false;
      });

      describe('when disabling events', function() {
        beforeEach(function() {
          destroyView(view, true);
        });

        it('should not trigger detach events', function() {
          expect(view.triggerMethod)
            .to.not.be.calledWith('before:detach', view)
            .and.not.calledWith('detach', view);
        });
      });

      describe('when not disabling events', function() {
        beforeEach(function() {
          destroyView(view, false);
        });

        it('should not trigger detach events', function() {
          expect(view.triggerMethod)
            .to.not.be.calledWith('before:detach', view)
            .and.not.calledWith('detach', view);
        });
      });
    });
  });
});
