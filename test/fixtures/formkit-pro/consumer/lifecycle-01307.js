import { FormView, FieldView } from '@mnjs/formkit';
import { Region } from 'marionette';
import { getNode } from '@formkit/core';

import { createIntervalBridge } from './interval-ledger.js';
import { lifecycleBridge } from './lifecycle-session.js';

let running = false;
export async function runLifecycle({ plugins, cycles = 2, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), intervalDelay = 4000, margin = 250, probeInputType = 'autocomplete' } = {}) {
  if (running) { throw new Error('A lifecycle probe is already running.'); }
  if (!plugins?.length || !Number.isInteger(cycles) || cycles < 2) { throw new Error('Supply the approved plugin and at least two cycles.'); }
  const ledger = (lifecycleBridge ?? createIntervalBridge(globalThis)).start();
  running = true;
  const owners = [];
  const requiredCohorts = [];
  const dead = [];
  const checks = [];
  const check = (name, passed, actual = null) => { checks.push({ name, passed: !!passed, actual }); };
  const rows = scope => ledger.rows().filter(record => record.scope === scope && record.delay === intervalDelay);
  const checkLive = entries => entries.forEach(entry => {
    const current = rows(entry.scope);
    check(`live ${entry.scope}`, entry.node.context !== null && entry.element.isConnected && current.every(record => record.active && record.ticks > 0),
      { timers: current.length, active: current.filter(record => record.active).length, ticks: current.map(record => record.ticks) });
  });
  const checkDead = () => dead.forEach(entry => {
    const current = rows(entry.scope);
    check(`destroyed ${entry.scope}`, entry.node.context === null && !entry.element.isConnected && !getNode(entry.id) &&
      current.length === entry.before.length && current.every(record => record.cleared && !record.active && entry.before.some(prior => prior.serial === record.serial && prior.ticks === record.ticks)),
    { timers: current.length, active: current.filter(record => record.active).length, ticks: current.map(record => record.ticks), before: entry.before });
  });
  function makeEntry(scope, node, element) {
    const result = { scope, node, element, id: node.props.id };
    return result;
  }
  function makeForm(label, chosenPlugins) {
    const host = document.body.appendChild(document.createElement('div'));
    const region = new Region({ el: host }); owners.push({ region, host });
    let submits = 0; let submittedText;
    const form = ledger.capture(`${label}:root`, () => new FormView({ formProps: { actions: false, id: `${label}-root` }, plugins: chosenPlugins,
      values: { text: 'Initial', files: [], choice: '' }, config: { delay: 0 }, submit: values => { submits++; submittedText = values.text; },
      template: () => '<div data-text></div><div data-files></div><div data-ignored></div><div data-choice></div><div data-child></div>',
      regions: { text: '[data-text]', files: '[data-files]', ignored: '[data-ignored]', choice: '[data-choice]', child: '[data-child]' } }));
    ledger.capture(`${label}:root`, () => region.show(form));
    const entries = [makeEntry(`${label}:root`, form.node, form.el)];
    for (const [name, type] of [['text', 'text'], ['files', 'file'], ['ignored', 'button'], ['choice', chosenPlugins.length ? probeInputType : 'text']]) {
      const scope = `${label}:${name}`;
      const view = ledger.capture(scope, () => {
        const field = new FieldView({ form, name, input: { type, id: `${label}-${name}`, ...(type === 'button' ? { ignore: true, label: 'Ignored action' } : {}), ...(name === 'choice' ? { options: [{ value: 'alpha', label: 'Alpha' }, { value: 'beta', label: 'Beta' }] } : {}) } });
        form.showChildView(name, field); return field;
      });
      entries.push(makeEntry(scope, view.node, view.el));
    }
    if (chosenPlugins.length) { requiredCohorts.push({ prefix: `${label}:` }); }
    return { form, region, entries, get submits() { return submits; }, get submittedText() { return submittedText; } };
  }
  function markDead(entries) {
    for (const item of entries) { const current = rows(item.scope); dead.push({ ...item, before: current.map(record => ({ serial: record.serial, ticks: record.ticks })) }); }
  }
  let report;
  try {
    const control = makeForm('lifecycle-core-control', []);
    check('no-Pro control has live nodes but no target intervals', control.entries.every(item => item.node.context !== null && item.element.isConnected && rows(item.scope).length === 0));
    control.region.destroy();
    const survivor = makeForm('lifecycle-survivor', plugins);
    await survivor.form.node.settled;
    const survivorHandles = survivor.entries.map(item => rows(item.scope).map(record => record.serial));
    for (let cycle = 0; cycle < cycles; cycle++) {
      const scope = `lifecycle-child-${cycle}`;
      const child = ledger.capture(scope, () => {
        const field = new FieldView({ form: survivor.form, name: 'temporary', removal: 'clear', input: { type: probeInputType, id: scope, options: [{ value: 'alpha', label: 'Alpha' }, { value: 'beta', label: 'Beta' }] } });
        survivor.form.showChildView('child', field); return field;
      });
      const childEntry = makeEntry(scope, child.node, child.el);
      requiredCohorts.push({ scope });
      const transient = makeForm(`lifecycle-transient-${cycle}`, plugins);
      await transient.form.node.settled;
      await survivor.form.node.at('text').input('Edited', false);
      await survivor.form.node.at('files').input([{ name: 'lifecycle.txt', file: new File(['synthetic'], 'lifecycle.txt') }], false);
      await wait(0);
      const textInput = survivor.entries[1].element.querySelector('input');
      check(`programmatic Core value and synthetic file ${cycle}`, survivor.form.getValues().text === 'Edited' &&
        textInput.value === 'Edited' && survivor.form.getValues().files[0]?.file instanceof File);
      check(`submit ${cycle}`, await survivor.form.submit() === 'success' && survivor.submits === cycle + 1 && survivor.submittedText === 'Edited');
      survivor.form.resetForm(); await survivor.form.node.settled; await wait(0);
      check(`reset ${cycle}`, survivor.form.getValues().text === 'Initial' && textInput.value === 'Initial' && survivor.form.getValues().files.length === 0);
      await wait(intervalDelay + margin);
      checkLive([...survivor.entries, childEntry, ...transient.entries]); checkDead();
      survivor.entries.forEach((item, index) => check(`same survivor handles ${cycle}/${index}`,
        JSON.stringify(rows(item.scope).map(record => record.serial)) === JSON.stringify(survivorHandles[index])));
      const survivorTicks = survivor.entries.map(item => rows(item.scope).map(record => ({ serial: record.serial, ticks: record.ticks })));
      markDead([childEntry, ...transient.entries]);
      survivor.form.getRegion('child').empty(); transient.region.destroy();
      checkDead();
      check(`survivor retained after teardown ${cycle}`, survivor.entries.every(item => rows(item.scope).every(record => record.active) && item.node.context !== null));
      await wait(intervalDelay + margin); checkDead();
      survivor.entries.forEach((item, index) => check(`survivor ticks after teardown ${cycle}/${index}`,
        rows(item.scope).every(record => record.active && survivorTicks[index].some(prior => prior.serial === record.serial && record.ticks > prior.ticks)),
        { before: survivorTicks[index], after: rows(item.scope).map(record => record.ticks) }));
    }
    markDead(survivor.entries); survivor.region.destroy();
    await wait(intervalDelay + margin); checkDead();
    const intervals = ledger.rows();
    const observationComplete = requiredCohorts.every(cohort => intervals.some(record => record.delay === intervalDelay && (cohort.scope ? record.scope === cohort.scope : record.scope?.startsWith(cohort.prefix)))) && intervals.every(record => record.scope !== null);
    check('required timer cohorts exercised', observationComplete, { requiredCohorts });
    check('no unattributed interval registration', intervals.every(record => record.scope !== null),
      { unattributed: intervals.filter(record => record.scope === null).length });
    check('no active captured interval before collector cleanup', intervals.every(record => record.scope === null || !record.active));
    report = { passed: checks.every(item => item.passed), checks, intervals, cycles, intervalDelay, margin, probeInputType, bootstrapIntervals: ledger.bootstrap(),
      observationComplete, garbageCollectionMeasured: false, callbackSourceRecorded: false, nodeOrFileValuesRecorded: false };
  } catch (error) {
    report = { passed: false, checks, intervals: ledger.rows(), executionError: error instanceof Error ? error.name : 'UnknownError',
      garbageCollectionMeasured: false, nodeOrFileValuesRecorded: false };
  } finally {
    let cleanupErrors = 0;
    for (const owner of owners.reverse()) { try { owner.region.destroy(); } catch { cleanupErrors++; } finally { owner.host.remove(); } }
    const cleanup = ledger.finish(); running = false;
    if (report) { report.collectorCleanup = { ...cleanup, cleanupErrors }; report.passed = report.passed && cleanup.restored && cleanupErrors === 0; }
  }
  return report;
}
