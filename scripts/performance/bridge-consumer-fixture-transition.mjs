import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const expectedTransition = {
  from: 'cbb5cf51f81b78c74238111372eb9b7148b081b3b0d30a91baf0ef613724b134',
  to: '3bfbbe21dbbec92e38439bc94df54c58c68c5c39ac554f961179e3b0f1c33f58',
};
const expectedRelocations = {
  runtimeArtifacts: [
    { from: 'dist/backbone.cjs', to: 'packages/adapters/dist/backbone.cjs' },
    { from: 'dist/backbone.js', to: 'packages/adapters/dist/backbone.js' },
    { from: 'dist/jquery-dom-api.cjs', to: 'packages/adapters/dist/dom/jquery.cjs' },
    { from: 'dist/jquery-dom-api.js', to: 'packages/adapters/dist/dom/jquery.js' },
  ],
  productionGraphs: [
    { from: './backbone', to: '@marionette/adapters/backbone' },
    { from: './jquery-dom-api', to: '@marionette/adapters/dom/jquery' },
  ],
};

function artifactIds(report) {
  return report.artifacts?.map(artifact => artifact.id);
}

export function bridgeConsumerFixtureTransition(baseReport, currentReport, candidateContract) {
  const base = baseReport.consumerBundles;
  const current = currentReport.consumerBundles;
  const valid = base?.status === 'reporting' && current?.status === 'reporting' &&
    base.fixtureVersion === current.fixtureVersion &&
    base.fixtureRevision === expectedTransition.from &&
    current.fixtureRevision === expectedTransition.to &&
    isDeepStrictEqual(base.compression, current.compression) &&
    isDeepStrictEqual(base.toolchain, current.toolchain) &&
    isDeepStrictEqual(base.peerExternalImports, current.peerExternalImports) &&
    isDeepStrictEqual(artifactIds(base), artifactIds(current)) &&
    isDeepStrictEqual(base.violations, []) &&
    isDeepStrictEqual(current.violations, []) &&
    isDeepStrictEqual(candidateContract.relocations, expectedRelocations);

  if (!valid) {
    throw new Error('Consumer fixture transition does not match the audited adapter relocation');
  }

  return {
    ...currentReport,
    consumerBundles: {
      ...current,
      fixtureRevision: base.fixtureRevision,
    },
  };
}

function getArgument(args, name) {
  const index = args.indexOf(name);
  const value = args[index + 1];
  if (index === -1 || !value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

export async function main(args = process.argv.slice(2)) {
  const [baseReport, currentReport, candidateContract] = await Promise.all([
    getArgument(args, '--base-report'),
    getArgument(args, '--current-report'),
    getArgument(args, '--candidate-contract'),
  ].map(async path => JSON.parse(await readFile(path, 'utf8'))));
  const output = getArgument(args, '--output');
  const bridged = bridgeConsumerFixtureTransition(baseReport, currentReport, candidateContract);
  await writeFile(output, `${JSON.stringify(bridged, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
