import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

export const packageRoots = ['', 'packages/utils', 'packages/radio', 'packages/data', 'packages/adapters'];
const digest = text => createHash('sha256').update(text).digest('hex');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const toolingSubpaths = new Set(['marionette/eslint']);
const sorted = values => [...values].sort((a, b) => a.localeCompare(b, 'en'));
// TypeScript exposes SymbolFlags as a bit field.
// eslint-disable-next-line no-bitwise
const hasFlag = (symbol, flag) => Boolean(symbol.flags & flag);
const publicName = name => !name.startsWith('_') && !name.startsWith('__@') && name !== 'prototype';

export function publicEntrypoints(root) {
  return packageRoots.flatMap(directory => {
    const pkg = readJson(resolve(root, directory, 'package.json'));
    return Object.entries(pkg.exports).filter(([key]) => key !== './package.json').map(([key, entry]) => {
      const name = pkg.name + (key === '.' ? '' : key.slice(1));
      if (toolingSubpaths.has(name)) { return { name, kind: 'development-tooling', conditions: entry }; }
      if (!entry.import?.types || !entry.require?.types) {
        throw new Error(`Missing public declarations: ${pkg.name}${key}`);
      }
      const source = entry.import.types.replace('./dist/types/esm/', 'src/').replace(/\.d\.ts$/, '.ts');
      return { name, version: pkg.version, kind: 'runtime', source: [directory, source].filter(Boolean).join('/'),
        conditions: entry };
    });
  });
}

