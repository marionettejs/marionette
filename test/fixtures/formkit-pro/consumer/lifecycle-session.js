import { createIntervalBridge } from './interval-ledger.js';

const parameters = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
export const lifecycleBridge = parameters.get('scenario') === 'lifecycle-01307' && (parameters.get('mode') ?? 'pro') === 'pro' ?
  createIntervalBridge(globalThis, true) : null;
