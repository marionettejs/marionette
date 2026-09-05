import MnObject from '../../src/modules/object';

describe('marionette object', function() {

  describe('when creating an object', function() {
    let object;
    let options;

    beforeEach(function() {
      const Obj = MnObject.extend({
        initialize(opts) {
          this.bindEvents(opts.model, this.modelEvents);
        },

        modelEvents: {
          'bar': 'onBar'
        },

        onBar: this.sinon.stub()
      });

      this.sinon.spy(Obj.prototype, '_initRadio');

      const model = new Backbone.Model();

      options = {
        model,
        channelName: 'foo',
        radioEvents: {},
        radioRequests: {}
      };

      object = new Obj(options);
    });

    it('should merge the class options to the object', function() {
      expect(object.channelName).to.equal(options.channelName);
      expect(object.radioEvents).to.equal(options.radioEvents);
      expect(object.radioRequests).to.equal(options.radioRequests);
    });

    it('should maintain a reference to the options', function() {
      expect(object.options).to.deep.equal(options);
    });

    it('should have a cidPrefix', function() {
      expect(object.cidPrefix).to.equal('mno');
    });

    it('should have a cid', function() {
      expect(object.cid).to.contain('mno');
    });

    it('should init the RadioMixin', function() {
      expect(object._initRadio).to.have.been.called;
    });

    it('should support triggering events on itself', function() {
      const fooHandler = this.sinon.spy();
      object.on('foo', fooHandler);

      object.trigger('foo', options);

      expect(fooHandler).to.have.been.calledOnce.and.calledWith(options);
    });

    it('should support binding to evented objects', function() {
      options.model.trigger('bar', options);

      expect(object.onBar).to.have.been.calledOnce.and.calledWith(options);
    });

    it('preserves constructor order, receiver, and initialize arguments', function() {
      const calls = [];
      const cidPrefix = {
        [Symbol.toPrimitive](hint) {
          calls.push(['cidPrefix', hint]);
          return 'ordered';
        }
      };
      const OrderedObject = MnObject.extend({
        cidPrefix,
        _setOptions(...args) {
          calls.push(['setOptions', this, args]);
        },
        _initRadio(...args) {
          calls.push(['initRadio', this, args]);
        },
        _initState(...args) {
          calls.push(['initState', this, args]);
        },
        _initStateEvents(...args) {
          calls.push(['initStateEvents', this, args]);
        },
        initialize(...args) {
          calls.push(['initialize', this, args]);
        }
      });
      const orderedOptions = { ordered: true };
      const orderedObject = new OrderedObject(orderedOptions, 'extra');

      expect(calls).to.deep.equal([
        ['setOptions', orderedObject, [orderedOptions, [
          'channelName',
          'radioEvents',
          'radioRequests',
          'stateEvents'
        ]]],
        ['cidPrefix', 'default'],
        ['initRadio', orderedObject, []],
        ['initState', orderedObject, [orderedOptions]],
        ['initialize', orderedObject, [orderedOptions, 'extra']],
        ['initStateEvents', orderedObject, []]
      ]);
      expect(orderedObject.cid).to.match(/^ordered\d+$/);
    });
  });
});
