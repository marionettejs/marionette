import { Application, View } from 'marionette';
import { mountView, mountApplication } from '@mnjs/test';
import TestingLibrary = require('@mnjs/test/testing-library');
const { withQueries } = TestingLibrary;
import type { WithQueries, WithQueriesOptions } from '@mnjs/test/testing-library';
import type { MountedView } from '@mnjs/test';

const Editor = View.extend({ template: () => '<label>Name <input></label>', draft() { return 'draft'; } });
const original = mountView(new Editor());
const mounted = withQueries(original);
const exact: WithQueries<MountedView<InstanceType<typeof Editor>>> = mounted;
const draft: string = mounted.view.draft();
const input: HTMLInputElement = mounted.getByLabelText<HTMLInputElement>('Name');
const found: Promise<HTMLButtonElement> = mounted.findByRole<HTMLButtonElement>('button', { name: 'Save' });
const currentRoot: Element | undefined = mounted.el;
const cleanup: Promise<void> = mounted.cleanup();
const options: WithQueriesOptions = { baseElement: document.body };
withQueries(mounted, options);
const Feature = Application.extend({ result() { return 7; } });
const application = withQueries(mountApplication(region => new Feature({ region })));
const result: number = application.app.result();
const ready: Promise<boolean> = application.ready;
// @ts-expect-error Concrete View methods are preserved.
mounted.view.missingMethod();
// @ts-expect-error DOM query return types remain precise.
const wrong: HTMLButtonElement = mounted.getByLabelText<HTMLInputElement>('Name');
// @ts-expect-error Query options use Testing Library's types.
mounted.getByRole('button', { name: 7 });
// @ts-expect-error Base elements are DOM roots, not selectors.
withQueries(original, { baseElement: '#portal' });
// @ts-expect-error Decoration preserves readonly root identity.
mounted.container = document.body;
// @ts-expect-error Initial readiness remains readonly.
application.ready = Promise.resolve(true);
void [exact, draft, input, found, currentRoot, cleanup, result, ready, wrong];
