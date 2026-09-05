import Ajv from 'ajv';
import { Linter } from 'eslint';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import rollupConfigurations from '../../rollup.config.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const defaultSchema = JSON.parse(await readFile(resolve(repositoryRoot, 'config/diagnostics/catalog.schema.json'), 'utf8'));
const javascriptFilePattern = /\.(?:js|mjs)$/;
const javascriptLinter = new Linter();

function inputFiles(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === 'object') {
    return Object.values(input);
  }

  return [input];
}

const productionInputs = [...new Set(rollupConfigurations
  .filter(configuration => {
    const outputs = Array.isArray(configuration.output) ? configuration.output : [configuration.output];
    return outputs.some(output => output?.file?.replaceAll('\\', '/').startsWith('dist/'));
  })
  .flatMap(configuration => inputFiles(configuration.input)))];

export class DiagnosticCatalogValidationError extends Error {
  constructor(errors) {
    super(errors.join('\n'));
    this.name = 'DiagnosticCatalogValidationError';
    this.errors = errors;
  }
}

function addDuplicateErrors(diagnostics, property, label, errors) {
  const seen = new Set();

  for (const diagnostic of diagnostics) {
    const value = diagnostic[property];

    if (seen.has(value)) {
      errors.push(`duplicate ${label} ${value}`);
    }

    seen.add(value);
  }
}

function addSortedArrayErrors(diagnostic, property, errors) {
  const values = diagnostic[property];
  const uniqueValues = new Set(values);
  const sortedValues = [...values].sort();

  if (uniqueValues.size !== values.length) {
    errors.push(`${diagnostic.code} ${property} must contain unique values`);
  }

  if (JSON.stringify(values) !== JSON.stringify(sortedValues)) {
    errors.push(`${diagnostic.code} ${property} must be sorted`);
  }
}

function addReplacementErrors(diagnostics, diagnosticsByCode, errors) {
  for (const diagnostic of diagnostics) {
    const replacementCode = diagnostic.replacementCode;

    if (diagnostic.status !== 'deprecated') {
      continue;
    }

    if (!replacementCode) {
      errors.push(`${diagnostic.code} is deprecated and must declare replacementCode`);
      continue;
    }

    if (replacementCode === diagnostic.code) {
      errors.push(`${diagnostic.code} replacementCode must not reference itself`);
      continue;
    }

    if (!diagnosticsByCode.has(replacementCode)) {
      errors.push(`${diagnostic.code} replacementCode ${replacementCode} is not cataloged`);
    }
  }

  for (const diagnostic of diagnostics) {
    if (diagnostic.status !== 'deprecated' || !diagnosticsByCode.has(diagnostic.replacementCode)) {
      continue;
    }

    const path = [];
    const visited = new Map();
    let current = diagnostic;

    while (current?.status === 'deprecated' && diagnosticsByCode.has(current.replacementCode)) {
      if (visited.has(current.code)) {
        const cycle = [...path.slice(visited.get(current.code)), current.code];
        errors.push(`replacement cycle detected: ${cycle.join(' -> ')}`);
        break;
      }

      visited.set(current.code, path.length);
      path.push(current.code);
      current = diagnosticsByCode.get(current.replacementCode);
    }
  }
}

function propertyName(property) {
  if (property.type !== 'Property' || property.computed) {
    return;
  }

  return property.key.type === 'Identifier' ? property.key.name : property.key.value;
}

function literalString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
}

function visitNodes(node, visitor) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (typeof node.type === 'string') {
    visitor(node);
  }

  for (const [property, value] of Object.entries(node)) {
    if (property === 'parent') {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach(child => visitNodes(child, visitor));
    } else if (value && typeof value.type === 'string') {
      visitNodes(value, visitor);
    }
  }
}

function parseJavaScript(contents, path, errors) {
  const messages = javascriptLinter.verify(contents, {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  }, { filename: path });
  const sourceCode = javascriptLinter.getSourceCode();

  if (!sourceCode) {
    const details = messages.map(message => `${message.line}:${message.column} ${message.message}`).join(', ');
    errors.push(`${path} could not be parsed: ${details}`);
    return;
  }

  return sourceCode.ast;
}

