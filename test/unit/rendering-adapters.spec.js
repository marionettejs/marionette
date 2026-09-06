import { renderingAdapterContracts } from '../contracts/rendering-adapters.js';

for (const { name, run } of renderingAdapterContracts) {
  it(name, run);
}
