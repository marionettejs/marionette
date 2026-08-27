import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import { rollup } from 'rollup';

const compress = promisify(brotliCompress);

function getArgument(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function formatBytes(bytes) {
  if (bytes == null) {
    return 'Missing';
  }
  if (Math.abs(bytes) < 1000) {
    return `${bytes} B`;
  }

  return `${(bytes / 1000).toFixed(2)} kB`;
}

function formatChange(base, current) {
  if (base == null || current == null) {
    return 'Not comparable';
  }
  const delta = current - base;
  const prefix = delta > 0 ? '+' : '';
  const percent = base === 0 ? 100 : (delta / base) * 100;
  const indicator = delta > 0 ? ' 🔺' : delta < 0 ? ' 🔽' : '';

  return `${prefix}${formatBytes(delta)} (${prefix}${percent.toFixed(2)}%)${indicator}`;
}

function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(file), 'utf8'));
}

export function runtimePath(path) {
  return typeof path === 'string' && /^(?:\.\/)?dist\/.+\.(?:c|m)?js$/.test(path);
}

export function collectRuntimePaths(value, paths = new Set()) {
  if (runtimePath(value)) {
    paths.add(normalizePath(value));
    return paths;
  }

  if (!value || typeof value !== 'object') {
    return paths;
  }

  for (const nested of Object.values(value)) {
    collectRuntimePaths(nested, paths);
  }

  return paths;
}

export function runtimeSubpaths(packageJson) {
  return Object.entries(packageJson.exports || {})
    .filter(([, value]) => collectRuntimePaths(value).size)
    .map(([subpath]) => subpath)
    .sort();
}

export async function listRuntimeFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRuntimeFiles(entryPath, root));
    } else if (/\.(?:c|m)?js$/.test(entry.name)) {
      files.push(normalizePath(relative(root, entryPath)));
    }
  }

  return files.sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter(value => !rightSet.has(value));
}

export function validateContract(contract, packageJson, runtimeFiles) {
  const violations = [];
  if (contract.schemaVersion !== 1) {
    violations.push(`Unsupported performance schemaVersion ${contract.schemaVersion}`);
  }

  const baselineTotal = contract.runtimeArtifacts
    .reduce((total, artifact) => total + artifact.baselineBrotliBytes, 0);
  if (baselineTotal !== contract.baseline.totalBrotliBytes) {
    violations.push(`Artifact baselines total ${baselineTotal}; expected ${contract.baseline.totalBrotliBytes}`);
  }

  const expectedCeiling = Math.floor(
    baselineTotal * (1 + contract.thresholds.cumulativeGrowthPercent / 100)
  );
  if (contract.baseline.absoluteCeilingBytes !== expectedCeiling) {
    violations.push(`Absolute ceiling is ${contract.baseline.absoluteCeilingBytes}; expected ${expectedCeiling}`);
  }

  const declaredPaths = collectRuntimePaths({
    browser: packageJson.browser,
    exports: packageJson.exports,
    main: packageJson.main,
    module: packageJson.module,
  });
  for (const artifact of contract.runtimeArtifacts) {
    if (artifact.additionalShippedArtifact) {
      declaredPaths.add(artifact.path);
    }
  }

  const configuredPaths = contract.runtimeArtifacts.map(({ path }) => path).sort();
  const discoveredPaths = runtimeFiles.map(path => `dist/${path}`).sort();
  const missingConfiguration = difference([...declaredPaths].sort(), configuredPaths);
  const undeclaredConfiguration = difference(configuredPaths, [...declaredPaths].sort());
  const missingRuntimeFiles = difference(configuredPaths, discoveredPaths);
  const untrackedRuntimeFiles = difference(discoveredPaths, configuredPaths);

  if (missingConfiguration.length) {
    violations.push(`Declared runtime artifacts missing from the contract: ${missingConfiguration.join(', ')}`);
  }
  if (undeclaredConfiguration.length) {
    violations.push(`Contract artifacts are not package entrypoints or classified additions: ${undeclaredConfiguration.join(', ')}`);
  }
  if (missingRuntimeFiles.length) {
    violations.push(`Configured runtime artifacts are missing: ${missingRuntimeFiles.join(', ')}`);
  }
  if (untrackedRuntimeFiles.length) {
    violations.push(`Shipped runtime artifacts are untracked: ${untrackedRuntimeFiles.join(', ')}`);
  }

  const configuredSubpaths = contract.productionGraphs.map(({ subpath }) => subpath).sort();
  const exportedSubpaths = runtimeSubpaths(packageJson);
  const missingGraphs = difference(exportedSubpaths, configuredSubpaths);
  const extraGraphs = difference(configuredSubpaths, exportedSubpaths);
  if (missingGraphs.length || extraGraphs.length) {
    violations.push(`Production graph subpaths mismatch exports; missing: ${missingGraphs.join(', ') || 'none'}; extra: ${extraGraphs.join(', ') || 'none'}`);
  }

  return violations;
}

