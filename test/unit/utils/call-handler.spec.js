import callHandler from '../../../utils/call-handler';

describe('callHandler', function() {
  it('applies callbacks with more than three arguments', function() {
    const context = {};
    const callback = this.sinon.stub().returns('result');

    expect(callHandler(callback, context, [1, 2, 3, 4])).to.equal('result');
    expect(callback).to.have.been.calledOnce.and.calledOn(context).and.calledWith(1, 2, 3, 4);
  });
});
