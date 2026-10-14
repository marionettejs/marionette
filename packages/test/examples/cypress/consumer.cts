import { View, Application } from 'marionette';
import { mount, mountApplication, unmount, setupCypress } from '@mnjs/test/cypress';
import type { MountedView, MountedApplication } from '@mnjs/test';

const Editor = View.extend({ template: () => 'Editor', draft() { return 'draft'; } });
const Feature = Application.extend({ result() { return 7; } });
setupCypress();
const view: Cypress.Chainable<MountedView<InstanceType<typeof Editor>>> = mount(scope => {
  scope.defer(() => true);
  return new Editor();
});
view.then(handle => { const draft: string = handle.view.draft(); return draft; });
const app = mountApplication(
  (region, scope) => { scope.defer(async () => {}); return new Feature({ region }); }, { start: false }
);
app.then(handle => {
  const typed: MountedApplication<InstanceType<typeof Feature>> = handle;
  const result: number = typed.app.result();
  // @ts-expect-error Concrete Application methods remain checked.
  handle.app.missingMethod();
  return result;
});
const cleanup: Cypress.Chainable<void> = unmount();
// @ts-expect-error Startup must be explicit.
mountApplication(() => new Feature());
// @ts-expect-error A startup choice is required even with other options.
mountApplication(() => new Feature(), { replaceElement: false });
// @ts-expect-error The runner chooses the component container.
mount(new Editor(), { container: document.body });
// @ts-expect-error Concrete View methods remain checked.
view.then(handle => handle.view.missingMethod());
void [app, cleanup];
