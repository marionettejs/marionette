import { setRenderer } from '../../../src/config/renderer';

describe('#setRenderer', function() {
  let MyObject;

  beforeEach(function() {
    MyObject = function() {};
    MyObject.setRenderer = setRenderer;
  });

  it('should return the current class', function() {
    expect(MyObject.setRenderer()).to.be.eq(MyObject);
  });

  it('should set _renderHtml on the class', function() {
    const renderer = function() {};
    MyObject.setRenderer(renderer);
    expect(MyObject.prototype._renderHtml).to.equal(renderer);
  });
});
