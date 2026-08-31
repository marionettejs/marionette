import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import terser from '@rollup/plugin-terser';
import { rollup } from 'rollup';
import {
  canonicalForbiddenExternalImports,
  newProductionReportDelta,
  validateGrowthApprovalPolicy,
} from './growth-approval.mjs';
import {
  compareResources,
  measureResources,
  resourceReportRows,
  validateCandidateResourceContract,
} from './resources.mjs';
import {
  parseBudgetAmendmentLedger,
  validateBudgetAmendmentLedger,
} from './budget-amendments.mjs';

const compress = promisify(brotliCompress);
const consumerScenarioIds = [
  'root-only',
  'backbone-only',
  'jquery-dom-api-only',
  'root-plus-backbone',
  'root-plus-jquery',
];
const consumerFormatIds = ['esm', 'cjs', 'umd'];
const consumerCompression = { algorithm: 'brotli', quality: 11 };
const consumerPeerExternalImports = ['backbone', 'jquery'];
const consumerBundleContractPath = 'benchmarks/consumer-bundles/contract.json';
const consumerToolchain = {
  rollup: '4.63.0',
  rollupPluginTerser: '1.0.0',
  terser: '5.48.0',
};

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

export function validateContract(contract, packageJson, runtimeFiles, budgetAmendments = null) {
  const violations = [];
  if (contract.schemaVersion !== 1) {
    violations.push(`Unsupported performance schemaVersion ${contract.schemaVersion}`);
  }
  violations.push(...validateGrowthApprovalPolicy(contract.pullRequestGrowthApproval)
    .map(({ message }) => message));
  if (Object.hasOwn(contract, 'forbiddenExternalImports') &&
      !canonicalForbiddenExternalImports(contract.forbiddenExternalImports)) {
    violations.push('forbiddenExternalImports must be a sorted, unique array of non-empty strings');
  }

  const baselineTotal = contract.runtimeArtifacts
    .reduce((total, artifact) => total + artifact.baselineBrotliBytes, 0);
  if (baselineTotal !== contract.baseline.totalBrotliBytes) {
    violations.push(`Artifact baselines total ${baselineTotal}; expected ${contract.baseline.totalBrotliBytes}`);
  }

  if (budgetAmendments) {
    violations.push(...validateBudgetAmendmentLedger(budgetAmendments, contract));
  } else {
    const expectedCeiling = Math.floor(
      baselineTotal * (1 + contract.thresholds.cumulativeGrowthPercent / 100)
    );
    if (contract.baseline.absoluteCeilingBytes !== expectedCeiling) {
      violations.push(`Absolute ceiling is ${contract.baseline.absoluteCeilingBytes}; expected ${expectedCeiling}`);
    }
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
  for (const graph of contract.productionGraphs) {
    const exportedPaths = collectRuntimePaths(packageJson.exports?.[graph.subpath]);
    if (!exportedPaths.has(graph.output)) {
      violations.push(
        `Production graph ${graph.subpath} output ${graph.output} is not exported by that subpath`
      );
    }
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

export function findForbiddenExternalImports(externalImports, contract) {
  const forbiddenExternalImports = Array.isArray(contract.forbiddenExternalImports) ?
    contract.forbiddenExternalImports : [];
  return externalImports.filter(externalImport => {
    return forbiddenExternalImports.some(forbiddenImport => {
      return externalImport === forbiddenImport || externalImport.startsWith(`${forbiddenImport}/`);
    });
  });
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sameStringInventory(actual, expected) {
  return Array.isArray(actual) && isDeepStrictEqual(actual, expected);
}

export function validateConsumerBundleContract(contract, fixture, packageJson, brotliQuality) {
  const violations = [];
  if (!contract || !sameStringInventory(Object.keys(contract).sort(), [
    'fixture',
    'peerExternalImports',
    'schemaVersion',
    'status',
    'toolchain',
  ]) || contract.schemaVersion !== 1) {
    return ['consumerBundles must use schemaVersion 1'];
  }
  if (!sameStringInventory(Object.keys(contract.fixture || {}).sort(), [
    'path',
    'sha256',
    'version',
  ]) || contract.fixture.version !== 'v1' ||
      contract.fixture.path !== 'benchmarks/consumer-bundles/v1/manifest.json' ||
      typeof contract.fixture.sha256 !== 'string' ||
      !/^[a-f\d]{64}$/.test(contract.fixture.sha256)) {
    violations.push('consumerBundles fixture authority is malformed');
  }
  if (contract.status !== 'reporting') {
    violations.push('consumerBundles status must remain reporting until baselines and ceilings are adopted');
  }
  if (fixture?.schemaVersion !== 1 || fixture?.fixtureVersion !== contract.fixture?.version) {
    violations.push('Consumer bundle fixture metadata does not match the performance contract');
  }
  const expectedCompression = { algorithm: 'brotli', quality: brotliQuality };
  if (!isDeepStrictEqual(fixture?.compression, expectedCompression)) {
    violations.push(`Consumer bundle compression must be Brotli quality ${brotliQuality}`);
  }
  const scenarioIds = fixture?.scenarios?.map(({ id }) => id);
  if (!sameStringInventory(scenarioIds, consumerScenarioIds)) {
    violations.push(`Consumer bundle scenario inventory must be ${consumerScenarioIds.join(', ')}`);
  }
  const formatIds = fixture?.formats?.map(({ id }) => id);
  if (!sameStringInventory(formatIds, consumerFormatIds)) {
    violations.push(`Consumer bundle format inventory must be ${consumerFormatIds.join(', ')}`);
  }
  const expectedArtifacts = consumerScenarioIds.flatMap(scenario =>
    consumerFormatIds.map(format => `${scenario}:${format}`));
  if (!sameStringInventory(fixture?.expectedArtifacts, expectedArtifacts)) {
    violations.push(`Consumer bundle expected artifact set must be ${expectedArtifacts.join(', ')}`);
  }
  if (fixture?.packageName !== packageJson.name) {
    violations.push(`Consumer bundle fixture package ${fixture?.packageName || 'missing'} does not match ${packageJson.name}`);
  }

  const runtimePeers = Object.keys(packageJson.peerDependencies || {})
    .filter(peer => !peer.startsWith('@types/'))
    .sort();
  if (!sameStringInventory(contract.peerExternalImports, runtimePeers)) {
    violations.push(`Consumer bundle peer externals must be ${runtimePeers.join(', ')}`);
  }
  if (!isDeepStrictEqual(contract.toolchain, consumerToolchain)) {
    violations.push('Consumer bundle toolchain metadata is not canonical');
  }
  const pinnedTools = {
    rollup: packageJson.devDependencies?.rollup,
    rollupPluginTerser: packageJson.devDependencies?.['@rollup/plugin-terser'],
    terser: packageJson.devDependencies?.terser,
  };
  for (const [tool, expectedVersion] of Object.entries(pinnedTools)) {
    if (contract.toolchain?.[tool] !== expectedVersion) {
      violations.push(`Locked ${tool} version ${contract.toolchain?.[tool] || 'missing'} does not match ${expectedVersion || 'missing'}`);
    }
  }

  const exportedImports = new Set(Object.keys(packageJson.exports || {}).map(subpath => {
    return subpath === '.' ? packageJson.name : `${packageJson.name}/${subpath.slice(2)}`;
  }));
  for (const scenario of fixture?.scenarios || []) {
    if (!Array.isArray(scenario.publicImports) || !scenario.publicImports.length ||
        scenario.publicImports.some(publicImport => !exportedImports.has(publicImport))) {
      violations.push(`Consumer bundle scenario ${scenario.id || 'missing'} has invalid publicImports`);
    }
    if (!Array.isArray(scenario.exercisedExports) || !scenario.exercisedExports.length) {
      violations.push(`Consumer bundle scenario ${scenario.id || 'missing'} must name exercisedExports`);
    }
    if (typeof scenario.entry !== 'string' ||
        typeof scenario.entrySha256 !== 'string' ||
        !/^[a-f\d]{64}$/.test(scenario.entrySha256)) {
      violations.push(`Consumer bundle scenario ${scenario.id || 'missing'} has invalid entry metadata`);
    }
    if (!Array.isArray(scenario.expectedModules) || !Array.isArray(scenario.expectedExternalImports)) {
      violations.push(`Consumer bundle scenario ${scenario.id || 'missing'} is missing expected graph metadata`);
    }
  }
  const rootScenario = fixture?.scenarios?.find(({ id }) => id === 'root-only');
  if (rootScenario && (!sameStringInventory(rootScenario.publicImports, [packageJson.name]) ||
      !sameStringInventory(rootScenario.expectedModules, [
        'benchmarks/consumer-bundles/v1/root-only.js',
        'dist/marionette.js',
      ]) ||
      !sameStringInventory(rootScenario.expectedExternalImports, []))) {
    violations.push('Consumer bundle root-only scenario must remain isolated from opt-in subpaths and peers');
  }

  return violations;
}

function consumerPackageResolver(root, packageJson, peerExternalImports) {
  const packageName = packageJson.name;
  const importPaths = new Map(Object.entries(packageJson.exports || {}).map(([subpath, value]) => {
    const publicImport = subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`;
    const paths = collectRuntimePaths(value);
    const esmPath = [...paths].find(path => path.endsWith('.js') && !path.endsWith('.umd.js'));
    return [publicImport, esmPath ? resolve(root, esmPath) : null];
  }));

  return {
    name: 'consumer-package-resolver',
    resolveId(source) {
      if (peerExternalImports.some(peer => source === peer || source.startsWith(`${peer}/`))) {
        return { id: source, external: true };
      }
      if (importPaths.has(source)) {
        const resolved = importPaths.get(source);
        if (!resolved) {
          throw new Error(`No ES module runtime path exists for ${source}`);
        }
        return resolved;
      }
      return null;
    },
  };
}

function consumerGraphViolations(scenario, modules, externalImports, peerExternalImports) {
  const violations = [];
  if (!sameStringInventory(modules, scenario.expectedModules)) {
    violations.push(`${scenario.id} modules differ from fixture metadata; expected ${scenario.expectedModules.join(', ') || 'none'}; measured ${modules.join(', ') || 'none'}`);
  }
  if (!sameStringInventory(externalImports, scenario.expectedExternalImports)) {
    violations.push(`${scenario.id} external imports differ from fixture metadata; expected ${scenario.expectedExternalImports.join(', ') || 'none'}; measured ${externalImports.join(', ') || 'none'}`);
  }
  const undeclaredExternals = externalImports.filter(externalImport =>
    !peerExternalImports.some(peer => externalImport === peer || externalImport.startsWith(`${peer}/`)));
  if (undeclaredExternals.length) {
    violations.push(`${scenario.id} contains non-peer external imports: ${undeclaredExternals.join(', ')}`);
  }
  if (scenario.id === 'root-only' && (externalImports.length !== 0 ||
      modules.some(module => module === 'dist/backbone.js' || module === 'dist/jquery-dom-api.js'))) {
    violations.push('root-only consumer bundle is not isolated from opt-in subpaths and peers');
  }
  return violations;
}

export async function measureConsumerBundles({ root = '.', contract, brotliQuality } = {}) {
  const resolvedRoot = resolve(root);
  const fixturePath = resolve(resolvedRoot, contract.fixture.path);
  const [fixtureText, packageJson] = await Promise.all([
    readFile(fixturePath, 'utf8'),
    readJson(resolve(resolvedRoot, 'package.json')),
  ]);
  const fixture = JSON.parse(fixtureText);
  const violations = validateConsumerBundleContract(
    contract,
    fixture,
    packageJson,
    brotliQuality
  );
  const actualFixtureRevision = sha256Text(fixtureText);
  if (actualFixtureRevision !== contract.fixture.sha256) {
    violations.push(`Consumer bundle fixture SHA-256 ${actualFixtureRevision} does not match ${contract.fixture.sha256}`);
  }
  const fixtureRoot = dirname(fixturePath);
  const artifacts = [];

  for (const scenario of fixture.scenarios || []) {
    let bundle;
    try {
      const entryPath = resolve(fixtureRoot, scenario.entry);
      const entryRevision = await sha256(entryPath);
      if (entryRevision !== scenario.entrySha256) {
        violations.push(`${scenario.id} entry SHA-256 ${entryRevision} does not match ${scenario.entrySha256}`);
        continue;
      }
      bundle = await rollup({
        input: entryPath,
        plugins: [
          consumerPackageResolver(resolvedRoot, packageJson, contract.peerExternalImports),
          terser(fixture.minify),
        ],
        treeshake: fixture.treeshake,
      });
      for (const format of fixture.formats || []) {
        const generated = await bundle.generate({
          format: format.rollupFormat,
          exports: 'named',
          name: format.rollupFormat === 'umd' ? 'MarionetteConsumerBundle' : undefined,
          globals: {
            backbone: 'Backbone',
            jquery: 'jQuery',
          },
        });
        const chunks = generated.output.filter(item => item.type === 'chunk');
        const code = chunks.map(chunk => chunk.code).join('\n');
        const modules = [...new Set(chunks.flatMap(chunk => Object.keys(chunk.modules)))]
          .map(moduleId => normalizePath(relative(resolvedRoot, moduleId)))
          .sort();
        const externalImports = [...new Set(chunks.flatMap(chunk => [
          ...chunk.imports,
          ...chunk.dynamicImports,
        ]))].sort();
        const compressed = await compress(code, {
          params: { [constants.BROTLI_PARAM_QUALITY]: fixture.compression.quality },
        });
        artifacts.push({
          id: `${scenario.id}:${format.id}`,
          scenario: scenario.id,
          format: format.id,
          status: 'measured',
          size: compressed.length,
          modules,
          externalImports,
        });
        violations.push(...consumerGraphViolations(
          scenario,
          modules,
          externalImports,
          contract.peerExternalImports
        ));
      }
    } catch (error) {
      violations.push(`Unable to measure consumer bundle ${scenario.id}: ${error.message}`);
    } finally {
      await bundle?.close();
    }
  }

  const expectedArtifactCount = consumerScenarioIds.length * consumerFormatIds.length;
  if (artifacts.length !== expectedArtifactCount) {
    violations.push(`Consumer bundle artifact inventory measured ${artifacts.length}; expected ${expectedArtifactCount}`);
  }
  const measuredArtifacts = artifacts.map(({ scenario, format }) => `${scenario}:${format}`);
  if (!sameStringInventory(measuredArtifacts, fixture.expectedArtifacts)) {
    violations.push('Consumer bundle measured artifact set differs from fixture metadata');
  }

  return {
    schemaVersion: 1,
    status: contract.status,
    fixtureVersion: fixture.fixtureVersion,
    fixtureRevision: actualFixtureRevision,
    compression: fixture.compression,
    toolchain: contract.toolchain,
    peerExternalImports: contract.peerExternalImports,
    artifacts,
    violations: [...new Set(violations)],
  };
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

function findRollupConfiguration(root, configurations, graph) {
  const matches = [];
  const graphOutput = resolve(root, graph.output);
  for (const configuration of configurations) {
    const outputs = Array.isArray(configuration.output) ?
      configuration.output : [configuration.output];
    for (const output of outputs) {
      if (typeof output?.file === 'string' && resolve(root, output.file) === graphOutput) {
        matches.push({ configuration, output });
      }
    }
  }
  if (!matches.length) {
    throw new Error(`No Rollup output found for ${graph.output}`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple Rollup configurations write ${graph.output}`);
  }

  const [{ configuration, output }] = matches;
  if (typeof configuration.input !== 'string') {
    throw new Error(`Rollup output ${graph.output} must use one string input ${graph.input}`);
  }
  if (resolveRollupInput(root, configuration.input) !== resolveRollupInput(root, graph.input)) {
    throw new Error(`Rollup output ${graph.output} does not use input ${graph.input}`);
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
  const { configuration, output } = findRollupConfiguration(root, configurations, graph);
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
    const policyExternalImports = [...new Set(chunks.flatMap(chunk => {
      return [...chunk.imports, ...chunk.dynamicImports];
    }))].sort();

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
      forbiddenExternalImports: findForbiddenExternalImports(policyExternalImports, contract),
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

export async function measure({
  root = '.',
  configPath = 'config/performance.json',
  budgetAmendmentsPath,
  checkToolchain = true,
} = {}) {
  const resolvedRoot = resolve(root);
  const resolvedConfigPath = resolve(configPath);
  const contract = await readJson(resolvedConfigPath);
  const resolvedBudgetAmendmentsPath = resolve(
    budgetAmendmentsPath || dirname(resolvedConfigPath),
    budgetAmendmentsPath ? '' : 'release/performance-budget-amendments.json'
  );
  let budgetAmendments = null;
  try {
    budgetAmendments = parseBudgetAmendmentLedger(
      await readFile(resolvedBudgetAmendmentsPath, 'utf8')
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  const packageJson = await readJson(resolve(resolvedRoot, 'package.json'));
  const runtimeFiles = await listRuntimeFiles(resolve(resolvedRoot, 'dist')).catch(error => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return [];
  });
  const violations = validateContract(contract, packageJson, runtimeFiles, budgetAmendments);
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
      if (result.forbiddenExternalImports.length) {
        violations.push(`${graph.subpath} includes forbidden external imports: ${result.forbiddenExternalImports.join(', ')}`);
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
        forbiddenExternalImports: [],
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
        forbiddenExternalImports: [],
        error: 'New exported runtime subpath is not defined by the authority contract',
      });
    }
  }

  let consumerBundles = null;
  try {
    const consumerBundleContract = await readJson(
      resolve(resolvedRoot, consumerBundleContractPath)
    );
    consumerBundles = await measureConsumerBundles({
      root: resolvedRoot,
      contract: consumerBundleContract,
      brotliQuality: quality,
    });
    violations.push(...consumerBundles.violations);
  } catch (error) {
    violations.push(`Unable to measure consumer bundles: ${error.message}`);
  }

  let resources = null;
  if (contract.deterministicResources) {
    try {
      resources = await measureResources({
        root: resolvedRoot,
        attachDetachCycles: contract.deterministicResources.attachDetachCycles,
        mountDestroyCycles: contract.deterministicResources.mountDestroyCycles,
      });
    } catch (error) {
      violations.push(`Unable to measure deterministic resources: ${error.message}`);
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
    consumerBundles,
    resourcesRequired: Boolean(contract.deterministicResources),
    resources,
    violations,
  };
}

function consumerArtifactIds() {
  return consumerScenarioIds.flatMap(scenario =>
    consumerFormatIds.map(format => `${scenario}:${format}`));
}

function validateConsumerBundleReport(report, label) {
  const violations = [];
  if (!report || report.schemaVersion !== 1 || report.status !== 'reporting' ||
      typeof report.fixtureVersion !== 'string' || !report.fixtureVersion ||
      typeof report.fixtureRevision !== 'string' ||
      !/^[a-f\d]{64}$/.test(report.fixtureRevision) ||
      !Array.isArray(report.artifacts) || !Array.isArray(report.violations)) {
    return [`${label} consumer bundle report is malformed`];
  }
  if (!isDeepStrictEqual(report.compression, consumerCompression) ||
      !isDeepStrictEqual(report.toolchain, consumerToolchain) ||
      !isDeepStrictEqual(report.peerExternalImports, consumerPeerExternalImports)) {
    violations.push(`${label} consumer bundle metadata is not canonical`);
  }

  const expectedIds = consumerArtifactIds();
  const actualIds = report.artifacts.map(artifact => artifact?.id);
  if (!isDeepStrictEqual(actualIds, expectedIds)) {
    violations.push(`${label} consumer bundle artifact inventory is not canonical`);
  }
  for (const artifact of report.artifacts) {
    const expectedId = `${artifact?.scenario}:${artifact?.format}`;
    if (artifact?.id !== expectedId || artifact?.status !== 'measured' ||
        !Number.isSafeInteger(artifact?.size) || artifact.size <= 0) {
      violations.push(`${label} consumer bundle artifact ${artifact?.id || 'missing'} is malformed`);
    }
  }
  return violations;
}

export function compareConsumerBundleReports(base, current) {
  if (!base && !current) {
    return { bootstrap: false, rows: [], violations: [], unavailable: true };
  }
  if (!current) {
    return {
      bootstrap: false,
      rows: [],
      violations: ['Pull request consumer bundle measurement is missing'],
    };
  }
  const currentReportViolations = validateConsumerBundleReport(current, 'Pull request');
  if (currentReportViolations.some(violation => violation.endsWith('report is malformed'))) {
    return {
      bootstrap: !base,
      rows: [],
      violations: currentReportViolations,
    };
  }
  if (!base) {
    return {
      bootstrap: true,
      rows: current.artifacts.map(artifact => ({
        scenario: artifact.scenario,
        format: artifact.format,
        id: artifact.id,
        baseSize: null,
        currentSize: artifact.size,
        deltaBytes: null,
      })),
      violations: [...currentReportViolations, ...current.violations],
    };
  }
  const baseReportViolations = validateConsumerBundleReport(base, 'Exact base');
  if (baseReportViolations.some(violation => violation.endsWith('report is malformed'))) {
    return {
      bootstrap: false,
      rows: [],
      violations: baseReportViolations,
    };
  }
  if (base.fixtureVersion !== current.fixtureVersion ||
      base.fixtureRevision !== current.fixtureRevision ||
      !isDeepStrictEqual(base.compression, current.compression) ||
      !isDeepStrictEqual(base.toolchain, current.toolchain) ||
      !isDeepStrictEqual(base.peerExternalImports, current.peerExternalImports)) {
    return {
      bootstrap: false,
      rows: [],
      violations: [
        ...baseReportViolations,
        ...currentReportViolations,
        'Consumer bundle metadata differs from the exact base',
      ],
    };
  }
  const baseByKey = new Map(base.artifacts.map(artifact => [
    artifact.id,
    artifact,
  ]));
  const rows = current.artifacts.map(artifact => {
    const baseArtifact = baseByKey.get(artifact.id);
    return {
      id: artifact.id,
      scenario: artifact.scenario,
      format: artifact.format,
      baseSize: baseArtifact?.size ?? null,
      currentSize: artifact.size,
      deltaBytes: baseArtifact ? artifact.size - baseArtifact.size : null,
    };
  });
  const currentKeys = new Set(current.artifacts.map(artifact => artifact.id));
  const missing = base.artifacts.filter(artifact =>
    !currentKeys.has(artifact.id));
  const added = rows.filter(row => row.baseSize == null);
  const violations = [
    ...baseReportViolations,
    ...currentReportViolations,
    ...base.violations,
    ...current.violations,
  ];
  if (missing.length || added.length) {
    violations.push('Consumer bundle report inventory differs from the exact base');
  }
  return { bootstrap: false, rows, violations };
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

function compareResourceReports(base, current) {
  if (!base.resources && !current.resources) {
    if (base.resourcesRequired || current.resourcesRequired) {
      return {
        changes: [],
        violations: ['Required resource measurements are missing from both reports'],
      };
    }
    return { changes: [], violations: [], unavailable: true };
  }
  if (!base.resources) {
    return {
      changes: [],
      violations: ['Exact base resource measurement is missing'],
    };
  }
  if (!current.resources) {
    return {
      changes: [],
      violations: ['Pull request resource measurement is missing'],
    };
  }

  return compareResources(base.resources, current.resources);
}

function approvalRequirement(baseResult, currentResult, thresholdPercent) {
  if (!baseResult || baseResult.size == null || currentResult.size == null) {
    return null;
  }

  const deltaBytes = currentResult.size - baseResult.size;
  if (deltaBytes <= 0 ||
      (baseResult.size > 0 && deltaBytes * 100 <= baseResult.size * thresholdPercent)) {
    return null;
  }

  return {
    path: currentResult.path,
    baseBytes: baseResult.size,
    currentBytes: currentResult.size,
    deltaBytes,
    growthBasisPoints: baseResult.size === 0 ? null :
      Math.round(deltaBytes * 10000 / baseResult.size),
  };
}

function sameApprovalRequirements(supplied, expected) {
  if (!Array.isArray(supplied) || supplied.length !== expected.length) {
    return false;
  }

  const normalized = supplied.map(requirement => ({
    path: requirement?.path,
    baseBytes: requirement?.baseBytes,
    currentBytes: requirement?.currentBytes,
    deltaBytes: requirement?.deltaBytes,
    growthBasisPoints: requirement?.growthBasisPoints,
  })).sort((left, right) => String(left.path).localeCompare(String(right.path)));

  return normalized.every((requirement, index) => {
    const expectedRequirement = expected[index];
    return requirement.path === expectedRequirement.path &&
      requirement.baseBytes === expectedRequirement.baseBytes &&
      requirement.currentBytes === expectedRequirement.currentBytes &&
      requirement.deltaBytes === expectedRequirement.deltaBytes &&
      requirement.growthBasisPoints === expectedRequirement.growthBasisPoints;
  });
}

function sameNewArtifacts(supplied, expected) {
  if (!Array.isArray(supplied) || supplied.length !== expected.length) {
    return false;
  }

  const normalized = supplied.map(artifact => ({
    path: artifact?.path,
    size: artifact?.size,
  })).sort((left, right) => String(left.path) < String(right.path) ? -1 :
    String(left.path) > String(right.path) ? 1 : 0);
  return normalized.every((artifact, index) => {
    return artifact.path === expected[index].path && artifact.size === expected[index].size;
  });
}

function growthApprovalReport(base, current, supplied) {
  const thresholdPercent = current.thresholds.pullRequestApprovalPercent;
  const consumingBudget = supplied?.budgetAmendment?.status === 'accepted' &&
    supplied.budgetAmendment.mode === 'consume';
  const approvalThresholdPercent = consumingBudget ? 0 : thresholdPercent;
  const baseByPath = new Map(base.artifacts.map(result => [result.path, result]));
  const required = current.artifacts
    .map(result => approvalRequirement(
      baseByPath.get(result.path),
      result,
      approvalThresholdPercent
    ))
    .filter(Boolean)
    .sort((left, right) => left.path.localeCompare(right.path));
  const newProduction = newProductionReportDelta(base, current);
  const newProductionPresent = newProduction.artifacts.length || newProduction.subpaths.length;
  const newProductionEnforced = supplied?.newProductionEnforced === true;
  const approvalRequired = required.length || newProductionPresent;
  const violations = [];

  if (!supplied) {
    const status = approvalRequired ? 'required' : 'not-required';
    if (required.length) {
      violations.push('Existing artifact growth above the approval threshold has no structured approval result');
    }
    if (newProductionPresent) {
      violations.push('New-production approval enforcement is not active');
    }
    return { accepted: !approvalRequired, approval: null, diagnostics: [], headSha: null,
      approvalThresholdPercent,
      newArtifacts: newProduction.artifacts, newSubpaths: newProduction.subpaths,
      newProductionEnforced: false, required, status, thresholdPercent, violations };
  }

  if (supplied.schemaVersion !== 1 || !Array.isArray(supplied.required) ||
      !Array.isArray(supplied.diagnostics)) {
    violations.push('Growth approval result is malformed');
  }
  if (supplied.thresholdPercent !== thresholdPercent) {
    violations.push(`Growth approval threshold ${supplied.thresholdPercent} does not match report threshold ${thresholdPercent}`);
  }
  if (typeof supplied.headSha !== 'string' || !/^[a-f\d]{40}$/.test(supplied.headSha)) {
    violations.push('Growth approval result is missing a lowercase full head SHA');
  }
  if (newProductionPresent && typeof supplied.newProductionEnforced !== 'boolean') {
    violations.push('Growth approval result is missing its new-production enforcement state');
  }
  if (newProductionPresent && !newProductionEnforced) {
    violations.push('New-production approval enforcement is not active');
  }

  if (!sameApprovalRequirements(supplied.required, required)) {
    violations.push('Growth approval requirements do not match the exact report comparison');
  }
  const suppliedNewArtifacts = supplied.newArtifacts === undefined ? [] : supplied.newArtifacts;
  const suppliedNewSubpaths = supplied.newSubpaths === undefined ? [] : supplied.newSubpaths;
  if (!sameNewArtifacts(suppliedNewArtifacts, newProduction.artifacts) ||
      !isDeepStrictEqual(suppliedNewSubpaths, newProduction.subpaths)) {
    violations.push('New-production approval requirements do not match the exact report comparison');
  }
  if (!['approved', 'not-required'].includes(supplied.status)) {
    violations.push(`Growth approval status ${supplied.status || 'missing'} does not permit this report`);
  } else if (approvalRequired && supplied.status !== 'approved') {
    violations.push('Production artifact growth or a new subpath requires an approved result');
  } else if (!approvalRequired && supplied.status !== 'not-required') {
    violations.push('Growth approval result must be not-required when no approval condition is present');
  }
  if (supplied.status === 'approved' && (!supplied.approval || typeof supplied.approval !== 'object')) {
    violations.push('Approved growth result is missing its approval record');
  }

  return {
    ...supplied,
    accepted: violations.length === 0,
    approvalThresholdPercent,
    newArtifacts: newProduction.artifacts,
    newProductionEnforced,
    newSubpaths: newProduction.subpaths,
    required,
    thresholdPercent,
    violations,
  };
}

function growthApprovalSection(result) {
  const status = result.accepted && result.status === 'approved' ? 'Approved' :
    result.accepted ? 'Not required' :
      result.status === 'invalid' || result.status === 'blocked' ? 'Invalid' : 'Required';
  const lines = [
    '',
    '## Artifact growth approval',
    '',
    `Status: **${status}**.`,
    result.approvalThresholdPercent === result.thresholdPercent ?
      `Threshold: greater than ${result.thresholdPercent}% versus the exact pull request base.` :
      `Threshold: greater than ${result.approvalThresholdPercent}% during accepted budget consumption versus the exact pull request base (normal threshold: greater than ${result.thresholdPercent}%).`,
  ];

  if (result.headSha) {
    lines.push(`Head: \`${result.headSha}\`.`);
  }
  if (result.newSubpaths.length && !result.newProductionEnforced) {
    lines.push('New-subpath approval enforcement: **Blocked pending activation**.');
    lines.push(`New subpaths: ${result.newSubpaths.map(subpath => `\`${subpath}\``).join(', ')}.`);
    lines.push(result.newArtifacts.length ?
      `New artifacts at full Brotli size: ${result.newArtifacts
        .map(({ path, size }) => `\`${path}\` (${formatBytes(size)})`).join(', ')}.` :
      'New artifacts: none; the subpath aliases an existing runtime artifact.');
  }
  if (result.accepted && result.status === 'approved') {
    const author = result.approval.authorLogin ? `@${result.approval.authorLogin}` : 'an allowed maintainer';
    const link = result.approval.commentUrl ? `[${author}](${result.approval.commentUrl})` : author;
    const existingPaths = result.required.map(({ path }) => `\`${path}\``);
    if (existingPaths.length) {
      lines.push(`Approved by ${link} for ${existingPaths.join(', ')}.`);
    } else {
      lines.push(`Approved by ${link}.`);
    }
    if (result.newSubpaths.length) {
      lines.push(`New subpaths: ${result.newSubpaths.map(subpath => `\`${subpath}\``).join(', ')}.`);
      lines.push(result.newArtifacts.length ?
        `New artifacts at full Brotli size: ${result.newArtifacts
          .map(({ path, size }) => `\`${path}\` (${formatBytes(size)})`).join(', ')}.` :
        'New artifacts: none; the approved subpath aliases an existing runtime artifact.');
    }
  }

  const diagnostics = [
    ...(Array.isArray(result.diagnostics) ? result.diagnostics
      .map(entry => entry?.message)
      .filter(message => typeof message === 'string' && message) : []),
    ...result.violations,
  ];
  if (diagnostics.length) {
    lines.push(`Approval diagnostics: ${diagnostics.join('; ')}`);
  }

  return lines;
}

async function buildReport(baseFile, currentFile, growthApprovalFile) {
  const base = await readJson(baseFile);
  const current = await readJson(currentFile);
  const suppliedGrowthApproval = growthApprovalFile ? await readJson(growthApprovalFile) : null;
  const growthApproval = growthApprovalReport(base, current, suppliedGrowthApproval);
  const baseByPath = new Map(base.artifacts.map(result => [result.path, result]));
  const approvalRequiredPaths = new Set(growthApproval.required.map(({ path }) => path));
  const newArtifactPaths = new Set(growthApproval.newArtifacts.map(({ path }) => path));
  const rows = current.artifacts.map(result => {
    const baseResult = baseByPath.get(result.path);
    if (!baseResult) {
      const approval = !growthApproval.newProductionEnforced ? 'Blocked pending activation' :
        newArtifactPaths.has(result.path) && growthApproval.accepted &&
          growthApproval.status === 'approved' ? 'Approved' : 'Required';
      return `| ${result.name} | New | ${formatBytes(result.size)} | New artifact | ${approval} |`;
    }
    if (result.size == null || baseResult.size == null) {
      return `| ${result.name} | ${formatBytes(baseResult.size)} | ${formatBytes(result.size)} | Not comparable | Required |`;
    }

    const approval = !approvalRequiredPaths.has(result.path) ? 'Not required' :
      growthApproval.accepted && growthApproval.status === 'approved' ? 'Approved' : 'Required';
    return `| ${result.name} | ${formatBytes(baseResult.size)} | ${formatBytes(result.size)} | ${formatChange(baseResult.size, result.size)} | ${approval} |`;
  });
  const baseGraphs = new Map(base.graphs.map(graph => [graph.subpath, graph]));
  const graphRows = current.graphs.map(graph => {
    const baseGraph = baseGraphs.get(graph.subpath);
    const change = baseGraph ? graphChange(baseGraph, graph) : graph.error || 'New production subpath';
    const moduleCount = graph.status === 'measured' ? graph.modules.length : 'Unmeasured';
    const approval = baseGraph ? 'Not required' : !growthApproval.newProductionEnforced ?
      'Blocked pending activation' : growthApproval.accepted && growthApproval.status === 'approved' ?
        'Approved' : 'Required';
    return `| \`${graph.subpath}\` | ${moduleCount} | ${graph.externalImports.join(', ') || 'None'} | ${change} | ${approval} |`;
  });
  const cumulativeGrowth = formatChange(base.cumulative.size, current.cumulative.size);
  const phase0Growth = formatChange(current.cumulative.baselineSize, current.cumulative.size);
  const resourceComparison = compareResourceReports(base, current);
  const consumerComparison = compareConsumerBundleReports(
    base.consumerBundles,
    current.consumerBundles
  );
  const consumerSection = consumerComparison.unavailable ? [] : [
    '',
    '## Canonical consumer bundles',
    '',
    '| Scenario | Format | Base | PR | Change |',
    '| --- | --- | ---: | ---: | ---: |',
    ...consumerComparison.rows.map(row =>
      `| ${row.scenario} | ${row.format} | ${formatBytes(row.baseSize)} | ${formatBytes(row.currentSize)} | ${row.deltaBytes == null ? 'Bootstrap' : formatChange(row.baseSize, row.currentSize)} |`),
    '',
    consumerComparison.bootstrap ?
      'Reporting bootstrap only: no consumer-scenario baseline or ceiling is active.' :
      'Reporting only: consumer-scenario deltas do not enforce a baseline or ceiling yet.',
    ...(consumerComparison.violations.length ? [
      `Consumer bundle violations: ${consumerComparison.violations.join('; ')}`,
    ] : []),
  ];
  const resourceSection = resourceComparison.unavailable ? [] : [
    '',
    '## Deterministic allocation and retention',
    '',
    '| Structural proxy | Base | PR | Result |',
    '| --- | --- | --- | --- |',
    ...resourceReportRows(resourceComparison),
    '',
    resourceComparison.violations.length ?
      `Resource regressions: ${resourceComparison.violations.join('; ')}` :
      'No eager allocation or retained-resource proxy increased from the exact pull request base.',
  ];
  const approvalSection = growthApprovalSection(growthApproval);

  const markdown = [
    '<!-- bundle-size-report -->',
    '## Production performance contract 📦',
    '',
    `| Runtime artifact | Base | PR | Change | >${growthApproval.approvalThresholdPercent}% approval |`,
    '| --- | ---: | ---: | ---: | --- |',
    ...rows,
    '',
    `Cumulative Brotli-${current.brotliQuality}: **${formatBytes(current.cumulative.size)}** / ${formatBytes(current.cumulative.absoluteCeiling)} authority-contract ceiling (${cumulativeGrowth} from PR base; ${phase0Growth} from Phase 0).`,
    '',
    '| Production subpath | Internal modules | External imports | PR graph change | Approval |',
    '| --- | ---: | --- | --- | --- |',
    ...graphRows,
    '',
    current.violations.length ?
      `Contract violations: ${current.violations.join('; ')}` :
      'All deterministic size and production-graph checks passed against the base authority contract.',
    ...resourceSection,
    ...consumerSection,
    ...approvalSection,
  ].join('\n');

  return { consumerComparison, growthApproval, markdown, resourceComparison };
}

export async function createReport(baseFile, currentFile, growthApprovalFile) {
  return (await buildReport(baseFile, currentFile, growthApprovalFile)).markdown;
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
  if (result.consumerBundles) {
    console.log(`Consumer bundles: ${result.consumerBundles.artifacts.length} reporting-only scenarios/formats measured from ${result.consumerBundles.fixtureVersion}`);
  }
  if (result.resources) {
    console.log(`Resources: ${Object.keys(result.resources.allocations).length} measured instance shapes; ${result.resources.workload.attachDetachCycles} detach cycles; ${result.resources.workload.mountDestroyCycles} mount/destroy cycles`);
  }
}

function positionalPaths(args, index, count, name) {
  const paths = args.slice(index + 1, index + count + 1);
  if (paths.length !== count || paths.some(path => !path || path.startsWith('--'))) {
    throw new Error(`Missing paths for ${name}`);
  }

  return paths;
}

export async function main(args = process.argv.slice(2)) {
  const candidateIndex = args.indexOf('--validate-resource-contract');
  if (candidateIndex !== -1) {
    const paths = positionalPaths(args, candidateIndex, 2, '--validate-resource-contract');
    const [authority, candidate] = await Promise.all([
      readJson(paths[0]),
      readJson(paths[1]),
    ]);
    const violations = [
      ...validateCandidateResourceContract(authority, candidate),
    ];
    for (const violation of violations) {
      console.error(`Performance contract violation: ${violation}`);
    }
    if (violations.length) {
      process.exitCode = 1;
    }
    return;
  }

  const reportIndex = args.indexOf('--report');
  if (reportIndex !== -1) {
    const [baseFile, currentFile] = positionalPaths(args, reportIndex, 2, '--report');
    const growthApprovalFile = getArgument(args, '--growth-approval');
    const report = await buildReport(baseFile, currentFile, growthApprovalFile);
    console.log(report.markdown);
    if (report.resourceComparison.violations.length ||
        report.consumerComparison.violations.length ||
        (growthApprovalFile && !report.growthApproval.accepted)) {
      process.exitCode = 1;
    }
    return;
  }

  const result = await measure({
    root: getArgument(args, '--root', '.'),
    configPath: getArgument(args, '--config', 'config/performance.json'),
    budgetAmendmentsPath: getArgument(args, '--budget-amendments'),
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
