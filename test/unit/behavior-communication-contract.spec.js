import { vi, describe, it, expect } from 'vitest';
import { Behavior } from 'marionette';
import { View } from 'marionette';

describe('Behavior communication contract', function() {
  it('broadcasts host triggerMethod calls to top-level and nested Behaviors after the host method', function() {
    const sequence = [];
    const payload = { value: 'status' };
    const hostHandler = vi.fn(function() {
      sequence.push('host');
    });
    const parentHandler = vi.fn(function() {
      sequence.push('parent');
    });
    const nestedHandler = vi.fn(function() {
      sequence.push('nested');
    });
    const siblingHandler = vi.fn(function() {
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
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls.at(0)).to.deep.equal([payload, 'extra']);
      expect(handler.mock.contexts.at(0)).to.equal(context);
    });

    view.destroy();
  });

  it('keeps Behavior triggerMethod calls local to that Behavior', function() {
    const payload = { value: 'local' };
    const senderHandler = vi.fn();
    const senderEvent = vi.fn();
    const siblingHandler = vi.fn();
    const hostHandler = vi.fn();
    const hostEvent = vi.fn();
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

    expect(senderHandler).toHaveBeenCalledTimes(1);
    expect(senderHandler.mock.calls.at(0)).to.deep.equal([payload]);
    expect(senderHandler.mock.contexts.at(0)).to.equal(senderBehavior);
    expect(senderEvent).toHaveBeenCalledTimes(1);
    expect(senderEvent).toHaveBeenCalledWith(payload);
    expect(siblingHandler).not.toHaveBeenCalled();
    expect(hostHandler).not.toHaveBeenCalled();
    expect(hostEvent).not.toHaveBeenCalled();

    view.destroy();
  });

  it('broadcasts an explicit host triggerMethod call back to every Behavior including the sender', function() {
    const sequence = [];
    const payload = { value: 'save' };
    const hostHandler = vi.fn(function() {
      sequence.push('host');
    });
    const senderHandler = vi.fn(function() {
      sequence.push('sender');
    });
    const siblingHandler = vi.fn(function() {
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
    expect(hostHandler).toHaveBeenCalledTimes(1);
    expect(hostHandler.mock.contexts).toContain(view);
    expect(senderHandler).toHaveBeenCalledTimes(1);
    expect(senderHandler.mock.contexts).toContain(senderBehavior);
    expect(siblingHandler).toHaveBeenCalledTimes(1);
    [hostHandler, senderHandler, siblingHandler].forEach(handler => {
      expect(handler.mock.calls.at(0)).to.deep.equal([payload]);
    });

    view.destroy();
  });

  it('keeps childViewEvents handlers local to the host unless they explicitly broadcast', function() {
    const payload = { value: 'child' };
    const hostHandler = vi.fn();
    const behaviorHandler = vi.fn();

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

    expect(hostHandler).toHaveBeenCalledTimes(1);
    expect(hostHandler.mock.contexts).toContain(view);
    expect(hostHandler).toHaveBeenCalledWith(payload);
    expect(behaviorHandler).not.toHaveBeenCalled();

    view.destroy();
  });

  it('emits Behavior DOM triggers on the host and broadcasts them to all Behaviors', function() {
    const sequence = [];
    const hostHandler = vi.fn(function() {
      sequence.push('host');
    });
    const sourceHandler = vi.fn(function() {
      sequence.push('source');
    });
    const nestedHandler = vi.fn(function() {
      sequence.push('nested');
    });
    const siblingHandler = vi.fn(function() {
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
    const event = hostHandler.mock.calls.at(0)[1];
    [
      [hostHandler, view],
      [sourceHandler, sourceBehavior],
      [nestedHandler, nestedBehavior],
      [siblingHandler, siblingBehavior],
    ].forEach(([handler, context]) => {
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls.at(0)).to.deep.equal([view, event]);
      expect(handler.mock.contexts.at(0)).to.equal(context);
    });
    expect(event.type).to.equal('click');

    view.destroy();
  });
});
