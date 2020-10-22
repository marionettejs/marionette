import View from '../../../src/view';
import monitorViewEvents from '../../../src/common/monitor-view-events';

describe('monitorViewEvents', function() {
  describe('when the monitor is disabled', function() {
    let view;

    beforeEach(function() {
      const NonMonitoredView = View.extend({
        monitorViewEvents: false
      });

      view = new NonMonitoredView();

      this.sinon.spy(view, 'on');
    });

    it('should not attach events', function() {
      monitorViewEvents(view);
      expect(view.on).to.not.have.been.called;
    });
  });

  describe('when the view is already monitored', function() {
    let view;

    beforeEach(function() {
      view = new View();

      monitorViewEvents(view);

      this.sinon.spy(view, 'on');
    });

    it('should not attach events', function() {
      monitorViewEvents(view);
      expect(view.on).to.not.have.been.called;
    });
  });
});
