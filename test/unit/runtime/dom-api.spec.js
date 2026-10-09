import { chai, vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../../setup/fixtures.js';
import $ from 'jquery';
import _ from 'underscore';
import { DomApi, View } from 'marionette';
const setDomApi = View.setDomApi;

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

    it('overlays own enumerable properties', function() {
      const inherited = { inheritedMixin: true };
      const mixin = Object.assign(Object.create(inherited), { shared: 'mixin', mixin: true });
      const symbol = Symbol('included');
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
      expect(MyObject.prototype.Dom[symbol]).toBe(true);
      expect(Object.getPrototypeOf(MyObject.prototype.Dom)).to.equal(Object.prototype);
      expect(Object.hasOwn(MyObject.prototype.Dom, '__proto__')).toBe(true);
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
      setFixtures('<div id="foo"><div id="bar"></div></div>');
      domEl = $('#foo')[0];
      findEl = $('#bar')[0];
    });

    it('should return an array-like object', function() {
      expect(DomApi.findEl(domEl, '#bar')).toHaveLength(1);
    });

    it('should return the DOM element', function() {
      expect(DomApi.findEl(domEl, '#bar')[0]).to.eql(findEl)
    });
  });

  describe('#hasEl', function() {
    let domEl;

    beforeEach(function() {
      setFixtures('<div id="foo"><div id="bar"></div></div>');
      domEl = $('#foo')[0];
    });

    describe('when the node is within the el', function() {
      it('should return true', function() {
        expect(DomApi.hasEl(domEl, $('#bar')[0])).toBe(true);
      });
    });

    describe('when the node is not within the el', function() {
      it('should return false', function() {
        expect(DomApi.hasEl(domEl, $('<div>')[0])).toBe(false);
      });
    });
  });

  describe('#detachEl', function() {
    let $domEl;
    let domEl;

    beforeEach(function() {
      setFixtures('<div id="foo"></div>');
      $domEl = $('#foo');
      domEl = $domEl[0];
    });

    it('should detach the el from the DOM', function() {
      DomApi.detachEl(domEl);
      expect($(document).has(domEl)).to.have.lengthOf(0);
    });

    it('should not remove listeners', function() {
      const onClickStub = vi.fn();
      $domEl.on('click', onClickStub);
      DomApi.detachEl(domEl);
      $domEl.trigger('click');

      expect(onClickStub).toHaveBeenCalledTimes(1);
    });
  });

  describe('#replaceEl', function() {
    let newEl;
    let oldEl;
    let parentEl;

    beforeEach(function() {
      setFixtures('<div id="foo"><div id="bar">old</div></div>');
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

  describe('#moveEl', function() {
    it('uses insertBefore to attach a new child at the requested position', function() {
      const parent = document.createElement('div');
      const first = document.createElement('span');
      const second = document.createElement('span');
      parent.append(first);

      DomApi.moveEl(second, parent, first);

      expect([...parent.children]).to.deep.equal([second, first]);
    });

    it('uses state-preserving moveBefore for an attached child when available', function() {
      const parent = document.createElement('div');
      const first = document.createElement('span');
      const second = document.createElement('span');
      parent.append(first, second);
      parent.moveBefore = vi.fn();

      DomApi.moveEl(second, parent, first);

      expect(parent.moveBefore).toHaveBeenCalledTimes(1);
      expect(parent.moveBefore.mock.calls.map(args => args.slice(0, 2))).toContainEqual([second, first]);
    });

    it('uses insertBefore for an attached child without moveBefore', function() {
      const parent = document.createElement('div');
      const first = document.createElement('span');
      const second = document.createElement('span');
      parent.append(first, second);
      vi.spyOn(parent, 'insertBefore');

      DomApi.moveEl(second, parent, first);

      expect(parent.insertBefore).toHaveBeenCalledTimes(1);
      expect(parent.insertBefore.mock.calls.map(args => args.slice(0, 2))).toContainEqual([second, first]);
      expect([...parent.children]).to.deep.equal([second, first]);
    });
  });

  describe('#setContents', function() {
    let domEl;

    beforeEach(function() {
      setFixtures('<div id="foo">Existing Html</div>');
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
    it('applies own enumerable attributes without assigning element properties', function() {
      const el = document.createElement('div');
      const prototype = Object.getPrototypeOf(el);
      const attrs = Object.assign(Object.create({ inherited: 'ignored' }), {
        title: 'owned',
        constructor: 'ordinary attribute',
        [Symbol('ignored')]: 'ignored'
      });
      Object.defineProperty(attrs, 'hidden', { value: 'ignored' });
      Object.defineProperty(attrs, '__proto__', { enumerable: true, value: 'ordinary attribute' });

      DomApi.setAttributes(el, attrs);

      expect(el.getAttribute('title')).to.equal('owned');
      expect(el.getAttribute('constructor')).to.equal('ordinary attribute');
      expect(el.getAttribute('__proto__')).to.equal('ordinary attribute');
      expect(el.hasAttribute('inherited')).toBe(false);
      expect(el.hasAttribute('hidden')).toBe(false);
      expect(el.attributes.length).to.equal(3);
      expect(Object.getPrototypeOf(el)).to.equal(prototype);
      expect(Object.hasOwn(el, '__proto__')).toBe(false);
      expect(el.constructor).to.equal(prototype.constructor);
    });

    it('removes only null attributes and leaves undefined and omitted attributes untouched', function() {
      const el = document.createElement('div');
      el.setAttribute('title', 'remove');
      el.setAttribute('data-remove', 'remove');
      el.setAttribute('data-keep', 'keep');

      DomApi.setAttributes(el, { title: null, 'data-remove': undefined });

      expect(el.hasAttribute('title')).toBe(false);
      expect(el.getAttribute('data-remove')).to.equal('remove');
      expect(el.getAttribute('data-keep')).to.equal('keep');
    });

    it('sets literal values and removes boolean attributes only for null', function() {
      const el = document.createElement('button');

      DomApi.setAttributes(el, {
        disabled: '',
        'aria-pressed': false,
        'data-active': false,
        'data-zero': 0,
        'data-empty': ''
      });

      expect(el.disabled).toBe(true);
      expect(el.getAttribute('aria-pressed')).to.equal('false');
      expect(el.getAttribute('data-active')).to.equal('false');
      expect(el.getAttribute('data-zero')).to.equal('0');
      expect(el.getAttribute('data-empty')).to.equal('');

      DomApi.setAttributes(el, { disabled: false });
      expect(el.disabled).toBe(true);
      expect(el.getAttribute('disabled')).to.equal('false');

      DomApi.setAttributes(el, { disabled: null });
      expect(el.disabled).toBe(false);
      expect(el.hasAttribute('disabled')).toBe(false);
    });

    it('uses attribute names for SVG classes and label associations', function() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const label = document.createElement('label');

      DomApi.setAttributes(svg, { class: 'owned' });
      DomApi.setAttributes(label, { for: 'field' });
      expect(svg.className.baseVal).to.equal('owned');
      expect(label.htmlFor).to.equal('field');

      DomApi.setAttributes(svg, { class: null });
      DomApi.setAttributes(label, { for: null });
      expect(svg.hasAttribute('class')).toBe(false);
      expect(label.hasAttribute('for')).toBe(false);
    });

    it('sets input defaults without overwriting live input state', function() {
      const text = document.createElement('input');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;
      text.value = 'edited';

      DomApi.setAttributes(checkbox, { checked: '' });
      DomApi.setAttributes(text, { value: 'default' });

      expect(checkbox.defaultChecked).toBe(true);
      expect(text.defaultValue).to.equal('default');
      expect(checkbox.checked).toBe(false);
      expect(text.value).to.equal('edited');

      DomApi.setAttributes(checkbox, { checked: null });
      DomApi.setAttributes(text, { value: null });

      expect(checkbox.hasAttribute('checked')).toBe(false);
      expect(text.hasAttribute('value')).toBe(false);
      expect(checkbox.checked).toBe(false);
      expect(text.value).to.equal('edited');
    });

    it('sets and removes input form and datalist associations', function() {
      const form = document.createElement('form');
      const list = document.createElement('datalist');
      const input = document.createElement('input');
      form.id = 'attribute-form';
      list.id = 'attribute-list';
      document.body.append(form, list, input);

      try {
        DomApi.setAttributes(input, { form: form.id, list: list.id });
        expect(input.form).to.equal(form);
        expect(input.list).to.equal(list);

        DomApi.setAttributes(input, { form: null, list: null });
        expect(input.form).toBeNull();
        expect(input.list).toBeNull();
        expect(input.hasAttribute('form')).toBe(false);
        expect(input.hasAttribute('list')).toBe(false);
      } finally {
        input.remove();
        form.remove();
        list.remove();
      }
    });

    it('reads each attribute value once', function() {
      const el = document.createElement('div');
      const get = vi.fn().mockReturnValue('title');
      const attrs = Object.defineProperty({}, 'title', { enumerable: true, get });

      DomApi.setAttributes(el, attrs);

      expect(get).toHaveBeenCalledTimes(1);
      expect(el.getAttribute('title')).to.equal('title');
    });

    it('ignores nullish and primitive attribute maps', function() {
      const el = document.createElement('div');
      [null, undefined, 'attrs', 1, true, Symbol('attrs'), 1n]
        .forEach(attrs => DomApi.setAttributes(el, attrs));
      expect(el.attributes.length).to.equal(0);
    });

    it('propagates attribute getter errors', function() {
      const el = document.createElement('div');
      const error = new Error('attribute read failed');
      const attrs = Object.defineProperty({}, 'title', {
        enumerable: true,
        get() { throw error; }
      });

      expect(() => DomApi.setAttributes(el, attrs)).to.throw(error);
    });

    it('propagates invalid attribute name errors', function() {
      const el = document.createElement('div');
      expect(() => DomApi.setAttributes(el, { 'invalid name': 'value' })).to.throw();
    });
  });

  describe('#appendContents', function() {
    let domEl;
    let appending;

    beforeEach(function() {
      setFixtures('<div id="foo">Existing Html</div>');
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
      setFixtures('<div id="foo">Existing Html</div>');
      const domEl = $('#foo')[0];
      expect(DomApi.hasContents(domEl)).toBe(true);
    });

    it('should return false when el has no contents', function() {
      setFixtures('<div id="foo"></div>');
      const domEl = $('#foo')[0];
      expect(DomApi.hasContents(domEl)).toBe(false);
    });

    it('should return false when el is undefined or null', function() {
      expect(DomApi.hasContents(undefined)).toBe(false);
      expect(DomApi.hasContents(null)).toBe(false);
    });
  });

  describe('#detachContents', function() {
    let domEl;
    let $detachEl;
    let detachEl;

    beforeEach(function() {
      setFixtures('<div id="foo"><div id="bar"></div></div>');
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
      const onClickStub = vi.fn();
      $detachEl.on('click', onClickStub);
      DomApi.detachContents(domEl);
      $detachEl.trigger('click');

      expect(onClickStub).toHaveBeenCalledTimes(1);
    });
  });
});
