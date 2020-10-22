import proxy from '../../../src/utils/proxy';

describe('proxy', function() {
  let method;

  beforeEach(function() {
    method = this.sinon.stub();
  });

  it('should return a function', function() {
    expect(proxy(method)).to.be.a('function');
  });

  describe('when calling the returned function', function() {
    it('should call the method on context with all arguments', function() {
      const context = {};
      const proxiedMethod = proxy(method);

      proxiedMethod(context, 1, 2, 3);

      expect(method).to.be.calledOn(context).and.calledWith(1,2,3);
    });
  });
});
