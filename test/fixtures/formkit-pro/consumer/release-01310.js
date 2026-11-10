const parameters = new URLSearchParams(location.search);
export const releaseScenario = parameters.get('scenario') === 'release-01310' && (parameters.get('mode') ?? 'pro') === 'pro';
// A pre-existing focused control exposes initial calendar focus theft. It is
// owned by the fixture page, outside the adapter's form ownership boundary.
if (releaseScenario) {
  const anchor = document.createElement('input');
  anchor.id = 'release-focus-anchor';
  anchor.setAttribute('aria-label', 'Focus before form mount');
  document.querySelector('#form').before(anchor);
  anchor.focus();
}
export const releaseInitial = () => ({ contact: { name: 'Inline probe', email: 'probe@example.test' },
  release: { plain: '2026-11-09', sequence: '2026-11-09', popup: '2026-11-09', combination: '2026-11-09', custom: '2026-11-09' } });
function calendar(name, label, props = {}) {
  return { $formkit: 'datepicker', id: `release-${name}-calendar`, name, label,
    format: 'YYYY-MM-DD', valueFormat: 'YYYY-MM-DD', ...props };
}
export const releaseSchema = { $formkit: 'group', name: 'release', children: [
  calendar('plain', 'Inline date', { inline: true,
    sectionsSchema: { panelWrapper: { attrs: { 'data-release-calendar': 'plain' } } } }),
  { $formkit: 'text', id: 'release-after-inline', name: 'after', label: 'After inline calendar' },
  calendar('sequence', 'Inline sequence', { inline: true, sequence: ['year', 'month', 'day'], sectionsSchema: {
    panelWrapper: { attrs: { 'data-release-calendar': 'sequence' } },
    years: { attrs: { 'data-release-stage': 'year' } }, months: { attrs: { 'data-release-stage': 'month' } }, calendar: { attrs: { 'data-release-stage': 'day' } }
  } }),
  calendar('popup', 'Popup control', { inline: false, popover: true,
    sectionsSchema: { panelWrapper: { attrs: { 'data-release-calendar': 'popup' } } } }),
  calendar('combination', 'Inline + popover (shared placement probe)', { inline: true, popover: true,
    sectionsSchema: { panelWrapper: { attrs: { 'data-release-calendar': 'combination' } } } }),
  calendar('custom', 'Custom wrapper', { inline: true, children: { panelWrapper: {
    $el: 'div', attrs: { 'data-release-panel-slot': 'custom' }, children: '$label + ":" + $value'
  } } })
] };
// Official component slot APIs are used by the reference entries. Their pinned
// Schema parsers do not expose native's named children-map extension.
export const referenceChildren = releaseSchema.children.filter(field => field.name !== 'custom');
export const referenceCustomProps = { type: 'datepicker', id: 'release-custom-calendar', name: 'custom', label: 'Custom wrapper',
  inline: true, format: 'YYYY-MM-DD', valueFormat: 'YYYY-MM-DD' };
export function installRelease(bridge, getNode) {
  if (!releaseScenario) { return; }
  bridge.release01310 = { isSettled: () => getNode('fixture-root').isSettled };
}
