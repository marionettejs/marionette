// Executed only as a child process by the isolated release CLI fixtures.
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
const state = JSON.parse(readFileSync(process.env.RELEASE_TEST_STATE));
const tool = process.env.RELEASE_TEST_TOOL || basename(process.argv[1]);
appendFileSync(process.env.RELEASE_TEST_LOG, `${JSON.stringify({ tool, args })}\n`);
const save = () => writeFileSync(process.env.RELEASE_TEST_STATE, JSON.stringify(state));
function fail(message, code = 1) { console.error(message); save(); process.exit(code); }
function output(value) { console.log(value); save(); process.exit(0); }
const option = name => args[args.indexOf(name) + 1];

if (tool === 'npm') {
  if (args[0] !== 'view') { fail(`Unexpected npm command: ${args}`); }
  if (args[2] === 'dist-tags') {
    const name = args[1];
    if (state.tagsError === name) { fail('npm ERR! E503 registry unavailable'); }
    const entry = state.packages.find(candidate => candidate.name === name);
    output(JSON.stringify(state.tags?.[name] ?? (entry.version.includes('-') ?
      { next: entry.version } : { latest: entry.version })));
  }
  const name = args[1].slice(0, args[1].lastIndexOf('@'));
  const entry = state.packages.find(candidate => candidate.name === name);
  const configured = state.npm?.[name] || 'exact';
  const mode = Array.isArray(configured) ? configured.shift() : configured;
  if (mode === 'available') { fail('npm ERR! E404 404 Not Found'); }
  if (mode === 'unavailable') { fail('npm ERR! E503 registry unavailable'); }
  output(JSON.stringify(mode === 'exact' ? entry.tarball.integrity : 'sha512-conflict'));
}
if (tool === 'git') {
  if (args[0] === 'ls-remote') {
    if (state.gitError) { fail('remote unavailable'); }
    output(state.remoteTag ? `${state.remoteTag}\trefs/tags/${state.tag}\n` : '');
  }
  fail(`Forbidden git command: ${args}`);
}
if (tool !== 'gh') { fail(`Unexpected tool: ${tool}`); }
if (args[0] === 'api') {
  if (args.includes('POST')) {
    if (state.tagCreateFailure) { fail('tag creation rejected'); }
    state.tagObject = ['commit', state.commit]; output('{}');
  }
  if (args[1].includes('/releases/tags/')) {
    if (state.ghError) { fail('HTTP 503 unavailable'); }
    if (!state.release) { fail('HTTP 404 Not Found'); }
    output('42');
  }
  if (state.tagInspectFailure) { fail('HTTP 403 Forbidden'); }
  const object = args[1].includes('/git/tags/') ? state.annotatedTags?.[args[1].split('/').pop()] : state.tagObject;
  if (!object) { fail('HTTP 404 Not Found'); }
  output(object.join('\t'));
}
if (args[0] !== 'release') { fail(`Unexpected gh command: ${args}`); }
switch (args[1]) {
  case 'view':
    if (state.ghError) { fail('HTTP 503 unavailable'); }
    if (!state.release) { fail('release not found'); }
    output(JSON.stringify(state.release)); break;
  case 'create': {
    if (state.createFailure) { fail('draft upload failed'); }
    const paths = args.filter(arg => arg.startsWith(state.artifacts + '/'));
    mkdirSync(state.remote, { recursive: true });
    for (const path of paths) { copyFileSync(path, join(state.remote, basename(path))); }
    state.release = { isDraft: true, tagName: state.tag, targetCommitish: option('--target'), assets: paths.map(path => ({ name: basename(path) })) };
    output('draft created'); break;
  }
  case 'download':
    if (state.downloadFailure) { fail('download interrupted'); }
    for (const file of readdirSync(state.remote)) { copyFileSync(join(state.remote, file), join(option('--dir'), file)); }
    if (state.corruptDownload) { writeFileSync(join(option('--dir'), state.corruptDownload), 'corrupt'); }
    if (state.extraDownload) { writeFileSync(join(option('--dir'), 'unexpected.txt'), 'extra'); }
    if (state.mutateLocalDuringDownload) { writeFileSync(join(state.artifacts, 'utils.tgz'), 'changed after initial verification'); }
    output('downloaded'); break;
  case 'edit':
    if (state.editFailure) { fail('release edit failed'); }
    state.release.isDraft = false; output('published'); break;
  default: fail(`Unexpected gh release command: ${args}`);
}
