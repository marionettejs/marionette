import { defineConfig } from '@playwright/test';
import base from './playwright.config.mjs';

// The five-package release does not contain the independently versioned router.
// Discover every other core test so strict inventory checks still detect drift.
export default defineConfig({ ...base, testIgnore: ['**/router-*.spec.mjs'] });