export function collectTestTitles(source, file = 'test.js') {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const titles = new Map();
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        ['it', 'test'].includes(node.expression.text) && node.arguments.length >= 2 &&
        (ts.isFunctionExpression(node.arguments.at(-1)) || ts.isArrowFunction(node.arguments.at(-1))) &&
        (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) {
      const title = node.arguments[0].text;
      const entries = titles.get(title) || [];
      entries.push(digest(node.getText(parsed)));
      titles.set(title, entries);
    }
    if (ts.isObjectLiteralExpression(node)) {
      const name = node.properties.find(property => property.name?.getText(parsed) === 'name');
      const run = node.properties.find(property => property.name?.getText(parsed) === 'run');
      if (name && ts.isPropertyAssignment(name) && run && ts.isMethodDeclaration(run) &&
          (ts.isStringLiteral(name.initializer) || ts.isTemplateExpression(name.initializer))) {
        const title = ts.isStringLiteral(name.initializer) ? name.initializer.text : name.initializer.getText(parsed).slice(1, -1);
        const entries = titles.get(title) || [];
        entries.push(digest(run.getText(parsed)));
        titles.set(title, entries);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return titles;
}

export function validateSemantics(root, semantics, entrypoints) {
  const ids = new Set();
  const evidence = { 'config/diagnostics/catalog.json': digest(readFileSync(resolve(root, 'config/diagnostics/catalog.json'))) };
  const names = new Set(entrypoints.map(entry => entry.name));
  const diagnostics = new Set(readJson(resolve(root, 'config/diagnostics/catalog.json')).diagnostics
    .filter(item => item.status === 'active').map(item => item.code));
  for (const contract of semantics.contracts) {
    if (!contract.id || ids.has(contract.id)) { throw new Error(`Duplicate or missing contract id: ${contract.id}`); }
    ids.add(contract.id);
    for (const field of ['result', 'timing', 'ownership', 'mutation', 'repetition', 'destruction']) {
      if (typeof contract[field] !== 'string' || !contract[field].trim()) {
        throw new Error(`Missing ${field}: ${contract.id}`);
      }
    }
    if (!contract.entrypoints?.length || contract.entrypoints.some(name => !names.has(name)) ||
        !contract.exports?.length || !contract.docs?.length || !contract.tests?.length || !Array.isArray(contract.diagnostics)) {
      throw new Error(`Incomplete references: ${contract.id}`);
    }
    for (const code of contract.diagnostics) {
      if (!diagnostics.has(code)) { throw new Error(`Unknown or retired diagnostic ${code}: ${contract.id}`); }
    }
    for (const doc of contract.docs) {
      const text = readFileSync(resolve(root, doc.file), 'utf8');
      const heading = text.split('\n').findIndex(line => /^#{1,6} /.test(line) && line.replace(/^#+ /, '').trim() === doc.heading);
      if (heading < 0) { throw new Error(`Missing documentation heading: ${doc.file} ${doc.heading}`); }
      evidence[doc.file] = digest(text);
    }
    for (const test of contract.tests) {
      const source = readFileSync(resolve(root, test.file), 'utf8');
      const matches = collectTestTitles(source, test.file).get(test.title);
      if (!matches || matches.length !== 1) { throw new Error(`Missing or ambiguous public test: ${test.file} ${test.title}`); }
      // Hash the whole fixture too: setup/helpers can change an otherwise identical assertion.
      evidence[test.file] = digest(source);
      if (test.runner) {
        const runner = readFileSync(resolve(root, test.runner), 'utf8');
        const runnerAst = ts.createSourceFile(test.runner, runner, ts.ScriptTarget.Latest, true);
        const importedCases = new Set(runnerAst.statements.filter(node => ts.isImportDeclaration(node) &&
          resolve(root, test.runner, '..', node.moduleSpecifier.text) === resolve(root, test.file))
          .flatMap(node => node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) ?
            node.importClause.namedBindings.elements.map(binding => binding.name.text) : []));
        const registersCase = runnerAst.statements.some(loop => {
          if (!ts.isForOfStatement(loop) || !ts.isIdentifier(loop.expression) ||
              !importedCases.has(loop.expression.text) || !ts.isVariableDeclarationList(loop.initializer) ||
              loop.initializer.declarations.length !== 1 || !ts.isBlock(loop.statement)) { return false; }
          const binding = loop.initializer.declarations[0].name;
          if (!ts.isObjectBindingPattern(binding)) { return false; }
          const bindings = new Map(binding.elements.filter(element => ts.isIdentifier(element.name))
            .map(element => [element.propertyName?.getText(runnerAst) || element.name.text, element.name.text]));
          return loop.statement.statements.some(statement => ts.isExpressionStatement(statement) &&
            ts.isCallExpression(statement.expression) && ts.isIdentifier(statement.expression.expression) &&
            statement.expression.expression.text === 'it' && statement.expression.arguments.length === 2 &&
            statement.expression.arguments.every(ts.isIdentifier) &&
            statement.expression.arguments[0].text === bindings.get('name') &&
            statement.expression.arguments[1].text === bindings.get('run'));
        });
        if (!registersCase) { throw new Error(`Missing shared-case registration: ${test.runner}`); }
        evidence[test.runner] = digest(runner);
      }
    }
  }
  return evidence;
}

export function generateInventory(root, semantics) {
  const entrypoints = publicEntrypoints(root);
  const evidence = validateSemantics(root, semantics, entrypoints);
  const configPath = resolve(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const errors = [...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()];
  if (errors.length) {
    throw new Error(`Cannot inventory invalid TypeScript: ${ts.flattenDiagnosticMessageText(errors[0].messageText, ' ')}`);
  }
  const checker = program.getTypeChecker();
  const localPath = file => relative(root, file).replaceAll('\\', '/');
  const flags = ts.TypeFormatFlags.NoTruncation;
  const format = type => checker.typeToString(type, undefined, flags)
    .replaceAll(root + '/', '').replaceAll(root.replaceAll('\\', '/') + '/', '');
  function members(type) {
    return Object.fromEntries(checker.getPropertiesOfType(type).filter(symbol => publicName(symbol.name) &&
      symbol.declarations?.some(node => /^(src|packages\/[^/]+\/src)\//.test(localPath(node.getSourceFile().fileName))))
      .sort((a, b) => a.name.localeCompare(b.name, 'en')).map(symbol => {
        const declaration = symbol.valueDeclaration || symbol.declarations?.[0];
        const value = checker.getTypeOfSymbolAtLocation(symbol, declaration);
        return [symbol.name, `${hasFlag(symbol, ts.SymbolFlags.Optional) ? '?' : ''}${format(value)}`];
      }));
  }
  function callableNames(type) {
    const fields = members(type);
    return Object.keys(fields).filter(name => {
      const property = type.getProperty(name);
      return checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(property,
        property.valueDeclaration || property.declarations[0])).getCallSignatures().length > 0;
    });
  }
  const matched = new Set();
  const matchedMembers = new Map();
  const surfaces = entrypoints.filter(entry => entry.kind === 'runtime').map(entry => {
    const source = program.getSourceFile(resolve(root, entry.source));
    if (!source) { throw new Error(`Missing public source: ${entry.source}`); }
    const module = checker.getSymbolAtLocation(source);
    const exports = checker.getExportsOfModule(module).sort((a, b) => a.name.localeCompare(b.name, 'en')).map(symbol => {
      const target = hasFlag(symbol, ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(symbol) : symbol;
      const typeOnly = symbol.declarations?.some(node => ts.isExportSpecifier(node) &&
        (node.isTypeOnly || node.parent.parent.isTypeOnly));
      const isValue = !typeOnly && hasFlag(target, ts.SymbolFlags.Value);
      const declaration = target.valueDeclaration || target.declarations[0];
      const type = isValue ? checker.getTypeOfSymbolAtLocation(target, declaration) : checker.getDeclaredTypeOfSymbol(target);
      const contracts = semantics.contracts.filter(contract => contract.entrypoints.includes(entry.name) &&
        (contract.kind || 'value') === (isValue ? 'value' : 'type') &&
        (contract.exports.includes('*') || contract.exports.includes(symbol.name)));
      if (!contracts.length) { throw new Error(`Unmapped public export: ${entry.name}#${symbol.name}`); }
      for (const contract of contracts) { matched.add(contract.id); }
      const record = { name: symbol.name, kind: isValue ? 'value' : 'type', signature: format(type),
        contracts: contracts.map(contract => contract.id) };
      const properties = members(type);
      if (Object.keys(properties).length) {
        record.members = properties;
        record.callableMembers = callableNames(type);
      }
      const constructs = type.getConstructSignatures();
      if (constructs.length) {
        record.construct = constructs.map(signature => checker.signatureToString(signature, undefined, flags));
        const prototype = type.getProperty('prototype');
        const instance = prototype ? checker.getTypeOfSymbolAtLocation(prototype, declaration) :
          checker.getReturnTypeOfSignature(constructs[0]);
        record.instance = members(instance);
        record.callableInstanceMembers = callableNames(instance);
        const children = instance.getProperty('children');
        if (children) {
          const childType = checker.getTypeOfSymbolAtLocation(children, declaration);
          record.protocols = { children: members(childType) };
        }
      }
      const calls = type.getCallSignatures();
      if (calls.length) {
        record.call = calls.map(signature => checker.signatureToString(signature, undefined, flags));
        // Adapter factories return protocols that need their own method inventory.
        if (entry.name.startsWith('@mnjs/adapters')) {
          record.returns = calls.map(signature => members(checker.getReturnTypeOfSignature(signature)));
        }
      }
      for (const contract of contracts.filter(item => item.members)) {
        const available = new Set([...Object.keys(properties), ...Object.keys(record.instance || {}),
          ...(record.returns || []).flatMap(value => Object.keys(value))]);
        const known = matchedMembers.get(contract.id) || new Set();
        for (const member of contract.members.filter(name => available.has(name))) { known.add(member); }
        matchedMembers.set(contract.id, known);
        if (!contract.members.some(member => available.has(member))) {
          throw new Error(`No matching members for ${contract.id} on ${entry.name}#${symbol.name}`);
        }
      }
      record.operationContracts = Object.fromEntries([
        ['static', record.callableMembers || []], ['instance', record.callableInstanceMembers || []]
      ].filter(([, names]) => names.length).map(([placement, names]) => [placement,
        Object.fromEntries(names.map(name => [name, contracts.filter(contract =>
          !contract.members || contract.members.includes(name)).map(contract => contract.id)]))]));
      return record;
    });
    return { ...entry, exports };
  });
  for (const contract of semantics.contracts) {
    if (!matched.has(contract.id)) { throw new Error(`Unused contract: ${contract.id}`); }
    for (const member of contract.members || []) {
      if (!matchedMembers.get(contract.id)?.has(member)) {
        throw new Error(`Unknown semantic member: ${contract.id}.${member}`);
      }
    }
  }
  const sources = Object.fromEntries(program.getSourceFiles().filter(file =>
    !file.isDeclarationFile && /^(src|packages\/[^/]+\/src)\//.test(localPath(file.fileName)))
    .map(file => [localPath(file.fileName), digest(file.text)]).sort(([a], [b]) => a.localeCompare(b, 'en')));
  const eventSites = [];
  for (const source of program.getSourceFiles().filter(file => sources[localPath(file.fileName)])) {
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          ['trigger', 'triggerMethod'].includes(node.expression.name.text) && node.arguments.length) {
        const first = node.arguments[0];
        eventSites.push({ source: localPath(source.fileName), event: first.getText(source),
          kind: ts.isStringLiteral(first) ? 'literal' : 'dynamic',
          arguments: node.arguments.slice(1).map(argument => argument.getText(source)) });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return { schemaVersion: 1, authority: 'authored TypeScript and explicit public behavioral evidence',
    semanticsSha256: digest(JSON.stringify(semantics)), entrypoints: surfaces,
    diagnostics: readJson(resolve(root, 'config/diagnostics/catalog.json')).diagnostics
      .filter(item => item.status === 'active').map(({ code, slug, objects }) => ({ code, slug, objects })),
    toolingEntrypoints: entrypoints.filter(entry => entry.kind === 'development-tooling'),
    eventSites, sources, evidence: Object.fromEntries(sorted(Object.keys(evidence)).map(file => [file, evidence[file]])) };
}