export function validateCumulativeSize(contract, totalSize) {
  if (totalSize <= contract.baseline.absoluteCeilingBytes) {
    return [];
  }

  return [`Cumulative Brotli-${contract.baseline.brotliQuality} size ${totalSize} exceeds the absolute ceiling ${contract.baseline.absoluteCeilingBytes}`];
}

export function findForbiddenModules(modules, contract) {
  return modules.filter(module => {
    return contract.forbiddenProductionModules.includes(module) ||
      contract.forbiddenProductionModulePrefixes.some(prefix => module.startsWith(prefix));
  });
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

export async function validateToolchain(contract, root) {
  const violations = [];
  const profileContract = contract.toolchain.releaseProfile;
  const profilePath = resolve(root, profileContract.path);
  const [profile, packageJson, packageLock, nvmrc, profileRevision] = await Promise.all([
    readJson(profilePath),
    readJson(resolve(root, 'package.json')),
    readJson(resolve(root, 'package-lock.json')),
    readFile(resolve(root, '.nvmrc'), 'utf8'),
    sha256(profilePath),
  ]);
  const canonicalHost = profile.hosts.find(host => host.id === profileContract.canonicalHost.id);
  const expectedPackageManager = `npm@${profileContract.npm}`;

  if (profileRevision !== profileContract.sha256) {
    violations.push(`Release profile SHA-256 ${profileRevision} does not match ${profileContract.sha256}`);
  }
  if (nvmrc.trim() !== profileContract.node || profile.source.node !== profileContract.node) {
    violations.push(`Node profile must be ${profileContract.node}`);
  }
  if (packageJson.packageManager !== expectedPackageManager || profile.source.npm !== profileContract.npm) {
    violations.push(`npm profile must be ${expectedPackageManager}`);
  }
  if (packageLock.lockfileVersion !== profileContract.lockfileVersion ||
      profile.source.lockfileVersion !== profileContract.lockfileVersion) {
    violations.push(`Lockfile version must be ${profileContract.lockfileVersion}`);
  }
  if (!canonicalHost || canonicalHost.runner !== profileContract.canonicalHost.runner ||
      canonicalHost.platform !== profileContract.canonicalHost.platform ||
      canonicalHost.architecture !== profileContract.canonicalHost.architecture) {
    violations.push(`Canonical performance host must be ${profileContract.canonicalHost.runner} ${profileContract.canonicalHost.platform}-${profileContract.canonicalHost.architecture}`);
  }

  for (const [dependency, expectedVersion] of Object.entries(contract.toolchain.lockedDependencies)) {
    const actualVersion = packageLock.packages[`node_modules/${dependency}`]?.version;
    if (actualVersion !== expectedVersion) {
      violations.push(`Locked ${dependency} version ${actualVersion || 'missing'} does not match ${expectedVersion}`);
    }
  }

  return violations;
}

function findRollupConfiguration(configurations, graph) {
  const configuration = configurations.find(candidate => candidate.input === graph.input);
  if (!configuration) {
    throw new Error(`No Rollup input found for ${graph.input}`);
  }

  const outputs = Array.isArray(configuration.output) ? configuration.output : [configuration.output];
  const output = outputs.find(candidate => normalizePath(candidate.file) === graph.output);
  if (!output) {
    throw new Error(`No Rollup output found for ${graph.output}`);
  }

  return { configuration, output };
}

export function resolveRollupInput(root, input) {
  if (typeof input === 'string') {
    return resolve(root, input);
  }
  if (Array.isArray(input)) {
    return input.map(entry => resolve(root, entry));
  }

  return Object.fromEntries(
    Object.entries(input).map(([name, entry]) => [name, resolve(root, entry)])
  );
}

async function measureGraph(root, configurations, graph, contract) {
  const { configuration, output } = findRollupConfiguration(configurations, graph);
  const bundle = await rollup({
    ...configuration,
    input: resolveRollupInput(root, configuration.input),
  });

  try {
    const generated = await bundle.generate(output);
    const chunks = generated.output.filter(item => item.type === 'chunk');
    const modules = [...new Set(chunks.flatMap(chunk => Object.keys(chunk.modules)))]
      .map(moduleId => normalizePath(relative(root, moduleId)))
      .sort();
    const externalImports = [...new Set(chunks.flatMap(chunk => chunk.imports))].sort();

    return {
      subpath: graph.subpath,
      input: graph.input,
      output: graph.output,
      status: 'measured',
      modules,
      externalImports,
      phase0AddedModules: difference(modules, graph.baselineModules),
      phase0RemovedModules: difference(graph.baselineModules, modules),
      phase0AddedExternalImports: difference(externalImports, graph.baselineExternalImports),
      phase0RemovedExternalImports: difference(graph.baselineExternalImports, externalImports),
      forbiddenModules: findForbiddenModules(modules, contract),
    };
  } finally {
    await bundle.close();
  }
}

async function measureArtifact(root, quality, artifact) {
  try {
    const contents = await readFile(resolve(root, artifact.path));
    const compressed = await compress(contents, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: quality
      }
    });

    return {
      name: artifact.name,
      path: artifact.path,
      status: artifact.untracked ? 'untracked' : 'measured',
      size: compressed.length,
      baselineSize: artifact.baselineBrotliBytes ?? null,
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return {
      name: artifact.name,
      path: artifact.path,
      status: 'missing',
      size: null,
      baselineSize: artifact.baselineBrotliBytes ?? null,
    };
  }
}

