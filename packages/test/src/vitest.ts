/// <reference lib="esnext.disposable" preserve="true" />
import { test as base } from 'vitest';
import { createMountContext } from './context.ts';
export type { TestMounts } from './context.ts';

// Vitest discovers fixture dependencies from the destructured first parameter.
export const test = base.extend('mounts', ({}, { onCleanup }) => { // eslint-disable-line no-empty-pattern
  const mounts = createMountContext({ replaceElement: true });
  onCleanup(mounts.cleanup);
  return mounts;
});
