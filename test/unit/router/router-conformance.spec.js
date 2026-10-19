import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

import { memoryDriver } from '@mnjs/router';
import { routerConformance } from '../../router/conformance/router.js';

routerConformance({
  name: 'memoryDriver',
  createDriver: () => ({ driver: memoryDriver() }),
  describe,
  it,
  assert,
});