function addRuntimeSourceErrors(runtimeSources, diagnosticsByCode, errors) {
  for (const { contents, path } of runtimeSources) {
    const ast = parseJavaScript(contents, path, errors);
    if (!ast) {
      continue;
    }

    const marionetteErrorBindings = new Set(['MarionetteError']);
    for (const node of ast.body) {
      if (node.type !== 'ImportDeclaration' ||
        !/(?:^|\/)error\.js$/.test(node.source.value)) {
        continue;
      }

      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportDefaultSpecifier' ||
          (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'default')) {
          marionetteErrorBindings.add(specifier.local.name);
        }
      }
    }

    visitNodes(ast, node => {
      if (node.type === 'ThrowStatement' &&
        ['CallExpression', 'NewExpression'].includes(node.argument?.type) &&
        ['AggregateError', 'Error', 'EvalError', 'RangeError', 'ReferenceError',
          'SyntaxError', 'TypeError', 'URIError'].includes(node.argument.callee?.name)) {
        errors.push(`${path} must not throw a native ${node.argument.callee.name}; use MarionetteError with a catalog code`);
        return;
      }

      if (node.type !== 'NewExpression' || !marionetteErrorBindings.has(node.callee.name)) {
        return;
      }

      const options = node.arguments[0];
      if (options?.type !== 'ObjectExpression') {
        errors.push(`${path} must construct MarionetteError with object-literal options`);
        return;
      }

      if (options.properties.some(property => property.type === 'SpreadElement' || property.computed)) {
        errors.push(`${path} MarionetteError options must not use spreads or computed properties`);
        return;
      }

      const codeProperties = options.properties.filter(property => propertyName(property) === 'code');
      if (!codeProperties.length) {
        errors.push(`${path} MarionetteError must declare one literal diagnostic code`);
        return;
      }

      if (codeProperties.length > 1) {
        errors.push(`${path} MarionetteError options must not declare duplicate code properties`);
        return;
      }

      for (const property of codeProperties) {
        const code = literalString(property.value);
        const diagnostic = diagnosticsByCode.get(code);

        if (!code) {
          errors.push(`${path} must emit a literal diagnostic code`);
        } else if (!diagnostic) {
          errors.push(`${path} emits uncataloged diagnostic code ${code}`);
        } else if (['defined', 'retired'].includes(diagnostic.status)) {
          errors.push(`${path} emits ${code}, but its catalog status is ${diagnostic.status}`);
        } else if (!diagnostic.surfaces.includes('runtime')) {
          errors.push(`${path} emits ${code}, but its catalog surfaces do not include runtime`);
        }
      }
    });
  }
}

function addEslintRuleErrors(eslintRuleSources, diagnosticsByCode, errors) {
  for (const { contents, path } of eslintRuleSources) {
    const ast = parseJavaScript(contents, path, errors);
    if (!ast) {
      continue;
    }

    const defaultExports = ast.body.filter(node => node.type === 'ExportDefaultDeclaration');
    const rule = defaultExports.length === 1 ? defaultExports[0].declaration : undefined;
    const ruleProperties = rule?.type === 'ObjectExpression' ? rule.properties : [];
    const metaProperties = ruleProperties.filter(property => propertyName(property) === 'meta');
    const meta = metaProperties.length === 1 ? metaProperties[0].value : undefined;
    const metaEntries = meta?.type === 'ObjectExpression' ? meta.properties : [];
    const codeProperties = metaEntries.filter(property => propertyName(property) === 'diagnosticCode');
    const codeProperty = codeProperties.length === 1 ? codeProperties[0] : undefined;
    const code = codeProperty && literalString(codeProperty.value);

    const ambiguous = ruleProperties.some(property => property.type === 'SpreadElement' || property.computed) ||
      metaEntries.some(property => property.type === 'SpreadElement' || property.computed) ||
      metaProperties.length !== 1 || codeProperties.length !== 1;

    if (ambiguous || !code) {
      errors.push(`${path} must default-export an object with a literal meta.diagnosticCode`);
      continue;
    }

    const diagnostic = diagnosticsByCode.get(code);
    if (!diagnostic) {
      errors.push(`${path} maps to uncataloged diagnostic code ${code}`);
    } else if (['defined', 'retired'].includes(diagnostic.status)) {
      errors.push(`${path} maps to ${code}, but its catalog status is ${diagnostic.status}`);
    } else if (!diagnostic.surfaces.includes('lint')) {
      errors.push(`${path} maps to ${code}, but its catalog surfaces do not include lint`);
    }
  }
}

