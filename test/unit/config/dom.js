import $ from 'jquery';
import _ from 'underscore';
import DomApi, { setDomApi } from '../../../src/config/dom';

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
  });

  describe('#createBuffer', function() {
    it('should return an appendable node', function() {
      expect(DomApi.createBuffer().appendChild).to.be.a('function');
    })
  });

  describe('#getEl', function() {
    let $domEl;
    let domEl;

    beforeEach(function() {
      this.setFixtures('<div id="foo"></div>');
      $domEl = $('#foo');
      domEl = $domEl[0];
    });

    describe('when passing a selector', function() {
      it('should return an array-like object', function() {
        expect(DomApi.getEl('#foo')).to.be.arrayLike;
      });

      it('should return the DOM element', function() {
        expect(DomApi.getEl('#foo')[0]).to.eql(domEl)
      });
    });

    describe('when passing a DOM element', function() {
      it('should return an array-like object', function() {
        expect(DomApi.getEl(domEl)).to.be.arrayLike;
      });

      it('should return the DOM element', function() {
        expect(DomApi.getEl(domEl)[0]).to.eql(domEl)
      });
    });

    describe('when passing a jQuery element', function() {
      it('should return an array-like object', function() {
        expect(DomApi.getEl($domEl)).to.be.arrayLike;
      });

      it('should return the DOM element', function() {
        expect(DomApi.getEl($domEl)[0]).to.eql(domEl)
      });
    });
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
