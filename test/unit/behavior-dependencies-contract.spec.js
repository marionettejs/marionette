import Behavior from '../../src/modules/behavior';
import MnObject from '../../src/modules/object';
import View from '../../src/modules/view';

describe('Behavior dependency contract', function() {
  it('resolves an injected collaborator and exact host during initialize', function() {
    const defaultService = new MnObject();
    const injectedService = new MnObject();
    let behavior;
    let initializedHost;
    let initializedService;

    const TestBehavior = Behavior.extend({
      options: {
        service: defaultService,
      },
      initialize(options, hostView) {
        behavior = this;
        initializedHost = hostView;
        initializedService = this.getOption('service');
      },
    });
    const TestView = View.extend({
      behaviors: [{
        behaviorClass: TestBehavior,
        service: injectedService,
      }],
    });
    const view = new TestView();

    expect(initializedService).to.equal(injectedService);
    expect(initializedService).to.not.equal(defaultService);
    expect(initializedHost).to.equal(view);
    expect(behavior.view).to.equal(view);
    expect(behavior).to.not.have.property('service');

    view.destroy();
    defaultService.destroy();
    injectedService.destroy();
  });

  it('uses its own defaults without falling back to host options', function() {
    const defaultService = new MnObject();
    const hostService = new MnObject();
    let behaviorService;
    let behaviorHostOnly;
    let hostOnly;

    const TestBehavior = Behavior.extend({
      options: {
        service: defaultService,
      },
      initialize() {
        behaviorService = this.getOption('service');
        behaviorHostOnly = this.getOption('hostOnly');
        hostOnly = this.view.getOption('hostOnly');
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
    });
    const view = new TestView({
      hostOnly: hostService,
      service: hostService,
    });

    expect(behaviorService).to.equal(defaultService);
    expect(behaviorService).to.not.equal(hostService);
    expect(behaviorHostOnly).to.be.undefined;
    expect(hostOnly).to.equal(hostService);

    view.destroy();
    defaultService.destroy();
    hostService.destroy();
  });

  it('gives nested Behaviors their own options and the same host', function() {
    const parentService = new MnObject();
    const nestedService = new MnObject();
    let parentObservation;
    let nestedObservation;

    const NestedBehavior = Behavior.extend({
      initialize(options, hostView) {
        nestedObservation = {
          hostView,
          service: this.getOption('service'),
          view: this.view,
        };
      },
    });
    const ParentBehavior = Behavior.extend({
      behaviors: [{
        behaviorClass: NestedBehavior,
        service: nestedService,
      }],
      initialize(options, hostView) {
        parentObservation = {
          hostView,
          service: this.getOption('service'),
          view: this.view,
        };
      },
    });
    const TestView = View.extend({
      behaviors: [{
        behaviorClass: ParentBehavior,
        service: parentService,
      }],
    });
    const view = new TestView();

    expect(parentObservation).to.deep.equal({
      hostView: view,
      service: parentService,
      view,
    });
    expect(nestedObservation).to.deep.equal({
      hostView: view,
      service: nestedService,
      view,
    });

    view.destroy();
    parentService.destroy();
    nestedService.destroy();
  });

  it('removes only its own collaborator subscription on direct destroy', function() {
    const service = new MnObject();
    const behaviorListener = this.sinon.spy();
    const unrelatedListener = this.sinon.spy();
    let behavior;

    service.on('change', unrelatedListener);

    const TestBehavior = Behavior.extend({
      initialize() {
        behavior = this;
        this.listenTo(this.getOption('service'), 'change', behaviorListener);
      },
    });
    const TestView = View.extend({
      behaviors: [{
        behaviorClass: TestBehavior,
        service,
      }],
    });
    const view = new TestView();

    service.trigger('change');
    expect(behaviorListener).to.have.been.calledOnce;
    expect(unrelatedListener).to.have.been.calledOnce;

    behavior.destroy();
    service.trigger('change');

    expect(behaviorListener).to.have.been.calledOnce;
    expect(unrelatedListener).to.have.been.calledTwice;
    expect(service.isDestroyed()).to.be.false;

    view.destroy();
    service.off();
    service.destroy();
  });

  it('removes only its own collaborator subscription on host destroy', function() {
    const service = new MnObject();
    const behaviorListener = this.sinon.spy();
    const unrelatedListener = this.sinon.spy();

    service.on('change', unrelatedListener);

    const TestBehavior = Behavior.extend({
      initialize() {
        this.listenTo(this.getOption('service'), 'change', behaviorListener);
      },
    });
    const TestView = View.extend({
      behaviors: [{
        behaviorClass: TestBehavior,
        service,
      }],
    });
    const view = new TestView();

    service.trigger('change');
    expect(behaviorListener).to.have.been.calledOnce;
    expect(unrelatedListener).to.have.been.calledOnce;

    view.destroy();
    service.trigger('change');

    expect(behaviorListener).to.have.been.calledOnce;
    expect(unrelatedListener).to.have.been.calledTwice;
    expect(service.isDestroyed()).to.be.false;

    service.off();
    service.destroy();
  });
});
