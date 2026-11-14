// Public Core/config and installed binding behavior; run core|vue|react separately.
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body></body>');
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key] = dom.window[key];
const {createNode,createClasses} = await import('@formkit/core');
const mode = process.argv[2] ?? 'core';
const options = mode === 'core' ? {} : (await import('@formkit/' + mode)).defaultConfig();
const root = createNode({...options,type: 'group',props: {type: 'group'},config: {classes: {input: ()=>({initial: true})}}});
const inherited = createNode({...options,parent: root,props: {type: 'text'},config: {}});
const overridden = createNode({...options,parent: root,props: {type: 'text'},config: {classes: {input: ()=>({local: true})}}});
const read = node=>mode === 'core' ? Object.keys(createClasses('input',node,node.config.classes.input)).join(' ') : node.context.classes.input;
const pause = ()=>new Promise(resolve=>setTimeout(resolve,40));
const report = {mode,initial: read(inherited),local: read(overridden)};
try {
  assert.match(report.initial,/initial/);assert.match(report.local,/local/);
  root.config.classes = {input: ()=>({replaced: true})};await pause();
  report.replaced = read(inherited);report.localAfterParentReplacement = read(overridden);
  if (mode === 'react') {assert.match(report.replaced,/initial/);report.parentReplacementDivergence = 'React 2.5 retains cached classes';} else {assert.match(report.replaced,/replaced/);assert.doesNotMatch(report.replaced,/initial/);}
  assert.match(report.localAfterParentReplacement,/local/);assert.doesNotMatch(report.localAfterParentReplacement,/replaced/);
  const late = createNode({...options,parent: root,props: {type: 'text'},config: {}});
  try {report.late = read(late);assert.match(report.late,/replaced/);} finally {late.destroy();}
  inherited.config.classes = {input: ()=>({fieldReplacement: true})};await pause();
  report.fieldReplacement = read(inherited);if (mode === 'react') {assert.match(report.fieldReplacement,/initial/);report.fieldReplacementDivergence = 'React 2.5 retains cached classes';} else assert.match(report.fieldReplacement,/fieldReplacement/);
  report.status = 'passed';console.log(JSON.stringify(report));
} finally {root.destroy();inherited.destroy();overridden.destroy();dom.window.close();}
