import getNamespacedEventName from '../../../src/utils/get-namespaced-event-name';

describe('getNamespacedEventName', function() {
  it('should postfix a namespace to the event', function() {
    expect(getNamespacedEventName('click a.name', 'test')).to.equal('click.test a.name');
  });
});
