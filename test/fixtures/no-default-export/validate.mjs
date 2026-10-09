import assert from 'assert';
import { spawnSync } from 'child_process';

const result = spawnSync(process.execPath, [
  '--input-type=module',
  '--eval',
  'import Mn from "marionette"; console.log(Mn);',
], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

assert.notStrictEqual(result.status, 0);
assert.match(result.stderr, /default|does not provide/i);
