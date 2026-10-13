import { createRoutes, createRouter, createMemoryHistory } from '@mnjs/router';

const routes = createRoutes({
  schedule: '/:workspace/schedule',
  interaction: { path: '/:workspace/patient/:patientId/interactions/:interactionId', meta: { area: 'patient' } },
  root: '/',
});
const router = createRouter({ routes, history: createMemoryHistory(), dispatch(context) {
  if (context.match?.name === 'interaction') {
    const id: string = context.match.params.interactionId;
    const area: 'patient' = context.match.meta.area;
    context.runIfCurrent(() => { console.log(id, area); });
    // @ts-expect-error Permission callback is synchronous; async is not accepted.
    context.runIfCurrent(async () => { await Promise.resolve(); });
  }
} });
router.navigate({ name: 'interaction', params: { workspace: 'alpha', patientId: 'p', interactionId: 'i' } });
router.navigate({ name: 'root' });
router.navigate('/alpha/schedule');
// @ts-expect-error Unknown route name.
router.navigate({ name: 'missing' });
// @ts-expect-error Missing interactionId.
router.href({ name: 'interaction', params: { workspace: 'alpha', patientId: 'p' } });
// @ts-expect-error Route-specific parameter mismatch.
router.href({ name: 'schedule', params: { workspace: 'alpha', patientId: 'p' } });
// @ts-expect-error Unsupported history policy.
router.navigate('/alpha/schedule', { history: 'silent' });

const dynamicDefinitions: Record<string, string> = { item: '/item/:id' };
createRoutes(dynamicDefinitions).href({ name: 'item', params: { id: 'one' } });