export async function measure({ root = '.', configPath = 'config/performance.json', checkToolchain = true } = {}) {
  const resolvedRoot = resolve(root);
  const resolvedConfigPath = resolve(configPath);
  const contract = await readJson(resolvedConfigPath);
  const packageJson = await readJson(resolve(resolvedRoot, 'package.json'));
  const runtimeFiles = await listRuntimeFiles(resolve(resolvedRoot, 'dist')).catch(error => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return [];
  });
  const violations = validateContract(contract, packageJson, runtimeFiles);
  if (checkToolchain) {
    violations.push(...await validateToolchain(contract, resolvedRoot));
  }
  const quality = contract.baseline.brotliQuality;
  const configuredPaths = new Set(contract.runtimeArtifacts.map(artifact => artifact.path));
  const untrackedArtifacts = runtimeFiles
    .map(path => `dist/${path}`)
    .filter(path => !configuredPaths.has(path))
    .map(path => ({ name: `Untracked ${path}`, path, untracked: true }));
  const artifactConfigurations = [...contract.runtimeArtifacts, ...untrackedArtifacts];
  const artifacts = await Promise.all(artifactConfigurations.map(artifact => {
    return measureArtifact(resolvedRoot, quality, artifact);
  }));
  const totalSize = artifacts.reduce((total, artifact) => total + (artifact.size || 0), 0);
  violations.push(...validateCumulativeSize(contract, totalSize));

  let configurations;
  try {
    const configUrl = pathToFileURL(resolve(resolvedRoot, 'rollup.config.mjs'));
    ({ default: configurations } = await import(configUrl.href));
  } catch (error) {
    violations.push(`Unable to load production Rollup configuration: ${error.message}`);
    configurations = [];
  }

  const graphs = [];
  for (const graph of contract.productionGraphs) {
    try {
      const result = await measureGraph(resolvedRoot, configurations, graph, contract);
      graphs.push(result);
      if (result.forbiddenModules.length) {
        violations.push(`${graph.subpath} includes forbidden production modules: ${result.forbiddenModules.join(', ')}`);
      }
    } catch (error) {
      graphs.push({
        subpath: graph.subpath,
        input: graph.input,
        output: graph.output,
        status: 'measurement-error',
        modules: [],
        externalImports: [],
        forbiddenModules: [],
        error: error.message,
      });
      violations.push(`Unable to measure production graph ${graph.subpath}: ${error.message}`);
    }
  }

  const configuredSubpaths = new Set(contract.productionGraphs.map(graph => graph.subpath));
  for (const subpath of runtimeSubpaths(packageJson)) {
    if (!configuredSubpaths.has(subpath)) {
      graphs.push({
        subpath,
        status: 'unconfigured',
        modules: [],
        externalImports: [],
        forbiddenModules: [],
        error: 'New exported runtime subpath is not defined by the authority contract',
      });
    }
  }

  return {
    schemaVersion: 1,
    contractPath: normalizePath(relative(resolvedRoot, resolvedConfigPath)),
    baselineSourceCommit: contract.baseline.sourceCommit,
    brotliQuality: quality,
    thresholds: contract.thresholds,
    artifacts,
    cumulative: {
      size: totalSize,
      baselineSize: contract.baseline.totalBrotliBytes,
      absoluteCeiling: contract.baseline.absoluteCeilingBytes,
    },
    graphs,
    violations,
  };
}

