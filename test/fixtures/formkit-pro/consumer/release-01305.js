// Authored public scenarios, not vendor implementation or a Pro bootstrap.
const parameters = new URLSearchParams(location.search);
export const releaseScenario = parameters.get('scenario') === 'release-01305' && (parameters.get('mode') ?? 'pro') === 'pro';
const options = [{ value: 'alpha', label: 'Alpha' }, { value: 'beta', label: 'Beta' }];
export const positioningTypes = ['autocomplete', 'dropdown', 'taglist', 'datepicker', 'colorpicker'];
export const releaseInitial = () => ({ contact: { name: 'Release probe', email: 'probe@example.test' },
  release: { newText: '', exactLabel: '', selected: 'beta', positionAutocomplete: '', positionDropdown: 'alpha',
    positionTaglist: [], positionDatepicker: '2026-11-06', positionColorpicker: '#00FF00', month: '2026-11-06' } });
export const releaseSchema = { $formkit: 'group', name: 'release', children: [
  ...['newText', 'exactLabel', 'selected'].map(name => ({ $formkit: 'autocomplete', name,
    id: `release-${name}`, label: `Blur ${name}`, allowNewValues: true, options })),
  ...positioningTypes.map(type => ({ $formkit: type, id: `release-position-${type}`,
    name: `position${type[0].toUpperCase()}${type.slice(1)}`, label: `Position ${type}`, popoverPosition: 'auto',
    ...(['datepicker', 'colorpicker'].includes(type) ? { popover: true } : { options }),
    ...(type === 'datepicker' ? { format: 'YYYY-MM-DD' } : {}) })),
  { $formkit: 'datepicker', id: 'release-month', name: 'month', label: 'Month pagination',
    format: 'YYYY-MM-DD', popover: true, paginatedPanels: ['month'] }
] };

export function installRelease(bridge, getNode) {
  if (!releaseScenario) { return; }
  bridge.release01305 = {
    isSettled: () => getNode('fixture-root').isSettled,
    setPopoverPosition(type, position) {
      if (!positioningTypes.includes(type) || !['auto', 'above', 'below'].includes(position)) { throw new Error('Unknown positioning case.'); }
      getNode(`release-position-${type}`).props.popoverPosition = position;
    }
  };
}
