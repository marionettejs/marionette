import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import {
  AgentBenchmarkTaskContractError,
  validateTaskContracts,
} from '../../scripts/agent-benchmark/task-contract.mjs';

const capabilities = {
  schemaVersion: 1,
  coverage: {
    minimumTasks: 10,
    minimumIndependentTasksPerCapability: 2,
  },
  capabilities: [
    { id: 'nested-regions', description: 'Compose nested Regions.' },
    { id: 'plain-view', description: 'Implement a plain View.' },
  ],
};

function validTask(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'render-a-view',
    title: 'Render a view',
    promptPath: 'tasks/render-a-view/prompt.md',
    workspacePath: 'tasks/render-a-view/workspace',
    capabilities: ['plain-view'],
    acceptance: {
      command: ['npm', 'test'],
      hiddenTests: [{
        sourcePath: 'tasks/render-a-view/acceptance/render.test.mjs',
        targetPath: 'test/render.test.mjs',
      }],
    },
    ...overrides,
  };
}

async function expectContractError(root, tasks, message, catalog = capabilities) {
  await assert.rejects(
    validateTaskContracts({ root, tasks, capabilities: catalog }),
    error => error instanceof AgentBenchmarkTaskContractError && error.errors.includes(message)
  );
}

describe('agent benchmark task contract', () => {
  let root;

  beforeEach(async() => {
    root = await mkdtemp(join(tmpdir(), 'marionette-agent-task-'));
    await mkdir(join(root, 'tasks/render-a-view/workspace'), { recursive: true });
    await mkdir(join(root, 'tasks/render-a-view/workspace/test'));
    await mkdir(join(root, 'tasks/render-a-view/acceptance'), { recursive: true });
    await writeFile(join(root, 'tasks/render-a-view/prompt.md'), '# Task\n');
    await writeFile(join(root, 'tasks/render-a-view/acceptance/render.test.mjs'), 'export {};\n');
  });

  afterEach(async() => {
    await rm(root, { recursive: true, force: true });
  });

  test('accepts valid task metadata with hidden tests outside the workspace', async() => {
    const tasks = [validTask()];

    assert.equal(await validateTaskContracts({ root, tasks, capabilities }), tasks);
  });

  test('accepts the checked-in capability catalog without claiming corpus completeness', async() => {
    const tasks = [];

    assert.equal(await validateTaskContracts({ root, tasks }), tasks);
  });

  test('rejects duplicate task ids', async() => {
    await expectContractError(root, [validTask(), validTask()], 'duplicate task id render-a-view');
  });

  test('rejects unknown and unsorted capabilities', async() => {
    const task = validTask({ capabilities: ['plain-view', 'nested-regions', 'missing-capability'] });

    await assert.rejects(
      validateTaskContracts({ root, tasks: [task], capabilities }),
      error => error instanceof AgentBenchmarkTaskContractError &&
        error.errors.includes('render-a-view capabilities must be sorted') &&
        error.errors.includes('render-a-view uses unknown capability missing-capability')
    );
  });

  test('rejects duplicate capabilities through the task schema', async() => {
    const task = validTask({ capabilities: ['plain-view', 'plain-view'] });

    await assert.rejects(
      validateTaskContracts({ root, tasks: [task], capabilities }),
      error => error instanceof AgentBenchmarkTaskContractError &&
        error.errors.some(message => message.includes('/capabilities must NOT have duplicate items'))
    );
  });

  test('rejects missing referenced paths and traversal', async() => {
    const missing = validTask({ promptPath: 'tasks/render-a-view/missing.md' });
    const traversal = validTask({ workspacePath: '../outside' });

    await expectContractError(
      root,
      [missing],
      'render-a-view promptPath does not exist: tasks/render-a-view/missing.md'
    );
    await assert.rejects(
      validateTaskContracts({ root, tasks: [traversal], capabilities }),
      error => error instanceof AgentBenchmarkTaskContractError &&
        error.errors.some(message => message.includes('/workspacePath must match pattern'))
    );
  });

  test('rejects hidden tests inside the agent-visible workspace', async() => {
    await writeFile(join(root, 'tasks/render-a-view/workspace/leaked.test.mjs'), 'export {};\n');
    const task = validTask({
      acceptance: {
        command: ['npm', 'test'],
        hiddenTests: [{
          sourcePath: 'tasks/render-a-view/workspace/leaked.test.mjs',
          targetPath: 'test/leaked.test.mjs',
        }],
      },
    });

    await expectContractError(
      root,
      [task],
      'render-a-view hidden test must be outside workspacePath: tasks/render-a-view/workspace/leaked.test.mjs'
    );
  });

  test('rejects a hidden test used directly as the public prompt', async() => {
    const hiddenTestPath = 'tasks/render-a-view/acceptance/render.test.mjs';

    await expectContractError(
      root,
      [validTask({ promptPath: hiddenTestPath })],
      `render-a-view hidden test must not also be promptPath: ${hiddenTestPath}`
    );
  });

  test('rejects a public prompt symlinked to a hidden test', async() => {
    const promptPath = 'tasks/render-a-view/prompt-alias.md';
    const hiddenTestPath = 'tasks/render-a-view/acceptance/render.test.mjs';
    await symlink(join(root, hiddenTestPath), join(root, promptPath));

    await expectContractError(
      root,
      [validTask({ promptPath })],
      `render-a-view hidden test must not also be promptPath: ${hiddenTestPath}`
    );
  });

  test('rejects a public prompt hard-linked to a hidden test', async() => {
    const promptPath = 'tasks/render-a-view/prompt-hard-link.md';
    const hiddenTestPath = 'tasks/render-a-view/acceptance/render.test.mjs';
    await link(join(root, hiddenTestPath), join(root, promptPath));

    await expectContractError(
      root,
      [validTask({ promptPath })],
      `render-a-view hidden test must not also be promptPath: ${hiddenTestPath}`
    );
  });

  test('rejects a prompt that exposes another task hidden test', async() => {
    await mkdir(join(root, 'tasks/edit-a-view/workspace/test'), { recursive: true });
    await mkdir(join(root, 'tasks/edit-a-view/acceptance'), { recursive: true });
    await writeFile(join(root, 'tasks/edit-a-view/acceptance/edit.test.mjs'), 'export {};\n');
    const exposedHiddenTest = 'tasks/render-a-view/acceptance/render.test.mjs';
    const secondTask = validTask({
      id: 'edit-a-view',
      title: 'Edit a view',
      promptPath: exposedHiddenTest,
      workspacePath: 'tasks/edit-a-view/workspace',
      acceptance: {
        command: ['npm', 'test'],
        hiddenTests: [{
          sourcePath: 'tasks/edit-a-view/acceptance/edit.test.mjs',
          targetPath: 'test/edit.test.mjs',
        }],
      },
    });

    await expectContractError(
      root,
      [validTask(), secondTask],
      `edit-a-view promptPath must not expose render-a-view hidden test: ${exposedHiddenTest}`
    );
  });

  test('rejects a workspace that exposes another task hidden test', async() => {
    await mkdir(join(root, 'tasks/edit-a-view/workspace/test'), { recursive: true });
    await mkdir(join(root, 'tasks/edit-a-view/acceptance'), { recursive: true });
    await writeFile(join(root, 'tasks/edit-a-view/prompt.md'), '# Edit a view\n');
    await writeFile(join(root, 'tasks/edit-a-view/acceptance/edit.test.mjs'), 'export {};\n');
    const exposedHiddenTest = 'tasks/render-a-view/acceptance/render.test.mjs';
    await link(
      join(root, exposedHiddenTest),
      join(root, 'tasks/edit-a-view/workspace/render.test.mjs')
    );
    const secondTask = validTask({
      id: 'edit-a-view',
      title: 'Edit a view',
      promptPath: 'tasks/edit-a-view/prompt.md',
      workspacePath: 'tasks/edit-a-view/workspace',
      acceptance: {
        command: ['npm', 'test'],
        hiddenTests: [{
          sourcePath: 'tasks/edit-a-view/acceptance/edit.test.mjs',
          targetPath: 'test/edit.test.mjs',
        }],
      },
    });

    await expectContractError(
      root,
      [validTask(), secondTask],
      `edit-a-view workspacePath must not expose render-a-view hidden test: ${exposedHiddenTest}`
    );
  });

  test('rejects workspace symlinks that could expose withheld files', async() => {
    await symlink(
      join(root, 'tasks/render-a-view/acceptance/render.test.mjs'),
      join(root, 'tasks/render-a-view/workspace/leaked.test.mjs')
    );

    await expectContractError(
      root,
      [validTask()],
      'render-a-view workspacePath must not contain symlinks: leaked.test.mjs'
    );
  });

  test('rejects a symlink used as the workspace root', async() => {
    await mkdir(join(root, 'tasks/shared-workspace/test'), { recursive: true });
    await symlink(
      join(root, 'tasks/shared-workspace'),
      join(root, 'tasks/render-a-view/workspace-link')
    );

    await expectContractError(
      root,
      [validTask({ workspacePath: 'tasks/render-a-view/workspace-link' })],
      'render-a-view workspacePath must not be a symlink: tasks/render-a-view/workspace-link'
    );
  });

  test('rejects hidden test targets that would overwrite agent-visible files', async() => {
    await writeFile(join(root, 'tasks/render-a-view/workspace/test/render.test.mjs'), 'export {};\n');

    await expectContractError(
      root,
      [validTask()],
      'render-a-view hidden test target already exists in workspacePath: test/render.test.mjs'
    );
  });

  test('rejects hidden test target parents that resolve outside the workspace', async() => {
    const externalRoot = await mkdtemp(join(tmpdir(), 'marionette-agent-target-'));
    await symlink(externalRoot, join(root, 'tasks/render-a-view/workspace/external'));
    const task = validTask({
      acceptance: {
        command: ['npm', 'test'],
        hiddenTests: [{
          sourcePath: 'tasks/render-a-view/acceptance/render.test.mjs',
          targetPath: 'external/render.test.mjs',
        }],
      },
    });

    try {
      await expectContractError(
        root,
        [task],
        'render-a-view hidden test target parent resolves outside workspacePath: external/render.test.mjs'
      );
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  test('rejects referenced symlinks that resolve outside the repository root', async() => {
    const externalRoot = await mkdtemp(join(tmpdir(), 'marionette-agent-external-'));
    const externalPrompt = join(externalRoot, 'prompt.md');
    await writeFile(externalPrompt, '# External task\n');
    await symlink(externalPrompt, join(root, 'tasks/render-a-view/external-prompt.md'));

    try {
      await expectContractError(
        root,
        [validTask({ promptPath: 'tasks/render-a-view/external-prompt.md' })],
        'render-a-view promptPath resolves outside the repository root: tasks/render-a-view/external-prompt.md'
      );
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  test('rejects a malformed capability catalog', async() => {
    const malformedCapabilities = structuredClone(capabilities);
    malformedCapabilities.capabilities.reverse();

    await expectContractError(
      root,
      [validTask()],
      'capability ids must be sorted',
      malformedCapabilities
    );
  });

  test('rejects a numeric capability id instead of coercing it to a slug', async() => {
    const malformedCapabilities = structuredClone(capabilities);
    malformedCapabilities.capabilities[0].id = 123;

    await expectContractError(
      root,
      [validTask()],
      'capability ids must be lowercase slugs',
      malformedCapabilities
    );
  });
});