function formatSchemaError(error) {
  const location = error.instancePath || '/';
  return `schema ${location} ${error.message}`;
}

export function validateDiagnosticCatalog(catalog, {
  eslintRuleSources = [],
  runtimeSources = [],
  schema = defaultSchema,
} = {}) {
  const ajv = new Ajv({ allErrors: true, strict: true });
  let validate;

  try {
    validate = ajv.compile(schema);
  } catch (error) {
    throw new DiagnosticCatalogValidationError([`invalid catalog schema: ${error.message}`]);
  }

  if (!validate(catalog)) {
    throw new DiagnosticCatalogValidationError(validate.errors.map(formatSchemaError));
  }

  const diagnostics = catalog.diagnostics;
  const diagnosticsByCode = new Map(diagnostics.map(diagnostic => [diagnostic.code, diagnostic]));
  const errors = [];

  addDuplicateErrors(diagnostics, 'code', 'diagnostic code', errors);
  addDuplicateErrors(diagnostics, 'slug', 'diagnostic slug', errors);
  addDuplicateErrors(diagnostics, 'docsAnchor', 'documentation anchor', errors);

  const sortedCodes = diagnostics.map(({ code }) => code).sort();
  if (JSON.stringify(diagnostics.map(({ code }) => code)) !== JSON.stringify(sortedCodes)) {
    errors.push('diagnostics must be sorted by code');
  }

  for (const diagnostic of diagnostics) {
    if (diagnostic.docsAnchor !== `/errors/${diagnostic.code}/`) {
      errors.push(`${diagnostic.code} docsAnchor must be /errors/${diagnostic.code}/`);
    }

    addSortedArrayErrors(diagnostic, 'objects', errors);
    addSortedArrayErrors(diagnostic, 'surfaces', errors);
  }

  addReplacementErrors(diagnostics, diagnosticsByCode, errors);
  addRuntimeSourceErrors(runtimeSources, diagnosticsByCode, errors);
  addEslintRuleErrors(eslintRuleSources, diagnosticsByCode, errors);

  if (errors.length) {
    throw new DiagnosticCatalogValidationError(errors);
  }

  return catalog;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJavaScriptFiles(directory, { optional = false } = {}) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (optional && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const sources = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      sources.push(...await readJavaScriptFiles(path));
    } else if (javascriptFilePattern.test(entry.name)) {
      sources.push({
        contents: await readFile(path, 'utf8'),
        path,
      });
    }
  }

  return sources;
}

function relativeSources(rootDir, sources) {
  return sources.map(source => ({
    ...source,
    path: relative(rootDir, source.path).replaceAll('\\', '/'),
  }));
}

export async function discoverProductionSources({
  inputs = productionInputs,
  rootDir = repositoryRoot,
} = {}) {
  const bundle = await rollup({
    external: source => !source.startsWith('.') && !isAbsolute(source),
    input: inputs.map(input => resolve(rootDir, input)),
    onwarn(warning) {
      throw new Error(`Production graph warning: ${warning.message}`);
    },
    treeshake: false,
  });

  try {
    const sources = await Promise.all(bundle.watchFiles.map(async path => ({
      contents: await readFile(path, 'utf8'),
      path,
    })));
    return relativeSources(rootDir, sources);
  } finally {
    await bundle.close();
  }
}

export async function loadDiagnosticCatalog({ rootDir = repositoryRoot } = {}) {
  const diagnosticsDir = resolve(rootDir, 'config/diagnostics');
  const [catalog, schema, runtimeSources, eslintRuleSources] = await Promise.all([
    readJson(resolve(diagnosticsDir, 'catalog.json')),
    readJson(resolve(diagnosticsDir, 'catalog.schema.json')),
    discoverProductionSources({ rootDir }),
    readJavaScriptFiles(resolve(rootDir, 'eslint-rules'), { optional: true }),
  ]);

  return validateDiagnosticCatalog(catalog, {
    eslintRuleSources: relativeSources(rootDir, eslintRuleSources),
    runtimeSources,
    schema,
  });
}
