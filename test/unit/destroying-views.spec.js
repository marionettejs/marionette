import { vi, describe, it, expect, beforeEach } from 'vitest';
import { View } from 'marionette';


describe('destroying views', function() {
  'use strict';

  describe('when destroying a Marionette.View multiple times', function() {
    let onDestroyStub;
    let view;

    beforeEach(function() {
      onDestroyStub = vi.fn(function() {
        return this.isRendered();
      });

      view = new View();
      view.onDestroy = onDestroyStub;

      view.destroy();
      view.destroy();
    });

    it('should only run the destroying code once', function() {
      expect(onDestroyStub).toHaveBeenCalledTimes(1);
    });

    it('should mark the view as destroyed', function() {
      expect(view.isDestroyed()).to.equal(true);
    });
  });

  describe('when destroying a Marionette.View multiple times', function() {
    let onBeforeDestroyStub;
    let view;

    beforeEach(function() {
      onBeforeDestroyStub = vi.fn();

      view = new View();
      view.onBeforeDestroy = onBeforeDestroyStub;

      view.destroy();
      view.destroy();
    });

    it('should only run the destroying code once', function() {
      expect(onBeforeDestroyStub).toHaveBeenCalledTimes(1);
    });

    it('should mark the view as destroyed', function() {
      expect(view.isDestroyed()).to.equal(true);
    });
  });
});
