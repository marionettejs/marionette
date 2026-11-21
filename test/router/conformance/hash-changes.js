// Fragment records distinguish an absent fragment from an explicit '#'.
export const fragmentRecord = href => href.includes('#') ? href.slice(href.indexOf('#') + 1) : null;
export const removesFragment = ({ from, to }) => fragmentRecord(from) !== null && fragmentRecord(to) === null;
export const hashChanges = [
  { from: '/page', to: '/page#', expected: true },
  { from: '/page#top', to: '/page#', expected: true },
  { from: '/page#top', to: '/page#top', expected: false },
  { from: '/page#top', to: '/page', expected: false },
  { from: '/page#', to: '/page', expected: false },
  { from: '/page#', to: '/page#', expected: false },
  { from: '/page', to: '/page', expected: false },
];
