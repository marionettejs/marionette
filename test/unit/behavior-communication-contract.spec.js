import Behavior from '../../modules/behavior';
import View from '../../modules/view';

describe('Behavior communication contract', function() {
  it('broadcasts host triggerMethod calls to top-level and nested Behaviors after the host method', function() {
    const sequence = [];
    const payload = { value: 'status' };
    const hostHandler = this.sinon.spy(function() {
      sequence.push('host');
    });
    const parentHandler = this.sinon.spy(function() {
      sequence.push('parent');
    });
    const nestedHandler = this.sinon.spy(function() {
      sequence.push('nested');
    });
    const siblingHandler = this.sinon.spy(function() {
      sequence.push('sibling');
    });
    let parentBehavior;
    let nestedBehavior;
    let siblingBehavior;

    const NestedBehavior = Behavior.extend({
      initialize() {
        nestedBehavior = this;
      },
      onStatusChanged: nestedHandler,
    });
    const ParentBehavior = Behavior.extend({
      behaviors: [NestedBehavior],
      initialize() {
        parentBehavior = this;
      },
      onStatusChanged: parentHandler,
    });
    const SiblingBehavior = Behavior.extend({
      initialize() {
        siblingBehavior = this;
      },
      onStatusChanged: siblingHandler,
    });
    const TestView = View.extend({
      behaviors: [ParentBehavior, SiblingBehavior],
      onStatusChanged: hostHandler,
    });
    const view = new TestView();

    view.triggerMethod('status:changed', payload, 'extra');

    expect(sequence[0]).to.equal('host');
    expect(sequence.slice(1)).to.have.members(['parent', 'nested', 'sibling']);
    [
      [hostHandler, view],
      [parentHandler, parentBehavior],
      [nestedHandler, nestedBehavior],
      [siblingHandler, siblingBehavior],
    ].forEach(([handler, context]) => {
      expect(handler).to.have.been.calledOnce;
      expect(handler.firstCall.args).to.deep.equal([payload, 'extra']);
      expect(handler.firstCall.thisValue).to.equal(context);
    });

    view.destroy();
  });

  it('keeps Behavior triggerMethod calls local to that Behavior', function() {
    const payload = { value: 'local' };
    const senderHandler = this.sinon.spy();
    const senderEvent = this.sinon.spy();
    const siblingHandler = this.sinon.spy();
    const hostHandler = this.sinon.spy();
    const hostEvent = this.sinon.spy();
    let senderBehavior;

    const SenderBehavior = Behavior.extend({
      initialize() {
        senderBehavior = this;
      },
      onLocalChange: senderHandler,
    });
    const SiblingBehavior = Behavior.extend({
      onLocalChange: siblingHandler,
    });
    const TestView = View.extend({
      behaviors: [SenderBehavior, SiblingBehavior],
      onLocalChange: hostHandler,
    });
    const view = new TestView();
    senderBehavior.on('local:change', senderEvent);
    view.on('local:change', hostEvent);

    senderBehavior.triggerMethod('local:change', payload);

    expect(senderHandler).to.have.been.calledOnce;
    expect(senderHandler.firstCall.args).to.deep.equal([payload]);
    expect(senderHandler.firstCall.thisValue).to.equal(senderBehavior);
    expect(senderEvent).to.have.been.calledOnce.and.calledWithExactly(payload);
    expect(siblingHandler).to.not.have.been.called;
    expect(hostHandler).to.not.have.been.called;
    expect(hostEvent).to.not.have.been.called;

    view.destroy();
  });

  it('broadcasts an explicit host triggerMethod call back to every Behavior including the sender', function() {
    const sequence = [];
    const payload = { value: 'save' };
    const hostHandler = this.sinon.spy(function() {
      sequence.push('host');
    });
    const senderHandler = this.sinon.spy(function() {
      sequence.push('sender');
    });
    const siblingHandler = this.sinon.spy(function() {
      sequence.push('sibling');
    });
    let senderBehavior;

    const SenderBehavior = Behavior.extend({
      initialize() {
        senderBehavior = this;
      },
      onSaveRequested: senderHandler,
    });
    const SiblingBehavior = Behavior.extend({
      onSaveRequested: siblingHandler,
    });
    const TestView = View.extend({
      behaviors: [SenderBehavior, SiblingBehavior],
      onSaveRequested: hostHandler,
    });
    const view = new TestView();

    senderBehavior.view.triggerMethod('save:requested', payload);

    expect(sequence[0]).to.equal('host');
    expect(sequence.slice(1)).to.have.members(['sender', 'sibling']);
    expect(hostHandler).to.have.been.calledOnce.and.calledOn(view);
    expect(senderHandler).to.have.been.calledOnce.and.calledOn(senderBehavior);
    expect(siblingHandler).to.have.been.calledOnce;
    [hostHandler, senderHandler, siblingHandler].forEach(handler => {
      expect(handler.firstCall.args).to.deep.equal([payload]);
    });

    view.destroy();
  });

  it('keeps childViewEvents handlers local to the host unless they explicitly broadcast', function() {
    const payload = { value: 'child' };
    const hostHandler = this.sinon.spy();
    const behaviorHandler = this.sinon.spy();

    const TestBehavior = Behavior.extend({
      onChildBoom: behaviorHandler,
    });
    const ChildView = View.extend({
      template() {
        return '';
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return '<div class="child"></div>';
      },
      regions: {
        child: '.child',
      },
      childViewEvents: {
        'child:boom': 'handleChildBoom',
      },
      handleChildBoom: hostHandler,
    });
    const view = new TestView();
    const childView = new ChildView();
    view.render();
    view.showChildView('child', childView);

    childView.triggerMethod('child:boom', payload);

    expect(hostHandler).to.have.been.calledOnce.and.calledOn(view);
    expect(hostHandler).to.have.been.calledWithExactly(payload);
    expect(behaviorHandler).to.not.have.been.called;

    view.destroy();
  });

  it('emits Behavior DOM triggers on the host and broadcasts them to all Behaviors', function() {
    const sequence = [];
    const hostHandler = this.sinon.spy(function() {
      sequence.push('host');
    });
    const sourceHandler = this.sinon.spy(function() {
      sequence.push('source');
    });
    const nestedHandler = this.sinon.spy(function() {
      sequence.push('nested');
    });
    const siblingHandler = this.sinon.spy(function() {
      sequence.push('sibling');
    });
    let sourceBehavior;
    let nestedBehavior;
    let siblingBehavior;

    const NestedBehavior = Behavior.extend({
      initialize() {
        nestedBehavior = this;
      },
      onSaveRequested: nestedHandler,
    });
    const SourceBehavior = Behavior.extend({
      behaviors: [NestedBehavior],
      triggers: {
        'click .save': 'save:requested',
      },
      initialize() {
        sourceBehavior = this;
      },
      onSaveRequested: sourceHandler,
    });
    const SiblingBehavior = Behavior.extend({
      initialize() {
        siblingBehavior = this;
      },
      onSaveRequested: siblingHandler,
    });
    const TestView = View.extend({
      behaviors: [SourceBehavior, SiblingBehavior],
      template() {
        return '<button class="save">Save</button>';
      },
      onSaveRequested: hostHandler,
    });
    const view = new TestView();
    view.render();

    view.el.querySelector('.save').click();

    expect(sequence[0]).to.equal('host');
    expect(sequence.slice(1)).to.have.members(['source', 'nested', 'sibling']);
    const event = hostHandler.firstCall.args[1];
    [
      [hostHandler, view],
      [sourceHandler, sourceBehavior],
      [nestedHandler, nestedBehavior],
      [siblingHandler, siblingBehavior],
    ].forEach(([handler, context]) => {
      expect(handler).to.have.been.calledOnce;
      expect(handler.firstCall.args).to.deep.equal([view, event]);
      expect(handler.firstCall.thisValue).to.equal(context);
    });
    expect(event.type).to.equal('click');

    view.destroy();
  });
});
