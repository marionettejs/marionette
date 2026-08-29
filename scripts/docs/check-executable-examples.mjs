import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const markerPattern = /<!--\s*executable-example:\s*([\s\S]*?)\s*-->/g;
const validIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const javascriptFencePattern = /^[ \t]*\r?\n {0,3}```javascript\r?\n[\s\S]*?\r?\n {0,3}```[ \t]*(?:\r?\n|$)/;

function findMarkers(contents) {
  return [...contents.matchAll(markerPattern)].map(match => ({
    id: match[1].trim(),
    index: match.index,
    end: match.index + match[0].length,
  }));
}

function describeLocations(entries) {
  return [...new Set(entries.map(entry => entry.path))].sort().join(', ');
}

export class ExecutableExampleContractError extends Error {
  constructor(errors) {
    super(`Executable documentation example contract failed:\n- ${errors.join('\n- ')}`);
    this.name = 'ExecutableExampleContractError';
    this.errors = errors;
  }
}

export function validateExecutableExamples({ documents, validators }) {
  const errors = [];
  const documentedById = new Map();
  const validatorsById = new Map();

  for (const document of documents) {
    for (const marker of findMarkers(document.contents)) {
      const entry = { ...marker, path: document.path };
      const entries = documentedById.get(marker.id) || [];
      entries.push(entry);
      documentedById.set(marker.id, entries);

      if (!validIdPattern.test(marker.id)) {
        errors.push(`${document.path}: executable example ID "${marker.id}" must be a lowercase hyphenated slug`);
      }

      if (!javascriptFencePattern.test(document.contents.slice(marker.end))) {
        errors.push(`${document.path}: executable example "${marker.id}" must be followed immediately by a javascript fence`);
      }
    }
  }

  for (const validator of validators) {
    const ids = new Set(findMarkers(validator.contents).map(marker => marker.id));
    for (const id of ids) {
      const entries = validatorsById.get(id) || [];
      entries.push({ path: validator.path });
      validatorsById.set(id, entries);
    }
  }

  for (const [id, entries] of documentedById) {
    if (entries.length > 1) {
      const locations = describeLocations(entries);
      errors.push(locations.includes(', ') ?
        `executable example "${id}" appears in multiple documentation locations: ${locations}` :
        `executable example "${id}" appears more than once in ${locations}`);
    }

    const owners = validatorsById.get(id) || [];
    if (owners.length === 0) {
      errors.push(`executable example "${id}" has no fixture validator`);
    } else if (owners.length > 1) {
      errors.push(`executable example "${id}" has multiple fixture validators: ${describeLocations(owners)}`);
    }
  }

  for (const [id, owners] of validatorsById) {
    if (!documentedById.has(id)) {
      errors.push(`fixture marker "${id}" has no documentation example: ${describeLocations(owners)}`);
    }
  }

  if (errors.length > 0) {
    throw new ExecutableExampleContractError(errors.sort());
  }

  return {
    exampleCount: documentedById.size,
    validatorCount: validators.length,
  };
}

async function readFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readFiles(entryPath, predicate));
    } else if (predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function readSources(rootDir, paths) {
  return Promise.all(paths.sort().map(async path => ({
    contents: await readFile(path, 'utf8'),
    path: relative(rootDir, path),
  })));
}

export async function checkExecutableExamples(rootDir) {
  const docsDir = resolve(rootDir, 'docs');
  const fixturesDir = resolve(rootDir, 'test/fixtures');
  const documentPaths = await readFiles(docsDir, path => path.endsWith('.md'));
  const validatorPaths = await readFiles(fixturesDir, path =>
    basename(path) === 'validate.mjs' &&
    relative(fixturesDir, path).split(sep)[0].startsWith('docs-'));

  const [documents, validators] = await Promise.all([
    readSources(rootDir, documentPaths),
    readSources(rootDir, validatorPaths),
  ]);

  return validateExecutableExamples({ documents, validators });
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const rootDir = resolve(dirname(scriptPath), '../..');
  const result = await checkExecutableExamples(rootDir);
  console.log(`Validated ${result.exampleCount} executable documentation examples across ${result.validatorCount} fixture validators.`);
}
