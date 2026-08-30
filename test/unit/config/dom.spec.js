import $ from 'jquery';
import _ from 'underscore';
import DomApi, { setDomApi } from '../../../config/dom';

// Copied from https://github.com/jashkenas/underscore/blob/1.8.3/underscore.js#L137
const MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
const getLength = _.property('length');
function isArrayLike(collection) {
  let length = getLength(collection);
  return typeof length === 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
}

chai.use(function(_chai, utils) {
  _chai.Assertion.addProperty('arrayLike', function() {
    this.assert(
      isArrayLike(utils.flag(this, 'object')),
      'expected #{this} to be a Array-like',
      'expected #{this} to not be a Array-like'
    );
  });
});


describe('DomApi', function() {
  describe('#setDomApi', function() {
    it('should return the current class', function() {
      const MyObject = function() {};
      MyObject.setDomApi = setDomApi;
      expect(MyObject.setDomApi()).to.be.eq(MyObject);
    });

    it('overlays own enumerable string properties', function() {
      const inherited = { inheritedMixin: true };
      const mixin = Object.assign(Object.create(inherited), { shared: 'mixin', mixin: true });
      const symbol = Symbol('ignored');
      const protoValue = { polluted: true };
      mixin[symbol] = true;
      Object.defineProperty(mixin, 'hidden', { enumerable: false, value: true });
      Object.defineProperty(mixin, '__proto__', { enumerable: true, value: protoValue });

      const MyObject = function() {};
      MyObject.prototype.Dom = Object.assign(
        Object.create({ inheritedBase: true }),
        { base: true, shared: 'base' }
      );
      MyObject.setDomApi = setDomApi;

      MyObject.setDomApi(mixin);

      expect(MyObject.prototype.Dom).to.include({ base: true, shared: 'mixin', mixin: true });
      expect(MyObject.prototype.Dom).to.not.have.property('inheritedBase');
      expect(MyObject.prototype.Dom).to.not.have.property('inheritedMixin');
      expect(MyObject.prototype.Dom).to.not.have.property('hidden');
      expect(MyObject.prototype.Dom).to.not.have.property(symbol);
      expect(Object.getPrototypeOf(MyObject.prototype.Dom)).to.equal(Object.prototype);
      expect(Object.hasOwn(MyObject.prototype.Dom, '__proto__')).to.be.true;
      expect(Object.getOwnPropertyDescriptor(MyObject.prototype.Dom, '__proto__').value)
        .to.equal(protoValue);
    });

    it('isolates repeated overlays to the receiving class', function() {
      const Parent = function() {};
      Parent.prototype.Dom = { base: true };

      const Child = function() {};
      Child.prototype = Object.create(Parent.prototype);
      Child.setDomApi = setDomApi;

      Child.setDomApi({ first: true });
      const firstOverlay = Child.prototype.Dom;
      Child.setDomApi({ second: true });

      expect(Child.prototype.Dom).to.include({ base: true, first: true, second: true });
      expect(Child.prototype.Dom).to.not.equal(firstOverlay);
      expect(Parent.prototype.Dom).to.deep.equal({ base: true });
    });
  });

  describe('#createBuffer', function() {
    it('should return an appendable node', function() {
      expect(DomApi.createBuffer().appendChild).to.be.a('function');
    })
  });

  describe('#findEl', function() {
    let domEl;
    let findEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo"><div id="bar"></div></div>');
      domEl = $('#foo')[0];
      findEl = $('#bar')[0];
    });

    it('should return an array-like object', function() {
      expect(DomApi.findEl(domEl, '#bar')).to.be.arrayLike;
    });

    it('should return the DOM element', function() {
      expect(DomApi.findEl(domEl, '#bar')[0]).to.eql(findEl)
    });
  });

  describe('#hasEl', function() {
    let domEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo"><div id="bar"></div></div>');
      domEl = $('#foo')[0];
    });

    describe('when the node is within the el', function() {
      it('should return true', function() {
        expect(DomApi.hasEl(domEl, $('#bar')[0])).to.be.true;
      });
    });

    describe('when the node is not within the el', function() {
      it('should return false', function() {
        expect(DomApi.hasEl(domEl, $('<div>')[0])).to.be.false;
      });
    });
  });

  describe('#detachEl', function() {
    let $domEl;
    let domEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo"></div>');
      $domEl = $('#foo');
      domEl = $domEl[0];
    });

    it('should detach the el from the DOM', function() {
      DomApi.detachEl(domEl);
      expect($(document).has(domEl)).to.have.lengthOf(0);
    });

    it('should not remove listeners', function() {
      const onClickStub = this.sinon.stub();
      $domEl.on('click', onClickStub);
      DomApi.detachEl(domEl);
      $domEl.trigger('click');

      expect(onClickStub).to.be.calledOnce;
    });
  });

  describe('#replaceEl', function() {
    let newEl;
    let oldEl;
    let parentEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo"><div id="bar">old</div></div>');
      parentEl = $('#foo')[0];
    });

    describe('when newEl and oldEl are the same', function() {
      it('should not change anything', function() {
        newEl = oldEl = $('#bar')[0];
        DomApi.replaceEl(newEl, oldEl);
        expect(parentEl.innerHTML).to.have.string('old');
      });
    });

    describe('when oldEl is not attached', function() {
      it('should not error', function() {
        const $oldEl = $('#bar');
        oldEl = $oldEl[0];
        $oldEl.detach();
        newEl = $('<div>new</div>')[0];
        expect(_.partial(DomApi.replaceEl, newEl, oldEl)).to.not.throw();
      });
    });

    describe('when oldEl is attached', function() {
      it('should replace the contents', function() {
        oldEl = $('#bar')[0];
        newEl = $('<div>new</div>')[0];
        DomApi.replaceEl(newEl, oldEl);
        expect(parentEl.innerHTML).to.have.string('new');
      });
    });
  });

  describe('#swapEl', function() {
    let el1;
    let el2;
    let parentEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo"><div id="bar">1</div><div id="baz">2</div></div>');
      parentEl = $('#foo')[0];
    });

    describe('when el1 and el2 are the same', function() {
      it('should not change anything', function() {
        el1 = el2 = $('#bar')[0];
        DomApi.swapEl(el1, el2);
        expect(parentEl.textContent).to.have.string('12');
      });
    });

    describe('when el1 is not attached', function() {
      it('should not error', function() {
        const $el1 = $('#bar');
        el1 = $el1[0];
        $el1.detach();
        el2 = $('#baz')[0];
        expect(_.partial(DomApi.swapEl, el1, el2)).to.not.throw();
      });
    });

    describe('when el2 is not attached', function() {
      it('should not error', function() {
        const $el2 = $('#baz');
        el2 = $el2[0];
        $el2.detach();
        el1 = $('#bar')[0];
        expect(_.partial(DomApi.swapEl, el1, el2)).to.not.throw();
      });
    });

    describe('when both els are attached', function() {
      it('should swap the contents', function() {
        el1 = $('#bar')[0];
        el2 = $('#baz')[0];
        DomApi.swapEl(el1, el2);
        expect(parentEl.textContent).to.have.string('21');
      });
    });
  });

  describe('#setContents', function() {
    let domEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo">Existing Html</div>');
      domEl = $('#foo')[0];
      DomApi.setContents(domEl, 'New Html');
    });

    it('should add the contents', function() {
      expect(domEl.innerHTML).to.have.string('New Html');
    });

    it('should remove existing contents', function() {
      expect(domEl.innerHTML).to.not.have.string('Existing Html');
    });
  });

  describe('#setAttributes', function() {
    it('assigns existing properties and sets other attributes', function() {
      const el = {
        existing: 'old',
        setAttribute: this.sinon.stub()
      };

      DomApi.setAttributes(el, { existing: 'new', missing: 'attribute' });

      expect(el.existing).to.equal('new');
      expect(el.setAttribute).to.have.been.calledOnce
        .and.calledWithExactly('missing', 'attribute');
    });

    it('uses only own enumerable string keys and safely assigns __proto__', function() {
      const symbol = Symbol('ignored');
      const protoValue = { polluted: true };
      const attrs = Object.assign(Object.create({ inherited: 'ignored' }), {
        title: 'owned',
        'data-owned': 'owned',
        [symbol]: 'ignored'
      });
      Object.defineProperty(attrs, 'hidden', { value: 'ignored' });
      Object.defineProperty(attrs, '__proto__', {
        enumerable: true,
        value: protoValue
      });
      const el = document.createElement('div');
      const elementPrototype = Object.getPrototypeOf(el);

      DomApi.setAttributes(el, attrs);

      expect(el.title).to.equal('owned');
      expect(el.dataset.owned).to.equal('owned');
      expect(el.getAttribute('inherited')).to.be.null;
      expect(el.getAttribute('hidden')).to.be.null;
      expect(el[symbol]).to.be.undefined;
      expect(Object.getPrototypeOf(el)).to.equal(elementPrototype);
      expect(Object.hasOwn(el, '__proto__')).to.be.true;
      expect(Object.getOwnPropertyDescriptor(el, '__proto__').value).to.equal(protoValue);
    });

    it('snapshots keys and checks property membership before reading each value', function() {
      const trace = [];
      const attrs = new Proxy({ existing: 'property', missing: 'attribute' }, {
        get(target, property, receiver) {
          trace.push(`attrs:get:${String(property)}`);
          return Reflect.get(target, property, receiver);
        },
        getOwnPropertyDescriptor(target, property) {
          trace.push(`attrs:descriptor:${String(property)}`);
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
        ownKeys(target) {
          trace.push('attrs:keys');
          return Reflect.ownKeys(target);
        }
      });
      const el = new Proxy({
        existing: 'old',
        setAttribute(name, value) {
          trace.push(`el:setAttribute:${name}:${value}`);
        }
      }, {
        get(target, property, receiver) {
          trace.push(`el:get:${String(property)}`);
          return Reflect.get(target, property, receiver);
        },
        has(target, property) {
          trace.push(`el:has:${String(property)}`);
          return Reflect.has(target, property);
        },
        set(target, property, value, receiver) {
          trace.push(`el:set:${String(property)}:${value}`);
          return Reflect.set(target, property, value, receiver);
        }
      });

      DomApi.setAttributes(el, attrs);

      expect(trace).to.deep.equal([
        'attrs:keys',
        'attrs:descriptor:existing',
        'attrs:descriptor:missing',
        'el:has:existing',
        'attrs:get:existing',
        'el:set:existing:property',
        'el:has:missing',
        'el:get:setAttribute',
        'attrs:get:missing',
        'el:setAttribute:missing:attribute'
      ]);
    });

    it('uses the snapshotted key order while reading later values lazily', function() {
      const reads = [];
      const attrs = {};
      Object.defineProperties(attrs, {
        first: {
          enumerable: true,
          get() {
            reads.push('first');
            attrs.third = 'late';
            delete attrs.second;
            return 'first';
          }
        },
        second: {
          configurable: true,
          enumerable: true,
          get() {
            reads.push('second');
            return 'second';
          }
        }
      });
      const el = { setAttribute: this.sinon.stub() };

      DomApi.setAttributes(el, attrs);

      expect(reads).to.deep.equal(['first']);
      expect(el.setAttribute).to.have.been.calledTwice;
      expect(el.setAttribute.firstCall.args).to.deep.equal(['first', 'first']);
      expect(el.setAttribute.secondCall.args).to.deep.equal(['second', undefined]);
    });

    it('treats nullish and primitive attribute inputs as no-ops', function() {
      const el = new Proxy({}, {
        get() {
          throw new Error('element read');
        },
        has() {
          throw new Error('element membership');
        }
      });

      [null, undefined, 'attrs', 1, true, Symbol('attrs'), 1n]
        .forEach(attrs => expect(() => DomApi.setAttributes(el, attrs)).not.to.throw());
    });

    it('iterates own enumerable properties on callable attribute maps', function() {
      const attrs = function() {};
      attrs.title = 'callable';
      const el = { title: 'old', setAttribute: this.sinon.stub() };

      DomApi.setAttributes(el, attrs);

      expect(el.title).to.equal('callable');
      expect(el.setAttribute).not.to.have.been.called;
    });

    it('retains Object.keys behavior for boxed strings and sparse arrays', function() {
      const el = { setAttribute: this.sinon.stub() };
      const sparseAttrs = [];
      sparseAttrs[0] = 'first';
      sparseAttrs[2] = 'third';

      DomApi.setAttributes(el, Object('ab'));
      DomApi.setAttributes(el, sparseAttrs);

      expect(el.setAttribute.callCount).to.equal(4);
      expect(el.setAttribute.getCalls().map(call => call.args)).to.deep.equal([
        ['0', 'a'],
        ['1', 'b'],
        ['0', 'first'],
        ['2', 'third']
      ]);
    });

    it('treats own length and built-in names as ordinary attribute-map keys', function() {
      const attrs = {
        length: 'ordinary',
        constructor: 'constructor value',
        toString: 'toString value'
      };
      const el = { setAttribute: this.sinon.stub() };

      DomApi.setAttributes(el, attrs);

      expect(el.setAttribute).to.have.been.calledOnceWithExactly('length', 'ordinary');
      expect(el).to.have.own.property('constructor', 'constructor value');
      expect(el).to.have.own.property('toString', 'toString value');
    });

    it('uses the Object.keys intrinsic captured when the module loads', function() {
      const originalKeys = Object.keys;
      const el = { title: 'old', setAttribute: this.sinon.stub() };

      try {
        Object.keys = () => { throw new Error('patched Object.keys'); };
        DomApi.setAttributes(el, { title: 'captured' });
      } finally {
        Object.keys = originalKeys;
      }

      expect(el.title).to.equal('captured');
    });

    it('propagates membership errors without reading the attribute value', function() {
      const valueGetter = this.sinon.stub().returns('value');
      const attrs = Object.defineProperty({}, 'title', {
        enumerable: true,
        get: valueGetter
      });
      const error = new Error('membership failed');
      const el = new Proxy({}, {
        has() {
          throw error;
        }
      });

      expect(() => DomApi.setAttributes(el, attrs)).to.throw(error);
      expect(valueGetter).not.to.have.been.called;
    });

    it('propagates setAttribute lookup errors without reading the attribute value', function() {
      const valueGetter = this.sinon.stub().returns('value');
      const attrs = Object.defineProperty({}, 'missing', {
        enumerable: true,
        get: valueGetter
      });
      const error = new Error('setAttribute lookup failed');
      const el = Object.defineProperty({}, 'setAttribute', {
        get() {
          throw error;
        }
      });

      expect(() => DomApi.setAttributes(el, attrs)).to.throw(error);
      expect(valueGetter).not.to.have.been.called;
    });

    it('propagates attribute getter errors before writing the property', function() {
      const error = new Error('attribute read failed');
      const attrs = Object.defineProperty({}, 'title', {
        enumerable: true,
        get() {
          throw error;
        }
      });
      const propertySetter = this.sinon.stub();
      const el = Object.defineProperties({}, {
        setAttribute: { value: this.sinon.stub() },
        title: { set: propertySetter }
      });

      expect(() => DomApi.setAttributes(el, attrs)).to.throw(error);
      expect(propertySetter).not.to.have.been.called;
    });

    it('propagates property write errors after reading the attribute value', function() {
      const valueGetter = this.sinon.stub().returns('value');
      const attrs = Object.defineProperty({}, 'title', {
        enumerable: true,
        get: valueGetter
      });
      const error = new Error('property write failed');
      const el = Object.defineProperties({}, {
        setAttribute: { value: this.sinon.stub() },
        title: {
          set() {
            throw error;
          }
        }
      });

      expect(() => DomApi.setAttributes(el, attrs)).to.throw(error);
      expect(valueGetter).to.have.been.calledOnce;
    });

    it('propagates __proto__ definition errors after reading the attribute value', function() {
      const valueGetter = this.sinon.stub().returns('value');
      const attrs = Object.defineProperty({}, '__proto__', {
        enumerable: true,
        get: valueGetter
      });
      const error = new Error('property definition failed');
      const el = new Proxy({}, {
        defineProperty() {
          throw error;
        }
      });

      expect(() => DomApi.setAttributes(el, attrs)).to.throw(error);
      expect(valueGetter).to.have.been.calledOnce;
    });

    it('stops before a later value when the first setAttribute call throws', function() {
      const valueGetter = this.sinon.stub().returns('value');
      const laterGetter = this.sinon.stub().returns('later');
      const attrs = Object.defineProperties({}, {
        missing: {
          enumerable: true,
          get: valueGetter
        },
        later: {
          enumerable: true,
          get: laterGetter
        }
      });
      const error = new Error('setAttribute failed');
      const el = {
        setAttribute() {
          throw error;
        }
      };

      expect(() => DomApi.setAttributes(el, attrs)).to.throw(error);
      expect(valueGetter).to.have.been.calledOnce;
      expect(laterGetter).not.to.have.been.called;
    });
  });

  describe('#appendContents', function() {
    let domEl;
    let appending;

    beforeEach(function() {
      this.setFixtures('<div id="foo">Existing Html</div>');
      domEl = $('#foo')[0];
      appending = $('<div>Appended</div>')[0];
    });

    it('should append the contents to the end of the contents of the el', function() {
      DomApi.appendContents(domEl, appending);
      expect(domEl.innerHTML).to.have.string('Existing Html<div>Appended</div>');
    });
  });

  describe('#hasContents', function() {
    it('should return true when el has contents', function() {
      this.setFixtures('<div id="foo">Existing Html</div>');
      const domEl = $('#foo')[0];
      expect(DomApi.hasContents(domEl)).to.be.true;
    });

    it('should return false when el has no contents', function() {
      this.setFixtures('<div id="foo"></div>');
      const domEl = $('#foo')[0];
      expect(DomApi.hasContents(domEl)).to.be.false;
    });

    it('should return false when el is undefined or null', function() {
      expect(DomApi.hasContents(undefined)).to.be.false;
      expect(DomApi.hasContents(null)).to.be.false;
    });
  });

  describe('#detachContents', function() {
    let domEl;
    let $detachEl;
    let detachEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo"><div id="bar"></div></div>');
      domEl = $('#foo')[0];
      $detachEl = $('#bar');
      detachEl = $detachEl[0];
    });

    it('should detach the contents of the el from the DOM', function() {
      DomApi.detachContents(domEl);
      expect($(document).has(detachEl)).to.have.lengthOf(0);
    });

    it('should not detach the el from the DOM', function() {
      DomApi.detachContents(domEl);
      expect($(document).has(domEl)).to.have.lengthOf(1);
    });

    it('should not remove listeners', function() {
      const onClickStub = this.sinon.stub();
      $detachEl.on('click', onClickStub);
      DomApi.detachContents(domEl);
      $detachEl.trigger('click');

      expect(onClickStub).to.be.calledOnce;
    });
  });
});
