import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const packageName = process.argv[2];
if (packageName && !['data', 'adapters'].includes(packageName)) {
  throw new Error(`Unknown declaration package: ${packageName}`);
}
const packageRoot = packageName ? join(root, 'packages', packageName) : root;
const esm = join(packageRoot, 'dist/types/esm');
const cjs = join(packageRoot, 'dist/types/cjs');

rmSync(esm, { recursive: true, force: true });
rmSync(cjs, { recursive: true, force: true });
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
  '-p', join(packageRoot, 'tsconfig.declarations.json')], { stdio: 'inherit' });
if (!packageName) { cpSync(join(root, 'src/version.d.ts'), join(esm, 'version.d.ts')); }

// Published declarations use JavaScript imports in separate ESM and CommonJS scopes.
for (const entry of readdirSync(esm, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.d.ts')) { continue; }
  const path = join(entry.parentPath, entry.name);
  let contents = readFileSync(path, 'utf8');
  const imports = ts.preProcessFile(contents).importedFiles;
  for (const imported of imports.reverse()) {
    if (!imported.fileName.startsWith('.') || !imported.fileName.endsWith('.ts')) { continue; }
    const start = imported.pos + 1;
    if (contents.slice(start, start + imported.fileName.length) !== imported.fileName) {
      throw new Error(`Cannot locate declaration import in ${path}`);
    }
    contents = contents.slice(0, start) + imported.fileName.slice(0, -3) + '.js' +
      contents.slice(start + imported.fileName.length);
  }
  writeFileSync(path, contents);
}
mkdirSync(cjs, { recursive: true });
cpSync(esm, cjs, { recursive: true });
writeFileSync(join(cjs, 'package.json'), '{"type":"commonjs"}\n');

// Adapter CommonJS bundles export the value directly, unlike the named core/data
// bundles. Derive export assignments from the same emitted declarations.
if (packageName === 'adapters') {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  for (const entry of Object.values(manifest.exports)) {
    if (typeof entry !== 'object') { continue; }
    const path = join(packageRoot, entry.require.types);
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let exportedName;
    const statements = source.statements.flatMap(statement => {
      if (ts.isExportAssignment(statement)) {
        if (!ts.isIdentifier(statement.expression)) {
          throw new Error(`Expected a named adapter export in ${path}`);
        }
        exportedName = statement.expression.text;
        return [];
      }
      if (ts.isFunctionDeclaration(statement) && statement.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword
      )) {
        if (!statement.name) { throw new Error(`Expected a named adapter function in ${path}`); }
        exportedName = statement.name.text;
        return [ts.factory.updateFunctionDeclaration(statement,
          [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)], statement.asteriskToken,
          statement.name, statement.typeParameters, statement.parameters, statement.type, undefined)];
      }
      if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier &&
        statement.exportClause && ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.length === 0) { return []; }
      // Named option types belong to the ESM entry; CommonJS exports only the
      // adapter value. Keep its referenced types local to the declaration.
      if (ts.isInterfaceDeclaration(statement)) {
        return [ts.factory.updateInterfaceDeclaration(statement,
          statement.modifiers?.filter(modifier => modifier.kind !== ts.SyntaxKind.ExportKeyword),
          statement.name, statement.typeParameters, statement.heritageClauses, statement.members)];
      }
      return [statement];
    });
    if (!exportedName) { throw new Error(`Missing default adapter export in ${path}`); }
    statements.push(ts.factory.createExportAssignment(undefined, true,
      ts.factory.createIdentifier(exportedName)));
    writeFileSync(path, ts.createPrinter().printFile(ts.factory.updateSourceFile(source, statements)));
  }
}
