import './setup.mjs';
import {test} from 'node:test';
import {keyedRegressions, syncAncestorRegressions, commentCloseRegressions} from './public-regressions.mjs';
test('keyed disposes old child ownership before replacement', keyedRegressions);
// Escaped CSS parsing is tested in real browsers because jsdom lacks it.

test('synchronous directive ancestors dispose async descendants and preserve reconnect', syncAncestorRegressions);

test('browser comment endings preserve binding parsing and event rejection', commentCloseRegressions);
