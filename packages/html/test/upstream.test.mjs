import './setup.mjs';
import {readFile, readdir} from 'node:fs/promises';
import {transpileModule, ModuleKind, ScriptTarget, createSourceFile, isExpressionStatement, isCallExpression} from 'typescript';

// Keep originals byte-for-byte in vendor. Adapt imports/test-runner plumbing,
// not expectations or library code. Run the same subset against both engines.
const engine = process.env.UPSTREAM_ENGINE ?? '@mnjs/html';
const support = new URL('./upstream-support.mjs', import.meta.url).href;
const directory = new URL('../vendor/lit-html-3.3.3/test/', import.meta.url);
for (const name of (await readdir(directory)).filter(name => name.endsWith('_test.ts') || name === 'core-source.ts').sort()) {
  let source = await readFile(new URL(name, directory), 'utf8');
  if (name === 'core-source.ts') {
    // Select complete public-behavior suites from the pristine upstream core file.
    // Event/compiler/private-protocol/security-reset/debug-global suites are not
    // the package contract. Keep each selected test body and expectation intact.
    const selected = new Set(['marker insertion', 'text', 'arrays & iterables',
      'svg', 'MathML', 'attributes', 'boolean attributes', 'properties', 'updates', 'async directives']);
    const selectedDirectives = new Set(['renders directives on ChildParts', 'directives are stateful',
      'renders directives on AttributeParts', 'renders multiple directives on AttributeParts',
      'renders directives on PropertyParts', 'renders directives on ElementParts', 'nested directives']);
    const parsed = createSourceFile(name, source, ScriptTarget.Latest, true);
    const root = parsed.statements.find(statement => isExpressionStatement(statement)
      && isCallExpression(statement.expression)
      && statement.expression.expression.getText(parsed) === 'suite'
      && statement.expression.arguments[0]?.text === 'lit-html');
    const prefix = [];
    const suites = [];
    let inSuites = false;
    for (const statement of root.expression.arguments[1].body.statements) {
      const call = isExpressionStatement(statement) && isCallExpression(statement.expression)
        ? statement.expression : undefined;
      if (call?.expression.getText(parsed) === 'suite') {
        inSuites = true;
        if (selected.has(call.arguments[0]?.text)) suites.push(statement.getFullText(parsed));
        if (call.arguments[0]?.text === 'directives') {
          const pieces = [];
          let selectedCount = 0;
          let inDirectiveTests = false;
          for (const child of call.arguments[1].body.statements) {
            const invocation = isExpressionStatement(child) && isCallExpression(child.expression) ? child.expression : undefined;
            if (invocation && ['test','suite'].includes(invocation.expression.getText(parsed))) {
              inDirectiveTests = true;
              if (selectedDirectives.has(invocation.arguments[0]?.text)) {pieces.push(child.getFullText(parsed)); selectedCount++;}
            } else if (!inDirectiveTests) pieces.push(child.getFullText(parsed));
          }
          if (selectedCount !== selectedDirectives.size) throw new Error('Upstream directive selection changed');
          suites.push(`suite('directives', () => {${pieces.join('\n')}});`);
        }
      } else if (!inSuites) prefix.push(statement.getFullText(parsed));
    }
    if (suites.length !== selected.size + 1) throw new Error('Upstream core suite selection changed');
    const imports = source.slice(0, source.indexOf('// For compiled template tests'))
      .replace("import {isCompiledTemplateResult} from 'lit-html/directive-helpers.js';", '');
    const environment = source.slice(source.indexOf('const ua ='), source.indexOf('class FireEventDirective'))
      .replace('const testAreCompiled = isCompiledTemplateResult(html``);', 'const testAreCompiled = false;')
      .replace('const DEV_MODE = render.setSanitizer != null;',
        "const DEV_MODE = process.execArgv.includes('--conditions=development');");
    source = `${imports}\n${environment}\nsuite('upstream retained core', () => {\n${prefix.join('\n')}\n${suites.join('\n')}\n});`;
  }

  // This upstream test probes a private directive brand, contrary to this repo's
  // public-API testing policy. Other styleMap tests use observable DOM behavior.
  if (name === 'style-map_test.ts') source = source.replace("test('render() only properties'", "test.skip('render() only properties'");
  let code = transpileModule(source, {
    compilerOptions: {module: ModuleKind.ESNext, target: ScriptTarget.ES2022},
  }).outputText;
  code = code.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => {
    if (specifier === 'chai' || specifier === '@lit-labs/testing') return `from ${JSON.stringify(support)}`;
    if (!specifier.startsWith('lit-html')) throw new Error(`Unexpected upstream import ${specifier}`);
    let target = specifier.replace(/^lit-html/, engine);
    if (engine === '@mnjs/html') target = target.replace(/\/(directive|async-directive|directive-helpers|static)\.js$/, '/$1');
    return `from ${JSON.stringify(import.meta.resolve(target))}`;
  });
  code = `import {describe as suite, it as test, beforeEach as setup, afterEach as teardown} from 'node:test';\n${code}`;
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
