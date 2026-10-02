import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as utils from '@mnjs/utils';

describe('standalone utility documentation example', () => {
  it('runs without importing the Marionette core package', () => {
    const markdown = readFileSync('packages/utils/readme.md', 'utf8');
    const example = markdown.match(/```(?:javascript|js)\n([\s\S]*?)```/)[1];
    expect(example).not.toContain('from \'marionette\'');
    const code = example.replace(/^import .* from .*;\n/gm, '').replace(/^export /gm, '');
    const result = new Function(...Object.keys(utils), code + `
      return [component.triggerMethod('open'), component.normalizeMethods({ open: 'onOpen' }).open === component.onOpen];
    `)(...Object.values(utils));
    expect(result).toEqual(['Inbox', true]);
  });
});
