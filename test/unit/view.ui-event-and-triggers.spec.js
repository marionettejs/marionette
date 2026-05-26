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

  it('ignores string event handlers that are not present on the view', function() {
    const View = Marionette.View.extend({
      template: _.template('<button class="foo"></button>'),
      events: {
        'click .foo': 'missingHandler'
      }
    });
    const view = new View();

    expect(function() {
      view.render();
      view.el.querySelector('.foo').click();
    }).to.not.throw();
  });
});
