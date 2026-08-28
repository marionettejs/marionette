import Ajv from 'ajv';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const defaultCapabilities = JSON.parse(await readFile(
  resolve(repositoryRoot, 'benchmarks/agent/capabilities.json'),
  'utf8'
));
const defaultSchema = JSON.parse(await readFile(
  resolve(repositoryRoot, 'benchmarks/agent/task.schema.json'),
  'utf8'
));

export class AgentBenchmarkTaskContractError extends Error {
  constructor(errors) {
    super(errors.join('\n'));
    this.name = 'AgentBenchmarkTaskContractError';
    this.errors = errors;
  }
}

function isWithin(parent, child) {
  const childRelativePath = relative(parent, child);

  return childRelativePath === '' ||
    (childRelativePath !== '..' &&
      !childRelativePath.startsWith(`..${sep}`) &&
      !isAbsolute(childRelativePath));
}

function validateCapabilityCatalog(catalog, errors) {
  if (!catalog || Object.keys(catalog).sort().join(',') !== 'capabilities,coverage,schemaVersion') {
    errors.push('capability catalog must contain only schemaVersion, coverage, and capabilities');
  }

  if (catalog?.schemaVersion !== 1) {
    errors.push('capability catalog schemaVersion must be 1');
  }

  if (!catalog?.coverage ||
    Object.keys(catalog.coverage).sort().join(',') !==
      'minimumIndependentTasksPerCapability,minimumTasks') {
    errors.push('capability catalog coverage must contain only the two minimum task fields');
  }

  if (catalog?.coverage?.minimumTasks !== 10) {
    errors.push('capability catalog minimumTasks must be 10');
  }

  if (catalog?.coverage?.minimumIndependentTasksPerCapability !== 2) {
    errors.push('capability catalog minimumIndependentTasksPerCapability must be 2');
  }

  if (!Array.isArray(catalog?.capabilities) || !catalog.capabilities.length) {
    errors.push('capability catalog must contain capabilities');
    return new Set();
  }

  const capabilityIds = catalog.capabilities.map(capability => capability?.id);
  const sortedCapabilityIds = [...capabilityIds].sort();

  if (capabilityIds.some(id =>
    typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
  )) {
    errors.push('capability ids must be lowercase slugs');
  }

  if (new Set(capabilityIds).size !== capabilityIds.length) {
    errors.push('capability ids must be unique');
  }

  if (JSON.stringify(capabilityIds) !== JSON.stringify(sortedCapabilityIds)) {
    errors.push('capability ids must be sorted');
  }

  for (const capability of catalog.capabilities) {
    if (!capability || Object.keys(capability).sort().join(',') !== 'description,id' ||
      typeof capability.description !== 'string' || !capability.description.trim()) {
      errors.push(`capability ${capability?.id || '<unknown>'} must contain only id and a non-empty description`);
    }
  }

  return new Set(capabilityIds);
}

async function validateReferencedPath({
  expectedType,
  label,
  path,
  rejectSymlink = false,
  root,
  realRoot,
}, errors) {
  const absolutePath = resolve(root, path);
  let realPath;
  let linkStat;
  let pathStat;

  if (!isWithin(root, absolutePath)) {
    errors.push(`${label} must stay within the repository root: ${path}`);
    return;
  }

  try {
    [realPath, linkStat, pathStat] = await Promise.all([
      realpath(absolutePath),
      lstat(absolutePath),
      stat(absolutePath),
    ]);
  } catch {
    errors.push(`${label} does not exist: ${path}`);
    return;
  }

  if (!isWithin(realRoot, realPath)) {
    errors.push(`${label} resolves outside the repository root: ${path}`);
    return;
  }

  if (rejectSymlink && linkStat.isSymbolicLink()) {
    errors.push(`${label} must not be a symlink: ${path}`);
  }

  if (expectedType === 'file' && !pathStat.isFile()) {
    errors.push(`${label} must be a file: ${path}`);
  }

  if (expectedType === 'directory' && !pathStat.isDirectory()) {
    errors.push(`${label} must be a directory: ${path}`);
  }

  return { realPath, stat: pathStat };
}

function isSameFile(left, right) {
  return left.realPath === right.realPath ||
    (left.stat.ino !== 0 && right.stat.ino !== 0 &&
      left.stat.dev === right.stat.dev && left.stat.ino === right.stat.ino);
}

