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

  if (capabilityIds.some(id => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || ''))) {
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

  return realPath;
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

async function addWorkspaceSymlinkErrors(taskId, workspacePath, errors, directory = workspacePath) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);

    if (entry.isSymbolicLink()) {
      errors.push(`${taskId} workspacePath must not contain symlinks: ${relative(workspacePath, entryPath)}`);
    } else if (entry.isDirectory()) {
      await addWorkspaceSymlinkErrors(taskId, workspacePath, errors, entryPath);
    }
  }
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

    const promptPath = await validateReferencedPath({
      expectedType: 'file',
      label: `${task.id} promptPath`,
      path: task.promptPath,
      root: absoluteRoot,
      realRoot,
    }, errors);
    const workspacePath = await validateReferencedPath({
      expectedType: 'directory',
      label: `${task.id} workspacePath`,
      path: task.workspacePath,
      rejectSymlink: true,
      root: absoluteRoot,
      realRoot,
    }, errors);

    if (workspacePath) {
      await addWorkspaceSymlinkErrors(task.id, workspacePath, errors);
    }

    const hiddenTargetPaths = new Set();

    for (const hiddenTest of task.acceptance.hiddenTests) {
      const hiddenTestPath = hiddenTest.sourcePath;
      const resolvedTestPath = await validateReferencedPath({
        expectedType: 'file',
        label: `${task.id} hidden test`,
        path: hiddenTestPath,
        root: absoluteRoot,
        realRoot,
      }, errors);

      if (workspacePath && resolvedTestPath && isWithin(workspacePath, resolvedTestPath)) {
        errors.push(`${task.id} hidden test must be outside workspacePath: ${hiddenTestPath}`);
      }

      if (promptPath && resolvedTestPath === promptPath) {
        errors.push(`${task.id} hidden test must not also be promptPath: ${hiddenTestPath}`);
      }

      if (hiddenTargetPaths.has(hiddenTest.targetPath)) {
        errors.push(`${task.id} hidden test target must be unique: ${hiddenTest.targetPath}`);
      }
      hiddenTargetPaths.add(hiddenTest.targetPath);

      if (workspacePath) {
        await validateHiddenTarget({
          taskId: task.id,
          targetPath: hiddenTest.targetPath,
          workspacePath,
        }, errors);
      }
    }

  }

  if (errors.length) {
    throw new AgentBenchmarkTaskContractError(errors);
  }

  return tasks;
}
