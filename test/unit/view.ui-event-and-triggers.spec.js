describe('view ui event trigger configuration', function() {
  'use strict';

  describe('@ui syntax within events and triggers', function() {
    beforeEach(function() {
      this.fooHandlerStub = this.sinon.stub();
      this.barHandlerStub = this.sinon.stub();
      this.notBarHandlerStub = this.sinon.stub();
      this.fooBarBazHandlerStub = this.sinon.stub();

      this.templateFn = _.template('<div id="foo"></div><div id="bar"></div><div id="baz"></div>');

      this.uiHash = {
        foo: '#foo',
        bar: '#bar',
        'some-baz': '#baz'
      };

      this.triggersHash = {
        'click @ui.foo': 'fooHandler',
        'click @ui.some-baz': 'bazHandler'
      };

      this.eventsHash = {
        'click @ui.bar': this.barHandlerStub,
        'click div:not(@ui.bar)': this.notBarHandlerStub,
        'click @ui.foo, @ui.bar, @ui.some-baz': this.fooBarBazHandlerStub
      };
    });

    describe('as objects', function() {
      beforeEach(function() {
        this.View = Marionette.View.extend({
          template: this.templateFn,
          ui: this.uiHash,
          triggers: this.triggersHash,
          events: this.eventsHash
        });
        this.view = new this.View();
        this.view.render();

        this.view.on('fooHandler', this.fooHandlerStub);
      });

      it('should correctly trigger an event', function() {
        this.view.ui.foo[0].click();
        expect(this.fooHandlerStub).to.have.been.calledOnce;
        expect(this.fooBarBazHandlerStub).to.have.been.calledOnce;
      });

      it('should correctly trigger a complex event', function() {
        this.view.ui.bar[0].click();
        expect(this.barHandlerStub).to.have.been.calledOnce;
        expect(this.fooBarBazHandlerStub).to.have.been.calledOnce;
      });

      it('should correctly call an event', function() {
        this.view.ui['some-baz'][0].click();
        expect(this.notBarHandlerStub).to.have.been.calledOnce;
        expect(this.fooBarBazHandlerStub).to.have.been.calledOnce;
      });
    });

    describe('as functions', function() {
      beforeEach(function() {
        this.View = Marionette.View.extend({
          template: this.templateFn,
          ui: this.sinon.stub().returns(this.uiHash),
          triggers: this.sinon.stub().returns(this.triggersHash),
          events: this.sinon.stub().returns(this.eventsHash)
        });
        this.view = new this.View();
        this.view.render();

        this.view.on('fooHandler', this.fooHandlerStub);
      });

      it('should initialize events with context of the view', function() {
        expect(this.View.prototype.events).to.have.been.calledOn(this.view);
      });

      it('should initialize triggers with context of the view', function() {
        expect(this.View.prototype.triggers).to.have.been.calledOn(this.view);
      });

      it('should correctly trigger an event', function() {
        this.view.ui.foo[0].click();
        expect(this.fooHandlerStub).to.have.been.calledOnce;
        expect(this.fooBarBazHandlerStub).to.have.been.calledOnce;
      });

      it('should correctly trigger a complex event', function() {
        this.view.ui.bar[0].click();
        expect(this.barHandlerStub).to.have.been.calledOnce;
        expect(this.fooBarBazHandlerStub).to.have.been.calledOnce;
      });

      it('should correctly call an event', function() {
        this.view.ui['some-baz'][0].click();
        expect(this.notBarHandlerStub).to.have.been.calledOnce;
        expect(this.fooBarBazHandlerStub).to.have.been.calledOnce;
      });
    });
  });

  it('rejects string event handlers that are not present on the view', function() {
    const View = Marionette.View.extend({
      template: _.template('<button class="foo"></button>'),
      events: {
        'click .foo': 'missingHandler'
      }
    });

    expect(() => new View())
      .to.throw('The handler "missingHandler" for "click .foo" must resolve to a function.')
      .with.property('code', 'MN0019');
  });

  it('preflights the complete event map before delegating handlers', function() {
    const delegate = this.sinon.spy(Marionette.View.prototype.EventDelegator, 'delegate');
    const View = Marionette.View.extend({
      events: {
        click: 'onClick',
        dblclick: 'missingHandler'
      },
      onClick() {}
    });

    expect(() => new View()).to.throw().with.property('code', 'MN0019');
    expect(delegate).not.to.have.been.called;
  });
});
