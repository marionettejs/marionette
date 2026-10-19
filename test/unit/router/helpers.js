import { afterEach } from 'vitest';
import { Router } from '@mnjs/router';

const routers = new Set();
export function createRouter(options) {
  const router = new Router(options);
  routers.add(router);
  return router;
}
afterEach(() => {
  for (const router of routers) { router.stop(); }
  routers.clear();
});