function graphChange(baseGraph, currentGraph) {
  if (currentGraph.status !== 'measured') {
    return currentGraph.error;
  }
  if (baseGraph.status !== 'measured') {
    return 'Base graph was not measurable';
  }
  const added = difference(currentGraph.modules, baseGraph.modules);
  const removed = difference(baseGraph.modules, currentGraph.modules);
  const externalAdded = difference(currentGraph.externalImports, baseGraph.externalImports);
  const externalRemoved = difference(baseGraph.externalImports, currentGraph.externalImports);
  const changes = [];
  if (added.length) { changes.push(`+${added.join(', +')}`); }
  if (removed.length) { changes.push(`-${removed.join(', -')}`); }
  if (externalAdded.length) { changes.push(`external +${externalAdded.join(', +')}`); }
  if (externalRemoved.length) { changes.push(`external -${externalRemoved.join(', -')}`); }
  return changes.join('; ') || 'No change';
}

export async function createReport(baseFile, currentFile) {
  const base = await readJson(baseFile);
  const current = await readJson(currentFile);
  const baseByPath = new Map(base.artifacts.map(result => [result.path, result]));
  const approvalThreshold = current.thresholds.pullRequestApprovalPercent;
  const rows = current.artifacts.map(result => {
    const baseResult = baseByPath.get(result.path);
    if (!baseResult) {
      return `| ${result.name} | New | ${formatBytes(result.size)} | New artifact | Required by PR B |`;
    }
    if (result.size == null || baseResult.size == null) {
      return `| ${result.name} | ${formatBytes(baseResult.size)} | ${formatBytes(result.size)} | Not comparable | Review required |`;
    }

    const percent = baseResult.size === 0 ? 100 : (result.size - baseResult.size) / baseResult.size * 100;
    const approval = percent > approvalThreshold ? 'Required by PR B' : 'No';
    return `| ${result.name} | ${formatBytes(baseResult.size)} | ${formatBytes(result.size)} | ${formatChange(baseResult.size, result.size)} | ${approval} |`;
  });
  const baseGraphs = new Map(base.graphs.map(graph => [graph.subpath, graph]));
  const graphRows = current.graphs.map(graph => {
    const baseGraph = baseGraphs.get(graph.subpath);
    const change = baseGraph ? graphChange(baseGraph, graph) : graph.error || 'New production subpath';
    const moduleCount = graph.status === 'measured' ? graph.modules.length : 'Unmeasured';
    return `| \`${graph.subpath}\` | ${moduleCount} | ${graph.externalImports.join(', ') || 'None'} | ${change} |`;
  });
  const cumulativeGrowth = formatChange(base.cumulative.size, current.cumulative.size);
  const phase0Growth = formatChange(current.cumulative.baselineSize, current.cumulative.size);

  return [
    '<!-- bundle-size-report -->',
    '## Production performance contract 📦',
    '',
    '| Runtime artifact | Base | PR | Change | >1% approval |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows,
    '',
    `Cumulative Brotli-${current.brotliQuality}: **${formatBytes(current.cumulative.size)}** / ${formatBytes(current.cumulative.absoluteCeiling)} authority-contract ceiling (${cumulativeGrowth} from PR base; ${phase0Growth} from Phase 0).`,
    '',
    '| Production subpath | Internal modules | External imports | PR graph change |',
    '| --- | ---: | --- | --- |',
    ...graphRows,
    '',
    current.violations.length ?
      `Contract violations: ${current.violations.join('; ')}` :
      'All deterministic size and production-graph checks passed against the base authority contract.',
    '',
    'The exact-head approval protocol for growth above 1% and new subpaths is intentionally deferred to #127 PR B; this report does not treat that threshold as an enforceable approval yet.'
  ].join('\n');
}

function writeMeasurement(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const artifact of result.artifacts) {
    console.log(`${artifact.name}: ${formatBytes(artifact.size)} (${formatChange(artifact.baselineSize, artifact.size)} from Phase 0)`);
  }
  console.log(`Cumulative: ${formatBytes(result.cumulative.size)} / ${formatBytes(result.cumulative.absoluteCeiling)}`);
  for (const graph of result.graphs) {
    console.log(`${graph.subpath}: ${graph.status === 'measured' ? `${graph.modules.length} internal modules, ${graph.externalImports.length} external imports` : graph.error}`);
  }
}

export async function main(args = process.argv.slice(2)) {
  const reportIndex = args.indexOf('--report');
  if (reportIndex !== -1) {
    console.log(await createReport(args[reportIndex + 1], args[reportIndex + 2]));
    return;
  }

  const result = await measure({
    root: getArgument(args, '--root', '.'),
    configPath: getArgument(args, '--config', 'config/performance.json'),
    checkToolchain: !args.includes('--artifact-graph-only'),
  });
  writeMeasurement(result, args.includes('--json'));
  if (!args.includes('--no-enforce') && result.violations.length) {
    for (const violation of result.violations) {
      console.error(`Performance contract violation: ${violation}`);
    }
    process.exitCode = 1;
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryUrl === import.meta.url) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
