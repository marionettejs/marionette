// Public-control scenarios for the five Pro 0.130.4 release claims. This module
// does not install Pro or supply a project key; it uses the shared bootstrap.
const parameters = new URLSearchParams(location.search);
export const releaseScenario = parameters.get('scenario') === 'release-01304' && (parameters.get('mode') ?? 'pro') === 'pro';
export const releaseObservations = { optionSerializations: 0, maskCommits: 0 };
const option = (value, label) => ({ value, label,
  toJSON() { releaseObservations.optionSerializations++; return { value, label }; }
});

export const releaseInitial = () => ({
  contact: { name: 'Release probe', email: 'probe@example.test' },
  release: { usd: 12.5, jpy: 125, kwd: 12.5, override: 12.5, mask: '',
    dropdown: 'alpha', autocomplete: 'alpha', taglist: ['alpha'],
    rows: [{ name: 'Duplicate' }, { name: 'Duplicate' }, { name: 'Tail' }], transfer: ['alpha', 'beta'] }
});
export const releaseReplacement = () => ({ ...releaseInitial(), release: { ...releaseInitial().release,
  usd: -7.25, jpy: 0, kwd: 7.125, override: 7.1, mask: '1234',
  rows: [{ name: 'Fresh' }, { name: 'Fresh' }, { name: 'Last' }] }
});

const currency = (name, code, extra = {}) => ({ $formkit: 'currency', id: `release-${name}`, name,
  label: `${code} without symbol`, currency: code, currencyDisplay: 'none', displayLocale: 'en-US', min: -1000, ...extra });
export const releaseSchema = { $formkit: 'group', name: 'release', children: [
  currency('usd', 'USD'), currency('jpy', 'JPY'), currency('kwd', 'KWD'), currency('override', 'USD', { decimals: 1 }),
  { $formkit: 'mask', id: 'release-mask', name: 'mask', label: 'Reactive mask', mask: '##/##',
    mode: 'shift', allowIncomplete: true, unmaskValue: true, showMask: true },
  ...['dropdown', 'autocomplete', 'taglist'].map(type => ({ $formkit: type, id: `release-${type}`,
    name: type, label: `Late ${type} options`, options: [] })),
  { $formkit: 'repeater', id: 'release-rows', name: 'rows', label: 'Duplicate draggable rows', draggable: true,
    min: 0, max: 6, children: [{ $formkit: 'text', name: 'name', label: 'Row name' }] },
  { $formkit: 'transferlist', id: 'release-transfer', name: 'transfer', label: 'Search selected targets',
    searchable: true, targetSearchable: true, sourceLabel: 'Available', targetLabel: 'Selected',
    options: [option('alpha', 'Alpha target'), option('beta', 'Beta target'), option('gamma', 'Gamma available')] }
] };

export function installRelease(bridge, getNode) {
  if (!releaseScenario) { return; }
  const mask = getNode('release-mask');
  mask.on('commit', () => { releaseObservations.maskCommits++; });
  bridge.release = {
    observations: releaseObservations,
    isSettled: () => getNode('fixture-root').isSettled,
    showMask: value => { mask.props.showMask = value; },
    loadOptions: () => {
      for (const type of ['dropdown', 'autocomplete', 'taglist']) {
        getNode(`release-${type}`).props.options = [
          { value: 'alpha', label: 'Loaded Alpha' }, { value: 'beta', label: 'Loaded Beta' }
        ];
      }
    }
  };
}
