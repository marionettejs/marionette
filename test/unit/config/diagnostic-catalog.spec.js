import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DiagnosticCatalogValidationError,
  discoverProductionSources,
  validateDiagnosticCatalog,
} from '../../../scripts/diagnostics/catalog.mjs';
import { diagnosticPage } from '../../../scripts/docs/build.mjs';

describe('diagnostic catalog validation', function() {
  function createDiagnostic(overrides = {}) {
    return {
      code: 'MN0001',
      slug: 'unknown-region',
      status: 'active',
      category: 'ownership',
      severity: 'error',
      objects: ['Region', 'View'],
      remediation: 'Use a declared Region name.',
      docsAnchor: '/errors/MN0001/',
      surfaces: ['lint', 'runtime', 'test'],
      benchmarkCategory: 'ownership',
      ...overrides,
    };
  }

  function createCatalog(diagnostics = [createDiagnostic()]) {
    return {
      $schema: './catalog.schema.json',
      schemaVersion: 1,
      diagnostics,
    };
  }

  function validate(catalog, options) {
    return validateDiagnosticCatalog(catalog, options);
  }

  it('validates cataloged runtime emissions and ESLint rule mappings', function() {
    const catalog = createCatalog();
    const result = validate(catalog, {
      runtimeSources: [{
        contents: 'const payload = { code: \'MN9999\' };\nthrow new MarionetteError({ code: \'MN0001\' });',
        path: 'modules/example.js',
      }],
      eslintRuleSources: [{
        contents: 'export default { meta: { docs: { recommended: true }, diagnosticCode: \'MN0001\' } };',
        path: 'eslint-rules/example.mjs',
      }],
    });

    expect(result).to.equal(catalog);
  });

  it('rejects catalogs that do not match the schema', function() {
    const diagnostic = createDiagnostic();
    delete diagnostic.remediation;

    expect(() => validate(createCatalog([diagnostic])))
      .to.throw(DiagnosticCatalogValidationError, /must have required property 'remediation'/);
  });

  it('requires the exact version-neutral documentation anchor', function() {
    const catalog = createCatalog([createDiagnostic({ docsAnchor: '/errors/MN0002/' })]);

    expect(() => validate(catalog))
      .to.throw(DiagnosticCatalogValidationError, 'MN0001 docsAnchor must be /errors/MN0001/');
  });

  it('requires unique diagnostic identifiers', function() {
    const catalog = createCatalog([
      createDiagnostic(),
      createDiagnostic({ benchmarkCategory: 'region' }),
    ]);

    expect(() => validate(catalog)).to.throw(DiagnosticCatalogValidationError, /duplicate diagnostic code MN0001/);
  });

  it('requires diagnostics to be sorted by code', function() {
    const catalog = createCatalog([
      createDiagnostic({ code: 'MN0002', docsAnchor: '/errors/MN0002/', slug: 'second-code' }),
      createDiagnostic(),
    ]);

    expect(() => validate(catalog))
      .to.throw(DiagnosticCatalogValidationError, 'diagnostics must be sorted by code');
  });

  it('requires objects and surfaces to be sorted', function() {
    const catalog = createCatalog([createDiagnostic({
      objects: ['View', 'Region'],
      surfaces: ['test', 'runtime'],
    })]);

    expect(() => validate(catalog)).to.throw(DiagnosticCatalogValidationError, /objects must be sorted/);
    expect(() => validate(catalog)).to.throw(DiagnosticCatalogValidationError, /surfaces must be sorted/);
  });

  it('requires objects and surfaces to contain unique values', function() {
    const catalog = createCatalog([createDiagnostic({
      objects: ['Region', 'Region'],
      surfaces: ['runtime', 'runtime'],
    })]);

    expect(() => validate(catalog)).to.throw(DiagnosticCatalogValidationError, /must NOT have duplicate items/);
  });

  it('rejects an unknown deprecation replacement', function() {
    const catalog = createCatalog([createDiagnostic({
      replacementCode: 'MN0002',
      status: 'deprecated',
    })]);

    expect(() => validate(catalog))
      .to.throw(DiagnosticCatalogValidationError, 'MN0001 replacementCode MN0002 is not cataloged');
  });

  it('rejects a self-referencing deprecation replacement', function() {
    const catalog = createCatalog([createDiagnostic({
      replacementCode: 'MN0001',
      status: 'deprecated',
    })]);

    expect(() => validate(catalog))
      .to.throw(DiagnosticCatalogValidationError, 'MN0001 replacementCode must not reference itself');
  });

  it('rejects deprecation replacement cycles', function() {
    const catalog = createCatalog([
      createDiagnostic({ replacementCode: 'MN0002', status: 'deprecated' }),
      createDiagnostic({
        code: 'MN0002',
        docsAnchor: '/errors/MN0002/',
        replacementCode: 'MN0001',
        slug: 'replacement-cycle',
        status: 'deprecated',
      }),
    ]);

    expect(() => validate(catalog))
      .to.throw(DiagnosticCatalogValidationError, /replacement cycle detected/);
  });

  it('rejects a replacement on a non-deprecated diagnostic', function() {
    const catalog = createCatalog([createDiagnostic({
      replacementCode: 'MN0002',
      status: 'active',
    })]);

    expect(() => validate(catalog))
      .to.throw(DiagnosticCatalogValidationError, /replacementCode/);
  });

  it('rejects an uncataloged runtime emission', function() {
    const catalog = createCatalog();

    expect(() => validate(catalog, {
      runtimeSources: [{
        contents: 'throw new MarionetteError({ code: \'MN9999\' });',
        path: 'modules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'modules/example.js emits uncataloged diagnostic code MN9999',
    );
  });

  it('rejects a non-literal runtime diagnostic code', function() {
    expect(() => validate(createCatalog(), {
      runtimeSources: [{
        contents: 'throw new MarionetteError({ code: diagnosticCode });',
        path: 'modules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'modules/example.js must emit a literal diagnostic code',
    );
  });

  it('requires every runtime MarionetteError to declare a diagnostic code', function() {
    expect(() => validate(createCatalog(), {
      runtimeSources: [{
        contents: 'throw new MarionetteError({ message: \'Missing code\' });',
        path: 'modules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'modules/example.js MarionetteError must declare one literal diagnostic code',
    );
  });

  it('recognizes aliased MarionetteError imports', function() {
    expect(() => validate(createCatalog(), {
      runtimeSources: [{
        contents: 'import FrameworkError from \'../utils/error.js\';\nthrow new FrameworkError({ message: \'Missing code\' });',
        path: 'modules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'modules/example.js MarionetteError must declare one literal diagnostic code',
    );
  });

  it('recognizes named default MarionetteError imports', function() {
    expect(() => validate(createCatalog(), {
      runtimeSources: [{
        contents: 'import { default as FrameworkError } from \'../utils/error.js\';\nthrow new FrameworkError({ message: \'Missing code\' });',
        path: 'modules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'modules/example.js MarionetteError must declare one literal diagnostic code',
    );
  });

  it('rejects deliberate native framework errors', function() {
    for (const errorName of ['Error', 'TypeError']) {
      expect(() => validate(createCatalog(), {
        runtimeSources: [{
          contents: `throw new ${errorName}('Uncataloged');`,
          path: 'modules/example.js',
        }],
      })).to.throw(
        DiagnosticCatalogValidationError,
        `modules/example.js must not throw a native ${errorName}; use MarionetteError with a catalog code`,
      );
    }
  });

  it('rejects runtime emissions for a defined diagnostic', function() {
    const catalog = createCatalog([createDiagnostic({ status: 'defined' })]);

    expect(() => validate(catalog, {
      runtimeSources: [{
        contents: 'throw new MarionetteError({ code: \'MN0001\' });',
        path: 'modules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'modules/example.js emits MN0001, but its catalog status is defined',
    );
  });

  it('rejects runtime diagnostic options that can override the code', function() {
    const unsafeSources = [
      'new MarionetteError(options);',
      'new MarionetteError({ code: \'MN0001\', ...options });',
      'new MarionetteError({ code: \'MN0001\', code: \'MN9999\' });',
    ];

    for (const contents of unsafeSources) {
      expect(() => validate(createCatalog(), {
        runtimeSources: [{ contents, path: 'modules/example.js' }],
      })).to.throw(DiagnosticCatalogValidationError);
    }
  });

  it('discovers diagnostics in newly imported production files', async function() {
    const rootDir = await mkdtemp(join(tmpdir(), 'marionette-diagnostics-'));

    try {
      await writeFile(join(rootDir, 'entry.js'), 'import \'./emitter.js\';');
      await writeFile(
        join(rootDir, 'emitter.js'),
        'throw new MarionetteError({ code: \'MN9999\' });',
      );

      const runtimeSources = await discoverProductionSources({
        inputs: ['entry.js'],
        rootDir,
      });

      expect(runtimeSources.map(({ path }) => path)).to.include('emitter.js');
      expect(() => validate(createCatalog(), { runtimeSources })).to.throw(
        DiagnosticCatalogValidationError,
        'emitter.js emits uncataloged diagnostic code MN9999',
      );
    } finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  it('requires runtime emissions to declare the runtime surface', function() {
    const catalog = createCatalog([createDiagnostic({ surfaces: ['test'] })]);

    expect(() => validate(catalog, {
      runtimeSources: [{
        contents: 'throw new MarionetteError({ code: \'MN0001\' });',
        path: 'runtime/dom-api.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'runtime/dom-api.js emits MN0001, but its catalog surfaces do not include runtime',
    );
  });

  it('requires every ESLint rule to declare a literal diagnostic mapping', function() {
    expect(() => validate(createCatalog(), {
      eslintRuleSources: [{
        contents: 'const diagnosticCode = \'MN0001\'; export default { meta: { diagnosticCode } };',
        path: 'eslint-rules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'eslint-rules/example.js must default-export an object with a literal meta.diagnosticCode',
    );
  });

  it('does not accept a diagnostic mapping outside of rule metadata', function() {
    expect(() => validate(createCatalog(), {
      eslintRuleSources: [{
        contents: 'const decoy = { meta: { diagnosticCode: \'MN0001\' } }; export default { meta: {} };',
        path: 'eslint-rules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'eslint-rules/example.js must default-export an object with a literal meta.diagnosticCode',
    );
  });

  it('rejects an uncataloged ESLint rule mapping', function() {
    expect(() => validate(createCatalog(), {
      eslintRuleSources: [{
        contents: 'export default { meta: { diagnosticCode: \'MN9999\' } };',
        path: 'eslint-rules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'eslint-rules/example.js maps to uncataloged diagnostic code MN9999',
    );
  });

  it('requires ESLint mappings to declare the lint surface', function() {
    const catalog = createCatalog([createDiagnostic({ surfaces: ['runtime'] })]);

    expect(() => validate(catalog, {
      eslintRuleSources: [{
        contents: 'export default { meta: { diagnosticCode: \'MN0001\' } };',
        path: 'eslint-rules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'eslint-rules/example.js maps to MN0001, but its catalog surfaces do not include lint',
    );
  });

  it('rejects ESLint mappings for a defined diagnostic', function() {
    const catalog = createCatalog([createDiagnostic({ status: 'defined' })]);

    expect(() => validate(catalog, {
      eslintRuleSources: [{
        contents: 'export default { meta: { diagnosticCode: \'MN0001\' } };',
        path: 'eslint-rules/example.js',
      }],
    })).to.throw(
      DiagnosticCatalogValidationError,
      'eslint-rules/example.js maps to MN0001, but its catalog status is defined',
    );
  });

  it('rejects ESLint metadata that can override the mapping', function() {
    const unsafeSources = [
      'export default { meta: { diagnosticCode: \'MN0001\', ...meta } };',
      'export default { meta: { diagnosticCode: \'MN0001\', diagnosticCode: \'MN9999\' } };',
      'export default { meta: { diagnosticCode: \'MN0001\' }, ...rule };',
    ];

    for (const contents of unsafeSources) {
      expect(() => validate(createCatalog(), {
        eslintRuleSources: [{ contents, path: 'eslint-rules/example.js' }],
      })).to.throw(
        DiagnosticCatalogValidationError,
        'eslint-rules/example.js must default-export an object with a literal meta.diagnosticCode',
      );
    }
  });

  it('links a deprecated diagnostic page to its replacement', function() {
    const markdown = diagnosticPage(createDiagnostic({
      replacementCode: 'MN0002',
      status: 'deprecated',
    }));

    expect(markdown).to.contain('| Replacement | [MN0002](/errors/MN0002/) |');
  });
});
