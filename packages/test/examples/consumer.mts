import { Application, View, createMarionette } from 'marionette';
import { mountView, mountApplication, createTestScope } from '@mnjs/test';
import type { MountedView, MountedApplication } from '@mnjs/test';

const Editor = View.extend({ template: () => 'typed', draft() { return 'draft'; } });
const editor = mountView(new Editor());
const text: string = editor.view.draft();
const el: Element | undefined = editor.el;
const exactView: MountedView<InstanceType<typeof Editor>> = editor;
const Feature = Application.extend({ result() { return 7; } });
const app = mountApplication(region => new Feature({ region }), { startOptions: { account: 7 } });
const result: number = app.app.result();
const ready: Promise<boolean> = app.ready;
const shell = mountApplication(region => new Feature({ region }), { start: false, replaceElement: true });
const skipped: Promise<boolean> = shell.ready;
// @ts-expect-error Startup choice must be a boolean.
mountApplication(() => new Feature(), { start: 'manual' });
void skipped;
const exactApp: MountedApplication<InstanceType<typeof Feature>> = app;
// @ts-expect-error The mount chooses the destination; callers cannot override it.
mountApplication(() => new Feature(), { startOptions: { region: app.region } });
const runtime = createMarionette();
mountView(new runtime.View(), { regionClass: runtime.Region });
mountApplication(() => new runtime.Application(), { regionClass: runtime.Region });
const scope = createTestScope();
scope.own(editor);
scope.defer(async () => {});
scope.defer(() => true);
scope.defer(() => 1);
scope.defer(async () => 'ignored');
scope.own({ cleanup: () => false });
scope.own({ cleanup: async () => 1 });
// @ts-expect-error Mount identities are fixed; use region.show() to replace a View.
editor.region = app.region;
// @ts-expect-error The original mounted View is a readonly identity.
editor.view = new Editor();
// @ts-expect-error The helper owns the original container.
editor.container = document.body;
// @ts-expect-error The original slot cannot be reassigned.
editor.slot = document.createElement('div');
// @ts-expect-error The original Application is a readonly identity.
app.app = app.app;
// @ts-expect-error Readiness always refers to the initial start attempt.
app.ready = Promise.resolve(true);
void [text, el, exactView, result, ready, exactApp];

// @ts-expect-error Neutral imports do not introduce optional Cypress globals.
let absentRunner: Cypress.Chainable;
void absentRunner;
