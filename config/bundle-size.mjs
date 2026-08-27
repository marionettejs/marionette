import { readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import { rollup } from 'rollup';

const compress = promisify(brotliCompress);
const args = process.argv.slice(2);

function getArgument(name, fallback) {
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
  if (Math.abs(bytes) < 1000) {
    return `${bytes} B`;
  }

  return `${(bytes / 1000).toFixed(2)} kB`;
}

function formatChange(base, current) {
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

function runtimePath(path) {
  return typeof path === 'string' && /^(?:\.\/)?dist\/.+\.(?:c?js)$/.test(path);
}

function collectRuntimePaths(value, paths = new Set()) {
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

function runtimeSubpaths(packageJson) {
  return Object.entries(packageJson.exports)
    .filter(([, value]) => collectRuntimePaths(value).size)
    .map(([subpath]) => subpath)
    .sort();
}

async function listRuntimeFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRuntimeFiles(entryPath, root));
    } else if (/\.(?:c?js)$/.test(entry.name)) {
      files.push(normalizePath(relative(root, entryPath)));
    }
  }

  return files.sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter(value => !rightSet.has(value));
}

function validateContract(contract, packageJson, runtimeFiles) {
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

async function measureGraph(root, configurations, graph, contract) {
  const { configuration, output } = findRollupConfiguration(configurations, graph);
  const bundle = await rollup(configuration);

  try {
    const generated = await bundle.generate(output);
    const chunks = generated.output.filter(item => item.type === 'chunk');
    const modules = [...new Set(chunks.flatMap(chunk => Object.keys(chunk.modules)))]
      .map(moduleId => normalizePath(relative(root, moduleId)))
      .sort();
    const externalImports = [...new Set(chunks.flatMap(chunk => chunk.imports))].sort();
    const forbiddenModules = modules.filter(module => {
      return contract.forbiddenProductionModules.includes(module) ||
        contract.forbiddenProductionModulePrefixes.some(prefix => module.startsWith(prefix));
    });

    return {
      subpath: graph.subpath,
      input: graph.input,
      output: graph.output,
      modules,
      externalImports,
      phase0AddedModules: difference(modules, graph.baselineModules),
      phase0RemovedModules: difference(graph.baselineModules, modules),
      phase0AddedExternalImports: difference(externalImports, graph.baselineExternalImports),
      phase0RemovedExternalImports: difference(graph.baselineExternalImports, externalImports),
      forbiddenModules,
    };
  } finally {
    await bundle.close();
  }
}

async function measure() {
  const root = resolve(getArgument('--root', '.'));
  const configPath = resolve(getArgument('--config', 'config/performance.json'));
  const contract = await readJson(configPath);
  const packageJson = await readJson(resolve(root, 'package.json'));
  const runtimeFiles = await listRuntimeFiles(resolve(root, 'dist'));
  const violations = validateContract(contract, packageJson, runtimeFiles);
  const quality = contract.baseline.brotliQuality;

  const artifacts = await Promise.all(contract.runtimeArtifacts.map(async artifact => {
    const contents = await readFile(resolve(root, artifact.path));
    const compressed = await compress(contents, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: quality
      }
    });

    return {
      name: artifact.name,
      path: artifact.path,
      size: compressed.length,
      baselineSize: artifact.baselineBrotliBytes,
    };
  }));
  const totalSize = artifacts.reduce((total, artifact) => total + artifact.size, 0);
  if (totalSize > contract.baseline.absoluteCeilingBytes) {
    violations.push(`Cumulative Brotli-${quality} size ${totalSize} exceeds the absolute ceiling ${contract.baseline.absoluteCeilingBytes}`);
  }

  const configUrl = pathToFileURL(resolve(root, 'rollup.config.mjs'));
  const { default: configurations } = await import(configUrl.href);
  const graphs = [];
  for (const graph of contract.productionGraphs) {
    const result = await measureGraph(root, configurations, graph, contract);
    graphs.push(result);
    if (result.forbiddenModules.length) {
      violations.push(`${graph.subpath} includes forbidden production modules: ${result.forbiddenModules.join(', ')}`);
    }
  }

  const result = {
    schemaVersion: 1,
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

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const artifact of artifacts) {
      console.log(`${artifact.name}: ${formatBytes(artifact.size)} (${formatChange(artifact.baselineSize, artifact.size)} from Phase 0)`);
    }
    console.log(`Cumulative: ${formatBytes(totalSize)} / ${formatBytes(result.cumulative.absoluteCeiling)}`);
    for (const graph of graphs) {
      console.log(`${graph.subpath}: ${graph.modules.length} internal modules, ${graph.externalImports.length} external imports`);
    }
  }

  if (!args.includes('--no-enforce') && violations.length) {
    for (const violation of violations) {
      console.error(`Performance contract violation: ${violation}`);
    }
    process.exitCode = 1;
  }
}

function graphChange(baseGraph, currentGraph) {
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

async function createReport(baseFile, currentFile) {
  const base = await readJson(baseFile);
  const current = await readJson(currentFile);
  const baseByPath = new Map(base.artifacts.map(result => [result.path, result]));
  const approvalThreshold = current.thresholds.pullRequestApprovalPercent;
  const rows = current.artifacts.map(result => {
    const baseResult = baseByPath.get(result.path);
    if (!baseResult) {
      return `| ${result.name} | New | ${formatBytes(result.size)} | Approval required |`;
    }

    const percent = baseResult.size === 0 ? 100 : (result.size - baseResult.size) / baseResult.size * 100;
    const approval = percent > approvalThreshold ? 'Required by PR B' : 'No';
    return `| ${result.name} | ${formatBytes(baseResult.size)} | ${formatBytes(result.size)} | ${formatChange(baseResult.size, result.size)} | ${approval} |`;
  });
  const baseGraphs = new Map(base.graphs.map(graph => [graph.subpath, graph]));
  const graphRows = current.graphs.map(graph => {
    const baseGraph = baseGraphs.get(graph.subpath);
    const change = baseGraph ? graphChange(baseGraph, graph) : 'New production subpath';
    return `| \`${graph.subpath}\` | ${graph.modules.length} | ${graph.externalImports.join(', ') || 'None'} | ${change} |`;
  });
  const cumulativeGrowth = formatChange(base.cumulative.size, current.cumulative.size);
  const phase0Growth = formatChange(current.cumulative.baselineSize, current.cumulative.size);

  console.log([
    '<!-- bundle-size-report -->',
    '## Production performance contract 📦',
    '',
    '| Runtime artifact | Base | PR | Change | >1% approval |',
    '| --- | ---: | ---: | ---: | --- |',
    ...rows,
    '',
    `Cumulative Brotli-${current.brotliQuality}: **${formatBytes(current.cumulative.size)}** / ${formatBytes(current.cumulative.absoluteCeiling)} absolute ceiling (${cumulativeGrowth} from PR base; ${phase0Growth} from Phase 0).`,
    '',
    '| Production subpath | Internal modules | External imports | PR graph change |',
    '| --- | ---: | --- | --- |',
    ...graphRows,
    '',
    current.violations.length ?
      `Contract violations: ${current.violations.join('; ')}` :
      'All deterministic size and production-graph checks passed.',
    '',
    'The exact-head approval protocol for growth above 1% and new subpaths is intentionally deferred to #127 PR B; this report does not treat that threshold as an enforceable approval yet.'
  ].join('\n'));
}

async function main() {
  const reportIndex = args.indexOf('--report');
  if (reportIndex === -1) {
    await measure();
  } else {
    await createReport(args[reportIndex + 1], args[reportIndex + 2]);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
