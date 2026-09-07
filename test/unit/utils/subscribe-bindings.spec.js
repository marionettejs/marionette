import Backbone from 'backbone';
import BackboneApi from '../../../packages/adapters/src/data/backbone';
import subscribeBindings from '../../../src/utils/subscribe-bindings';

describe('subscribe bindings', function() {
  it('binds named and direct handlers and releases every subscription', function() {
    const model = new Backbone.Model();
    const context = { onChange: this.sinon.spy() };
    const directHandler = this.sinon.spy();
    const cleanup = subscribeBindings(context, BackboneApi, model, {
      'change reset': 'onChange',
      custom: directHandler
    });

    expect(context.onChange).to.not.have.been.called;
    model.trigger('change', 1);
    model.trigger('reset', 2);
    model.trigger('custom', 3);
    expect(context.onChange).to.have.been.calledTwice.and.calledOn(context);
    expect(context.onChange.firstCall).to.have.been.calledWithExactly(1);
    expect(context.onChange.secondCall).to.have.been.calledWithExactly(2);
    expect(directHandler).to.have.been.calledOnce.and.calledOn(context).and.calledWithExactly(3);

    cleanup();
    model.trigger('change');
    model.trigger('reset');
    model.trigger('custom');
    expect(context.onChange).to.have.been.calledTwice;
    expect(directHandler).to.have.been.calledOnce;
  });
});
