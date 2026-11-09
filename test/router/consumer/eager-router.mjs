import { Router, memoryDriver } from '@mnjs/router';
// Deliberately eager: bootstrap must decide whether to load this module first.
export const router = new Router({ driver: memoryDriver({ url: 'https://desk.example/outside' }), routes: { home: { path: '/' } } });
export async function start() {
  await router.start();
  return router;
}
