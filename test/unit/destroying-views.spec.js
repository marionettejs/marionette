import View from '../../modules/view';


describe('destroying views', function() {
  'use strict';

  describe('when destroying a Marionette.View multiple times', function() {
    let onDestroyStub;
    let view;

    beforeEach(function() {
      onDestroyStub = this.sinon.spy(function() {
        return this.isRendered();
      });

      view = new View();
      view.onDestroy = onDestroyStub;

      view.destroy();
      view.destroy();
    });

    it('should only run the destroying code once', function() {
      expect(onDestroyStub).to.have.been.calledOnce;
    });

    it('should mark the view as destroyed', function() {
      expect(view.isDestroyed()).to.equal(true);
    });
  });

  describe('when destroying a Marionette.View multiple times', function() {
    let onBeforeDestroyStub;
    let view;

    beforeEach(function() {
      onBeforeDestroyStub = this.sinon.stub();

      view = new View();
      view.onBeforeDestroy = onBeforeDestroyStub;

      view.destroy();
      view.destroy();
    });

    it('should only run the destroying code once', function() {
      expect(onBeforeDestroyStub).to.have.been.calledOnce;
    });

    it('should mark the view as destroyed', function() {
      expect(view.isDestroyed()).to.equal(true);
    });
  });
});
