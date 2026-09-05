import Behavior from '../../src/modules/behavior';
import CollectionView from '../../src/modules/collection-view';
import View from '../../src/modules/view';

describe('View DOM event delegation', function() {
  [
    ['View', View],
    ['CollectionView', CollectionView]
  ].forEach(([name, ViewClass]) => {
    it(`dispatches ${name} element replacement through the public methods in order`, function() {
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
      const original = document.createElement('div');
      const replacement = document.createElement('section');
      const view = new DelegatingView({ el: original });

      expect(trace).to.deep.equal([
        ['undelegateEvents', original],
        ['delegateEvents', original, undefined],
        ['undelegateEvents', original]
      ]);

      trace.length = 0;
      expect(view.setElement(replacement)).to.equal(view);
      expect(trace).to.deep.equal([
        ['undelegateEvents', original],
        ['delegateEvents', replacement, undefined],
        ['undelegateEvents', replacement]
      ]);
    });

    it(`keeps ${name} delegation intact when element validation fails`, function() {
      const handler = this.sinon.stub();
      const original = document.createElement('div');
      original.innerHTML = '<button class="action"></button>';
      const view = new ViewClass({
        el: original,
        events: { 'click .action': handler }
      });
      const delegateSpy = this.sinon.spy(view, 'delegateEvents');
      const undelegateSpy = this.sinon.spy(view, 'undelegateEvents');

      original.querySelector('.action').click();
      expect(() => view.setElement('#invalid'))
        .to.throw()
        .with.property('code', 'MN0001');
      original.querySelector('.action').click();

      expect(view.el).to.equal(original);
      expect(handler).to.have.been.calledTwice;
      expect(delegateSpy).to.not.have.been.called;
      expect(undelegateSpy).to.not.have.been.called;
    });
  });

  [
    ['View', View],
    ['CollectionView', CollectionView]
  ].forEach(([name, ViewClass]) => {
    it(`removes ${ name } DOM handlers when initialize throws`, function() {
      const root = document.createElement('div');
      const button = document.createElement('button');
      const handler = this.sinon.spy();
      const failure = new Error('initialize failed');
      root.append(button);

      const FailingView = ViewClass.extend({
        events: { 'click button': handler },
        initialize() {
          throw failure;
        }
      });

      expect(() => new FailingView({ el: root })).to.throw(failure);
      button.click();

      expect(handler).not.to.have.been.called;
    });
  });

  it('removes Behavior DOM handlers when its host initialize throws', function() {
    const root = document.createElement('div');
    const button = document.createElement('button');
    const handler = this.sinon.spy();
    const failure = new Error('initialize failed');
    root.append(button);

    const TestBehavior = Behavior.extend({
      events: { 'click button': handler }
    });
    const FailingView = View.extend({
      behaviors: [TestBehavior],
      initialize() {
        throw failure;
      }
    });

    expect(() => new FailingView({ el: root })).to.throw(failure);
    button.click();

    expect(handler).not.to.have.been.called;
  });

  it('redelegates an explicit map with View triggers and Behavior handlers', function() {
    this.setFixtures(`
      <div id="view">
        <button class="instance"></button>
        <button class="explicit"></button>
        <button class="behavior"></button>
        <form></form>
      </div>
    `);

    const instanceHandler = this.sinon.stub();
    const explicitHandler = this.sinon.stub();
    const behaviorHandler = this.sinon.stub();
    const viewTrigger = this.sinon.stub();
    const behaviorTrigger = this.sinon.stub();
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

    expect(instanceHandler).to.not.have.been.called;
    expect(explicitHandler).to.have.been.calledOnce;
    expect(behaviorHandler).to.have.been.calledOnce;
    expect(viewTrigger).to.have.been.calledOnce;
    expect(behaviorTrigger).to.have.been.calledOnce;

    expect(view.undelegateEvents()).to.equal(view);
    view.el.querySelector('.explicit').click();
    view.el.querySelector('.behavior').click();
    view.el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));

    expect(explicitHandler).to.have.been.calledOnce;
    expect(behaviorHandler).to.have.been.calledOnce;
    expect(viewTrigger).to.have.been.calledOnce;
  });

  it('re-resolves callable event maps and changed UI selectors without duplicates', function() {
    this.setFixtures('<div id="view"></div>');

    const handler = this.sinon.stub();
    const events = this.sinon.stub().callsFake(function() {
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

    expect(events).to.have.callCount(3);
    expect(handler).to.have.been.calledOnce;
  });

  it('treats delegation calls on a destroyed View as chainable no-ops', function() {
    const view = new View();
    view.destroy();
    const delegateSpy = this.sinon.spy(view, '_delegateViewEvents');
    const undelegateSpy = this.sinon.spy(view, '_undelegateViewEvents');
    const behaviorSpy = this.sinon.spy(view, '_setBehaviorElements');

    expect(view.delegateEvents()).to.equal(view);
    expect(view.undelegateEvents()).to.equal(view);
    expect(delegateSpy).to.not.have.been.called;
    expect(undelegateSpy).to.not.have.been.called;
    expect(behaviorSpy).to.not.have.been.called;
  });

  it('is available and chainable on CollectionView', function() {
    const view = new CollectionView();

    expect(view.delegateEvents()).to.equal(view);
    expect(view.undelegateEvents()).to.equal(view);
  });
});
