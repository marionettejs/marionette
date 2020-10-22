import { setEnabled, isEnabled } from '../../../src/config/features';

describe('features', function() {
  it('enabled when its present and true', function() {
    setEnabled('foo', true);
    expect(isEnabled('foo')).to.be.true;
  });

  it('disabled when its present and false', function() {
    setEnabled('foo', false);
    expect(isEnabled('foo')).to.be.false;
  });

  it('disabled when not present', function() {
    expect(isEnabled('foo')).to.be.false;
  });
});