async function validateHiddenTarget({ taskId, targetPath, workspacePath }, errors) {
  const absoluteTargetPath = resolve(workspacePath, targetPath);
  const targetParentPath = dirname(absoluteTargetPath);
  let realTargetParent;
  let targetParentStat;

  if (!isWithin(workspacePath, absoluteTargetPath)) {
    errors.push(`${taskId} hidden test target must stay within workspacePath: ${targetPath}`);
    return;
  }

  try {
    [realTargetParent, targetParentStat] = await Promise.all([
      realpath(targetParentPath),
      stat(targetParentPath),
    ]);
  } catch {
    errors.push(`${taskId} hidden test target parent does not exist: ${targetPath}`);
    return;
  }

  if (!isWithin(workspacePath, realTargetParent)) {
    errors.push(`${taskId} hidden test target parent resolves outside workspacePath: ${targetPath}`);
    return;
  }

  if (!targetParentStat.isDirectory()) {
    errors.push(`${taskId} hidden test target parent must be a directory: ${targetPath}`);
    return;
  }

  try {
    await lstat(absoluteTargetPath);
    errors.push(`${taskId} hidden test target already exists in workspacePath: ${targetPath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      errors.push(`${taskId} hidden test target cannot be inspected: ${targetPath}`);
    }
  }
}

async function inspectWorkspace(taskId, workspacePath, errors, directory = workspacePath, files = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isSymbolicLink()) {
      errors.push(`${taskId} workspacePath must not contain symlinks: ${relative(workspacePath, entryPath)}`);
    } else if (entry.isDirectory()) {
      await inspectWorkspace(taskId, workspacePath, errors, entryPath, files);
    } else if (entry.isFile()) {
      const [fileRealPath, fileStat] = await Promise.all([realpath(entryPath), stat(entryPath)]);
      files.push({ realPath: fileRealPath, stat: fileStat });
    }
  }

  return files;
}

/**
 * Validate agent benchmark task metadata and its referenced repository paths.
 *
 * @param {object} options Validation options.
 * @param {string} options.root Repository root containing the referenced paths.
 * @param {object[]} options.tasks Task metadata objects.
 * @param {object} [options.capabilities] Capability catalog override.
 * @param {object} [options.schema] Task schema override.
 * @returns {Promise<object[]>} The validated task metadata.
 */
export async function validateTaskContracts({
  root,
  tasks,
  capabilities = defaultCapabilities,
  schema = defaultSchema,
}) {
  const errors = [];
  const absoluteRoot = resolve(root);
  const realRoot = await realpath(absoluteRoot);
  const knownCapabilities = validateCapabilityCatalog(capabilities, errors);
  const validateTask = new Ajv({ allErrors: true }).compile(schema);

  if (!Array.isArray(tasks)) {
    throw new AgentBenchmarkTaskContractError([...errors, 'tasks must be an array']);
  }

  const taskIds = new Set();
  const hiddenSources = [];
  const prompts = [];
  const workspaces = [];

  for (const [index, task] of tasks.entries()) {
    const taskLabel = task?.id || `task at index ${index}`;

    if (!validateTask(task)) {
      for (const validationError of validateTask.errors) {
        errors.push(`${taskLabel}${validationError.instancePath || ''} ${validationError.message}`);
      }
      continue;
    }

    if (taskIds.has(task.id)) {
      errors.push(`duplicate task id ${task.id}`);
    }
    taskIds.add(task.id);

    const sortedCapabilities = [...task.capabilities].sort();
    if (JSON.stringify(task.capabilities) !== JSON.stringify(sortedCapabilities)) {
      errors.push(`${task.id} capabilities must be sorted`);
    }

    for (const capability of task.capabilities) {
      if (!knownCapabilities.has(capability)) {
        errors.push(`${task.id} uses unknown capability ${capability}`);
      }
    }

    const promptReference = await validateReferencedPath({
      expectedType: 'file',
      label: `${task.id} promptPath`,
      path: task.promptPath,
      root: absoluteRoot,
      realRoot,
    }, errors);
    const workspaceReference = await validateReferencedPath({
      expectedType: 'directory',
      label: `${task.id} workspacePath`,
      path: task.workspacePath,
      rejectSymlink: true,
      root: absoluteRoot,
      realRoot,
    }, errors);

    if (promptReference) {
      prompts.push({ path: task.promptPath, reference: promptReference, taskId: task.id });
    }

    if (workspaceReference) {
      const files = await inspectWorkspace(
        task.id,
        workspaceReference.realPath,
        errors
      );
      workspaces.push({
        files,
        path: task.workspacePath,
        reference: workspaceReference,
        taskId: task.id,
      });
    }

    const hiddenTargetPaths = new Set();

    for (const hiddenTest of task.acceptance.hiddenTests) {
      const hiddenTestPath = hiddenTest.sourcePath;
      const hiddenTestReference = await validateReferencedPath({
        expectedType: 'file',
        label: `${task.id} hidden test`,
        path: hiddenTestPath,
        root: absoluteRoot,
        realRoot,
      }, errors);

      if (hiddenTestReference) {
        hiddenSources.push({
          path: hiddenTestPath,
          reference: hiddenTestReference,
          taskId: task.id,
        });
      }

      if (hiddenTargetPaths.has(hiddenTest.targetPath)) {
        errors.push(`${task.id} hidden test target must be unique: ${hiddenTest.targetPath}`);
      }
      hiddenTargetPaths.add(hiddenTest.targetPath);

      if (workspaceReference) {
        await validateHiddenTarget({
          taskId: task.id,
          targetPath: hiddenTest.targetPath,
          workspacePath: workspaceReference.realPath,
        }, errors);
      }
    }

  }

  for (const hiddenSource of hiddenSources) {
    for (const prompt of prompts) {
      if (!isSameFile(prompt.reference, hiddenSource.reference)) {
        continue;
      }

      if (prompt.taskId === hiddenSource.taskId) {
        errors.push(
          `${hiddenSource.taskId} hidden test must not also be promptPath: ${hiddenSource.path}`
        );
      } else {
        errors.push(
          `${prompt.taskId} promptPath must not expose ${hiddenSource.taskId} hidden test: ` +
          hiddenSource.path
        );
      }
    }

    for (const workspace of workspaces) {
      const hiddenInsideWorkspace = isWithin(
        workspace.reference.realPath,
        hiddenSource.reference.realPath
      );
      const hiddenLinkedFromWorkspace = workspace.files.some(file =>
        isSameFile(file, hiddenSource.reference)
      );

      if (!hiddenInsideWorkspace && !hiddenLinkedFromWorkspace) {
        continue;
      }

      if (workspace.taskId === hiddenSource.taskId) {
        errors.push(
          `${hiddenSource.taskId} hidden test must be outside workspacePath: ${hiddenSource.path}`
        );
      } else {
        errors.push(
          `${workspace.taskId} workspacePath must not expose ${hiddenSource.taskId} hidden test: ` +
          hiddenSource.path
        );
      }
    }
  }

  if (errors.length) {
    throw new AgentBenchmarkTaskContractError(errors);
  }

  return tasks;
}
