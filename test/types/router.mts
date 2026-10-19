import { Router, memoryDriver, navigationDriver, type ActiveMatch, type Match, type Driver, type NavigationResult } from '@mnjs/router';
import { RouteOutlet, type RouteOutletInstance } from '@mnjs/router/outlet';
import { Application } from 'marionette';

const driver: Driver = memoryDriver();
const router = new Router({
  routes: [{ name: 'home', path: '/' }], driver,
  handler(match: ActiveMatch, { signal }) {
    signal.throwIfAborted();
    match.signal.throwIfAborted();
    return Promise.resolve();
  },
});
const result: NavigationResult<boolean> = router.navigate('home', {}, { state: { selected: 2 } });
const readiness: Promise<boolean> = result.finished;
const idle: Match | null = router.match('/');
if (idle) {
  // @ts-expect-error Pure matching provides no navigation signal.
  idle.signal.throwIfAborted();
}
navigationDriver(window.navigation);
router.listenTo(router, 'route', (match: ActiveMatch) => match.name);
const owner = new Application();
const outlet: RouteOutletInstance = new RouteOutlet({ owner });
const extended = RouteOutlet.extend({
  initialize() { this.show('page'); },
  isSelected() { return this.getCurrent() !== null; },
});
const child = new extended({ owner });
const selected: boolean = child.isSelected();
outlet.show('page', { key: { id: 'one', branch: ['a'] }, options: { id: 'one' } });
// @ts-expect-error Outlet keys are primitive, arrays or plain objects.
outlet.show('page', { key: new Map() });
// @ts-expect-error Driver events have typed destinations and interception.
driver.addEventListener('navigate', (event: { missing: string }) => event.missing);
// @ts-expect-error Router state is a plain object, not a Map.
router.updateState(new Map());
void [readiness, selected];
