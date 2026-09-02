import * as Marionette from '../../index.js';

describe('createMarionette', function() {
  it('builds the default exports and explicit runtimes through one class-family contract', function() {
    const first = Marionette.createMarionette();
    const second = Marionette.createMarionette();
    const classes = ['View', 'CollectionView', 'MnObject', 'Region', 'Behavior', 'Application'];

    for (const name of classes) {
      expect(first[name]).to.not.equal(Marionette[name]);
      expect(first[name]).to.not.equal(second[name]);
      expect(first[name].prototype).to.be.instanceOf(Marionette[name]);
    }
    expect(first.Radio).to.not.equal(Marionette.Radio);
    expect(first.Radio).to.not.equal(second.Radio);
    expect(first.DataApi).to.not.equal(Marionette.DataApi);
    expect(first.DataApi).to.not.equal(second.DataApi);
    expect(first.DomApi).to.not.equal(Marionette.DomApi);
    expect(first.DomApi).to.not.equal(second.DomApi);
    expect(first.StateApi).to.not.equal(Marionette.StateApi);
    expect(first.StateApi).to.not.equal(second.StateApi);
    expect(first.Radio.channel('same-name')).to.equal(first.Radio.channel('same-name'));
    expect(Marionette.Radio.channel('same-name')).to.equal(Marionette.Radio.channel('same-name'));
    expect(first.Radio.channel('same-name')).to.not.equal(Marionette.Radio.channel('same-name'));
  });

  it('isolates renderer, DomApi, DataApi, StateApi, and EventDelegator configuration', function() {
    const first = Marionette.createMarionette();
    const second = Marionette.createMarionette();
    const firstStateSubscribe = this.sinon.stub().returns(() => {});
    const secondStateSubscribe = this.sinon.stub().returns(() => {});
    const firstDelegate = this.sinon.stub().returns(() => {});
    const secondDelegate = this.sinon.stub().returns(() => {});

    first.setRenderer((template, data) => `first-renderer:${ template(data) }`);
    first.setDomApi({ setContents(el, html) { el.textContent = `first-dom:${ html }`; } });
    first.setDataApi({ serialize() { return { label: 'first-data' }; } });
    first.setStateApi({ subscribe: firstStateSubscribe });
    first.setEventDelegator({ delegate: firstDelegate });

    second.setRenderer((template, data) => `second-renderer:${ template(data) }`);
    second.setDomApi({ setContents(el, html) { el.textContent = `second-dom:${ html }`; } });
    second.setDataApi({ serialize() { return { label: 'second-data' }; } });
    second.setStateApi({ subscribe: secondStateSubscribe });
    second.setEventDelegator({ delegate: secondDelegate });

    expect(Marionette.View.prototype._renderHtml).to.not.equal(first.View.prototype._renderHtml);
    expect(Marionette.View.prototype.Dom).to.not.equal(first.View.prototype.Dom);
    expect(Marionette.View.prototype.Data).to.not.equal(first.View.prototype.Data);
    expect(Marionette.View.prototype.State).to.not.equal(first.View.prototype.State);
    expect(Marionette.View.prototype.EventDelegator).to.not.equal(first.View.prototype.EventDelegator);

    const FirstView = first.View.extend({
      events: { click() {} },
      stateEvents: { change() {} },
      template: data => data.label
    });
    const SecondView = second.View.extend({
      events: { click() {} },
      stateEvents: { change() {} },
      template: data => data.label
    });
    const firstState = {};
    const secondState = {};
    const firstView = new FirstView({ model: {}, state: firstState });
    const secondView = new SecondView({ model: {}, state: secondState });
    firstView.render();
    secondView.render();

    expect(firstView.el.textContent).to.equal('first-dom:first-renderer:first-data');
    expect(secondView.el.textContent).to.equal('second-dom:second-renderer:second-data');
    expect(firstStateSubscribe).to.have.been.calledOnce;
    expect(firstStateSubscribe.firstCall.args[0]).to.equal(firstState);
    expect(secondStateSubscribe).to.have.been.calledOnce;
    expect(secondStateSubscribe.firstCall.args[0]).to.equal(secondState);
    expect(firstDelegate).to.have.been.calledOnce;
    expect(firstDelegate.firstCall.args[0].rootEl).to.equal(firstView.el);
    expect(secondDelegate).to.have.been.calledOnce;
    expect(secondDelegate.firstCall.args[0].rootEl).to.equal(secondView.el);
    expect(first.View.prototype.Dom).to.not.equal(second.View.prototype.Dom);
    expect(first.View.prototype.Data).to.not.equal(second.View.prototype.Data);
    expect(first.View.prototype.State).to.not.equal(second.View.prototype.State);
    firstView.destroy();
    secondView.destroy();
  });

  it('isolates Radio channels, owner composition, and debug configuration', function() {
    const first = Marionette.createMarionette();
    const second = Marionette.createMarionette();
    const firstHandler = this.sinon.stub();
    const secondHandler = this.sinon.stub();
    const warn = this.sinon.stub(console, 'warn');
    const FirstObject = first.MnObject.extend({
      channelName: 'shared-name',
      radioEvents: { ping: firstHandler }
    });
    const SecondObject = second.MnObject.extend({
      channelName: 'shared-name',
      radioEvents: { ping: secondHandler }
    });
    const firstObject = new FirstObject();
    const secondObject = new SecondObject();

    expect(firstObject.getChannel()).to.equal(first.Radio.channel('shared-name'));
    expect(secondObject.getChannel()).to.equal(second.Radio.channel('shared-name'));
    expect(firstObject.getChannel()).to.not.equal(secondObject.getChannel());

    first.Radio.trigger('shared-name', 'ping', 1);
    expect(firstHandler).to.have.been.calledOnce.and.calledWith(1);
    expect(secondHandler).to.not.have.been.called;

    second.Radio.trigger('shared-name', 'ping', 2);
    expect(secondHandler).to.have.been.calledOnce.and.calledWith(2);

    first.Radio.setDebug();
    first.Radio.request('shared-name', 'missing');
    second.Radio.request('shared-name', 'missing');
    expect(warn).to.have.been.calledOnce;

    Marionette.Radio.setDebug();
    second.Radio.request('shared-name', 'missing-again');
    Marionette.Radio.request('shared-name', 'missing');
    expect(warn).to.have.been.calledTwice;
    Marionette.Radio.setDebug(false);
    first.Radio.setDebug(false);

    first.Radio.reply('reset-isolation', 'value', 'first');
    Marionette.Radio.reply('reset-isolation', 'value', 'default');
    Marionette.Radio.reset();
    expect(first.Radio.request('reset-isolation', 'value')).to.equal('first');
    first.Radio.reset();
    expect(first.Radio.request('reset-isolation', 'value')).to.be.undefined;

    firstObject.destroy();
    secondObject.destroy();
  });

  it('uses the runtime View, Region, and Application family for implicit composition', async function() {
    const first = Marionette.createMarionette();
    const second = Marionette.createMarionette();
    const root = document.createElement('div');
    root.innerHTML = '<div class="child"></div>';
    const view = new first.View({
      el: root,
      regions: { child: '.child' },
      template: false
    });
    const region = view.getRegion('child');

    expect(region).to.be.instanceOf(first.Region);
    expect(region).to.not.be.instanceOf(second.Region);

    region.show('implicit');
    expect(region.currentView).to.be.instanceOf(first.View);
    expect(region.currentView).to.not.be.instanceOf(second.View);

    const collectionView = new first.CollectionView({ collection: [] });
    expect(collectionView.getEmptyRegion()).to.be.instanceOf(first.Region);

    const suppliedRegion = new first.Region({ el: document.createElement('div') });
    const suppliedRegionView = new first.View({
      regions: { supplied: suppliedRegion },
      template: false
    });
    expect(suppliedRegionView.getRegion('supplied')).to.equal(suppliedRegion);

    const application = new first.Application({ region: { el: document.createElement('div') } });
    const child = new first.Application();
    expect(application.getRegion()).to.be.instanceOf(first.Region);
    expect(application.addChildApp('child', child)).to.equal(child);
    expect(() => application.addChildApp('foreign', new second.Application()))
      .to.throw(first.MarionetteError).and.include({ code: 'MN0031' });
    expect(() => view.addRegion('foreign', new second.Region({ el: document.createElement('div') })))
      .to.throw(first.MarionetteError).and.include({ code: 'MN0030' });
    expect(() => new first.Application({
      region: second.Region
    })).to.throw(first.MarionetteError).and.include({ code: 'MN0030' });
    expect(() => new first.Application({
      region: { el: document.createElement('div'), regionClass: second.Region }
    })).to.throw(first.MarionetteError).and.include({ code: 'MN0030' });

    expect(() => new Marionette.View({
      regions: { child: new first.Region({ el: document.createElement('div') }) },
      template: false
    }))
      .to.throw(Marionette.MarionetteError).and.include({ code: 'MN0030' });

    const defaultApplication = new Marionette.Application();
    expect(() => defaultApplication.addChildApp('foreign', new first.Application()))
      .to.throw(Marionette.MarionetteError).and.include({ code: 'MN0031' });
    expect(() => new Marionette.Application({
      region: { el: document.createElement('div') },
      regionClass: first.Region
    })).to.throw(Marionette.MarionetteError).and.include({ code: 'MN0030' });

    const foreignRegion = new first.Region({ el: document.createElement('div') });
    const foreignView = new second.View({ template: false });
    expect(() => foreignRegion.show(foreignView)).to.not.throw();
    expect(foreignRegion.currentView).to.equal(foreignView);
    foreignRegion.destroy();

    view.destroy();
    collectionView.destroy();
    suppliedRegionView.destroy();
    await application.destroy();
    await defaultApplication.destroy();
  });

  it('starts explicit runtimes from pristine adapters instead of configured root adapters', function() {
    const pristineSerialize = Marionette.DataApi.serialize;
    const previousSerialize = Marionette.View.prototype.Data.serialize;
    const rootSerialize = this.sinon.stub();
    Marionette.View.setDataApi({ serialize: rootSerialize });

    const runtime = Marionette.createMarionette();

    expect(runtime.View.prototype.Data.serialize).to.equal(pristineSerialize);
    expect(runtime.View.prototype.Data.serialize).to.not.equal(rootSerialize);
    Marionette.View.setDataApi({ serialize: previousSerialize });
  });

  it('keeps class-level setters local to a specialized subclass', function() {
    const runtime = Marionette.createMarionette();
    const SpecializedView = runtime.View.extend({ template: () => 'specialized' });
    const renderer = (template, data) => `custom:${ template(data) }`;
    SpecializedView.setRenderer(renderer);

    expect(SpecializedView.prototype._renderHtml).to.equal(renderer);
    expect(runtime.View.prototype._renderHtml).to.not.equal(renderer);

    const specialized = new SpecializedView();
    const ordinary = new runtime.View({ template: () => 'ordinary' });
    specialized.render();
    ordinary.render();
    expect(specialized.el.textContent).to.equal('custom:specialized');
    expect(ordinary.el.textContent).to.equal('ordinary');
    specialized.destroy();
    ordinary.destroy();
  });
});
