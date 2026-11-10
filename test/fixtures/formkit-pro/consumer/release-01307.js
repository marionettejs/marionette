// Whole-day bound cases use local dates; the browser driver should pin UTC and
// fix Date to 2026-11-08T12:30Z without pausing interval/timeout delivery.
const parameters = new URLSearchParams(location.search);
export const releaseScenario = parameters.get('scenario') === 'release-01307' && (parameters.get('mode') ?? 'pro') === 'pro';
export const releaseInitial = () => ({ contact: { name: 'Release probe', email: 'probe@example.test' }, release: { min: '', max: '', both: '' } });
const minimum = new Date(2026, 10, 8, 23, 59);
const maximum = new Date(2026, 10, 10, 0, 1);
export const releaseSchema = { $formkit: 'group', name: 'release', children: [
  { $formkit: 'datepicker', id: 'release-min-day', name: 'min', label: 'Minimum whole day', minDate: minimum },
  { $formkit: 'datepicker', id: 'release-max-day', name: 'max', label: 'Maximum whole day', maxDate: maximum },
  { $formkit: 'datepicker', id: 'release-both-days', name: 'both', label: 'Both inclusive days', minDate: minimum, maxDate: maximum }
].map(field => ({ ...field, format: 'YYYY-MM-DD', popover: true })) };
export function installRelease(bridge, getNode) {
  if (!releaseScenario) { return; }
  bridge.release01307 = { isSettled: () => getNode('fixture-root').isSettled };
}
