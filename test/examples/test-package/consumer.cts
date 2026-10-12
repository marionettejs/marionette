import Marionette = require('marionette');
const { Application, View, createMarionette } = Marionette;
import Helpers = require('@mnjs/test');
const { mountView, mountApplication, createTestScope } = Helpers;
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
const exactApp: MountedApplication<InstanceType<typeof Feature>> = app;
// @ts-expect-error The mount chooses the destination; callers cannot override it.
mountApplication(() => new Feature(), { startOptions: { region: app.region } });
const runtime = createMarionette();
mountView(new runtime.View(), { regionClass: runtime.Region });
mountApplication(() => new runtime.Application(), { regionClass: runtime.Region });
const scope = createTestScope();
scope.own(editor);
scope.defer(async () => {});
void [text, el, exactView, result, ready, exactApp];
