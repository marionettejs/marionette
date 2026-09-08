import { vi, describe, it, expect } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import { Behavior, CollectionView, View } from 'marionette';

describe('View DOM event delegation', function() {
  [
    ['View', View],
    ['CollectionView', CollectionView]
  ].forEach(([name, ViewClass]) => {
    it(`initializes ${name} delegation through the public methods`, function() {
      const trace = [];
      const DelegatingView = ViewClass.extend({
        undelegateEvents() {
          trace.push(['undelegateEvents', this.el]);
          return ViewClass.prototype.undelegateEvents.call(this);
        },
        delegateEvents(events) {
          trace.push(['delegateEvents', this.el, events]);
          return ViewClass.prototype.delegateEvents.call(this, events);
        }
      });
      const root = document.createElement('div');
      const view = new DelegatingView({ el: root });
      expect(trace).to.deep.equal([
        ['delegateEvents', root, undefined],
        ['undelegateEvents', root]
      ]);
      view.destroy();
    });
  });

  [
    ['View', View],
    ['CollectionView', CollectionView]
  ].forEach(([name, ViewClass]) => {

  });

  it('redelegates an explicit map with View triggers and Behavior handlers', function() {
    setFixtures(`
      <div id="view">
        <button class="instance"></button>
        <button class="explicit"></button>
        <button class="behavior"></button>
        <form></form>
      </div>
    `);

    const instanceHandler = vi.fn();
    const explicitHandler = vi.fn();
    const behaviorHandler = vi.fn();
    const viewTrigger = vi.fn();
    const behaviorTrigger = vi.fn();
    const TestBehavior = Behavior.extend({
      events: { 'click .behavior': behaviorHandler },
      triggers: { 'focus .behavior': 'behavior:focused' }
    });
    const TestView = View.extend({
      events: { 'click .instance': instanceHandler },
      triggers: { 'submit form': 'form:submitted' },
      behaviors: [TestBehavior]
    });
    const view = new TestView({ el: document.getElementById('view') });
    view.on('form:submitted', viewTrigger);
    view.on('behavior:focused', behaviorTrigger);

    expect(view.delegateEvents({ 'click .explicit': explicitHandler })).to.equal(view);
    expect(view.delegateEvents({ 'click .explicit': explicitHandler })).to.equal(view);

    view.el.querySelector('.instance').click();
    view.el.querySelector('.explicit').click();
    view.el.querySelector('.behavior').click();
    view.el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
    view.el.querySelector('.behavior').dispatchEvent(new Event('focus', { bubbles: true }));

    expect(instanceHandler).not.toHaveBeenCalled();
    expect(explicitHandler).toHaveBeenCalledTimes(1);
    expect(behaviorHandler).toHaveBeenCalledTimes(1);
    expect(viewTrigger).toHaveBeenCalledTimes(1);
    expect(behaviorTrigger).toHaveBeenCalledTimes(1);

    expect(view.undelegateEvents()).to.equal(view);
    view.el.querySelector('.explicit').click();
    view.el.querySelector('.behavior').click();
    view.el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));

    expect(explicitHandler).toHaveBeenCalledTimes(1);
    expect(behaviorHandler).toHaveBeenCalledTimes(1);
    expect(viewTrigger).toHaveBeenCalledTimes(1);
  });

  it('re-resolves callable event maps and changed UI selectors without duplicates', function() {
    setFixtures('<div id="view"></div>');

    const handler = vi.fn();
    const events = vi.fn().mockImplementation(function() {
      return { 'click @ui.target': handler };
    });
    const TestView = View.extend({
      ui: { target: '.first' },
      events
    });
    const view = new TestView({ el: document.getElementById('view') });
    view.el.innerHTML = '<button class="first"></button><button class="second"></button>';
    view.ui = { target: '.second' };

    view.delegateEvents();
    view.delegateEvents();
    view.el.querySelector('.first').click();
    view.el.querySelector('.second').click();

    expect(events).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('treats delegation calls on a destroyed View as chainable no-ops', function() {
    const handler = vi.fn();
    const behaviorHandler = vi.fn();
    const TestBehavior = Behavior.extend({ events: { click: behaviorHandler } });
    const view = new View({ events: { click: handler }, behaviors: [TestBehavior] });
    view.el.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(behaviorHandler).toHaveBeenCalledTimes(1);
    view.destroy();

    expect(view.delegateEvents()).to.equal(view);
    expect(view.undelegateEvents()).to.equal(view);
    view.el.click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(behaviorHandler).toHaveBeenCalledTimes(1);
  });

  it('is available and chainable on CollectionView', function() {
    const view = new CollectionView();

    expect(view.delegateEvents()).to.equal(view);
    expect(view.undelegateEvents()).to.equal(view);
  });
});
