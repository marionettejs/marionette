import $ from 'jquery';

import View from '../../../src/modules/view';

const JQueryEventDelegator = {
  delegate({ eventName, selector, handler, rootEl }) {
    const root = $(rootEl);

    if (selector) {
      root.on(eventName, selector, handler);
      return () => root.off(eventName, selector, handler);
    }

    root.on(eventName, handler);
    return () => root.off(eventName, handler);
  }
};

describe('jQuery EventDelegator protocol compatibility', function() {
  it('supports delegated focus, namespaces, programmatic dispatch, and exact cleanup', function() {
    const root = document.createElement('div');
    root.innerHTML = '<input class="field"><button class="action"></button>';
    const onFocus = this.sinon.spy();
    const onAction = this.sinon.spy();
    const TestView = View.extend({
      events: {
        'focus .field': onFocus,
        'click.menu .action': onAction
      }
    });
    TestView.setEventDelegator(JQueryEventDelegator);
    const view = new TestView({ el: root });

    $(root.querySelector('.field')).trigger('focus');
    $(root.querySelector('.action')).trigger('click');

    expect(onFocus).to.have.been.calledOnce;
    expect(onAction).to.have.been.calledOnce;

    view.undelegateEvents();
    $(root.querySelector('.field')).trigger('focus');
    $(root.querySelector('.action')).trigger('click');

    expect(onFocus).to.have.been.calledOnce;
    expect(onAction).to.have.been.calledOnce;
  });

  it('supports direct handlers without selector delegation', function() {
    const root = document.createElement('button');
    const onClick = this.sinon.spy();
    const TestView = View.extend({ events: { click: onClick } });
    TestView.setEventDelegator(JQueryEventDelegator);
    const view = new TestView({ el: root });

    $(root).trigger('click');
    view.destroy();
    $(root).trigger('click');

    expect(onClick).to.have.been.calledOnce;
  });
});
