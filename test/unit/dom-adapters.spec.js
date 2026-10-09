import { it } from 'vitest';
import { domAdapterContracts } from '../contracts/dom-adapters.js';

for (const { name, run } of domAdapterContracts) {
  it(name, run);
}
