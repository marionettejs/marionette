import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { parseArgs } from 'node:util';
import ts from 'typescript';

const repository = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: { root: { type: 'string', default: repository } } });
const root = resolve(values.root);
const roots = ['test/unit', 'test/types', 'test/browser', 'test/fixtures', 'test/contracts', 'test/setup', 'benchmarks/agent'];
const failures = [];
const intrinsicNames = new Set(['__proto__']);

function isPrivate(name) {
  return /^_[A-Za-z_$][\w$]*$/.test(name) && !intrinsicNames.has(name);
}

async function checkFile(file) {
  const text = await readFile(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function reject(node, reason) {
    const location = source.getLineAndCharacterOfPosition(node.getStart(source));
    failures.push(`${relative(root, file)}:${location.line + 1}:${location.character + 1}: ${reason}`);
  }
  function visit(node) {
    if ((ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) &&
        node.name && ts.isIdentifier(node.name) && isPrivate(node.name.text)) {
      reject(node, `Private override ${node.name.text}; exercise the public owner instead.`);
    }
    if (ts.isPropertyAccessExpression(node) && isPrivate(node.name.text)) {
      reject(node, `Private member ${node.name.text}; assert a public outcome instead.`);
    }
    if (ts.isStringLiteralLike(node)) {
      if (isPrivate(node.text)) {
        reject(node, `Private member name ${node.text}; use public contracts and consumer-owned names.`);
      }
      if ((ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) ||
          (ts.isCallExpression(node.parent) && node.parent.expression.kind === ts.SyntaxKind.ImportKeyword)) &&
          /(?:^|\/)src\/|types-internal\//.test(node.text)) {
        reject(node, `Internal source import ${node.text}; import a supported package entrypoint.`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') { return []; }
    throw error;
  });
  for (const entry of entries) {
    if (['node_modules', 'dist', 'tmp'].includes(entry.name)) { continue; }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { await walk(path); } else if (/\.(?:[cm]?[jt]s|tsx)$/.test(entry.name)) { await checkFile(path); }
  }
}

for (const directory of roots) { await walk(resolve(root, directory)); }
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Public-contract test boundary verified. Review remains responsible for indirect private access.');
}
