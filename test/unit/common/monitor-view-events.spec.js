import View from '../../../modules/view';
import monitorViewEvents from '../../../modules/common/monitor-view-events';

describe('monitorViewEvents', function() {
  it('ignores a non-Array child collection without traversal', function() {
    const view = new View();
    const child = {
      _isAttached: false,
      triggerMethod: this.sinon.spy()
    };
    view._getImmediateChildren = () => ({ 0: child, length: 1 });

    expect(() => view.trigger('attach', view)).to.not.throw();
    expect(child._isAttached).to.be.false;
    expect(child.triggerMethod).to.not.have.been.called;
  });

  it('traverses the initial child array length with live values', function() {
    const view = new View();
    const calls = [];
    let children;
    const makeChild = name => ({
      _isAttached: false,
      triggerMethod(event, child) {
        expect(this).to.equal(child);
        expect(event).to.equal('attach');
        expect(child._isAttached).to.be.true;
        calls.push(name);
      }
    });
    const first = makeChild('first');
    const originalSecond = makeChild('original second');
    const replacementSecond = makeChild('replacement second');
    const appended = makeChild('appended');

    first.triggerMethod = function(event, child) {
      expect(this).to.equal(child);
      expect(event).to.equal('attach');
      expect(child._isAttached).to.be.true;
      calls.push('first');
      children[1] = replacementSecond;
      children.push(appended);
    };
    children = [first, originalSecond];
    view._getImmediateChildren = () => children;

    view.trigger('attach', view);

    expect(calls).to.deep.equal(['first', 'replacement second']);
    expect(originalSecond._isAttached).to.be.false;
    expect(appended._isAttached).to.be.false;
  });

  it('stops child traversal and propagates the first exception', function() {
    const view = new View();
    const error = new Error('child attach failed');
    const later = { _isAttached: false, triggerMethod: this.sinon.spy() };
    view._getImmediateChildren = () => [{
      _isAttached: false,
      triggerMethod() {
        throw error;
      }
    }, later];

    expect(() => view.trigger('attach', view)).to.throw(error);
    expect(later._isAttached).to.be.false;
    expect(later.triggerMethod).to.not.have.been.called;
  });

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
