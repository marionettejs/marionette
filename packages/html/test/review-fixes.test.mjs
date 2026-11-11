import './setup.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerReviewRegressions} from './review-regressions.mjs';
registerReviewRegressions(test, assert, process.execArgv.includes('--conditions=development'));
