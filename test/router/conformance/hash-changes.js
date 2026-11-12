// Native Chromium receipts distinguish an absent fragment from an explicit '#'.
export const hashChanges = [
  { from: '/page', to: '/page#', expected: true },
  { from: '/page#top', to: '/page#', expected: true },
  { from: '/page#top', to: '/page#top', expected: false },
  { from: '/page#top', to: '/page', expected: false },
  { from: '/page#', to: '/page', expected: false },
  { from: '/page#', to: '/page#', expected: false },
  { from: '/page', to: '/page', expected: false },
];
