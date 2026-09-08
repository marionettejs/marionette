import { createServer } from 'node:http';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isWithin, prepareArtifacts, prepareAttempt, repositoryRoot } from './harness.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };

export async function createReferenceServer({ publicRoot, modules, imports }) {
  const publicBase = await realpath(publicRoot);
  const moduleBase = await realpath(modules);
  const importMap = JSON.stringify({ imports }).replace(/</g, '\\u003c');
  return createServer(async(request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const moduleRequest = pathname.startsWith('/modules/');
      const base = moduleRequest ? moduleBase : publicBase;
      const relativePath = moduleRequest ? pathname.slice('/modules/'.length) : (pathname === '/' ? 'app/index.html' : pathname.slice(1));
      if (relativePath.includes('\\') || relativePath.split('/').some(part => part === '.' || part === '..')) { throw new Error('Invalid path'); }
      const reference = relativePath.match(/^tasks\/([a-z-]+)\/reference\//);
      const allowed = moduleRequest ? base : (relativePath.startsWith('app/') ? join(base, 'app') : reference && join(base, 'tasks', reference[1], 'reference'));
      if (!allowed || await realpath(allowed) !== allowed) { throw new Error('Invalid serving root'); }
      const path = await realpath(resolve(base, relativePath));
      if (path === allowed || !isWithin(allowed, path)) { throw new Error('Path escapes serving root'); }
      let body = await readFile(path);
      if (!moduleRequest && relativePath === 'app/index.html') {
        body = Buffer.from(body.toString().replace('<!-- IMPORT_MAP -->', `<script type="importmap">${importMap}</script>`));
      }
      response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
    } catch { response.writeHead(404).end('Not found'); }
  });
}

async function prepareReferenceApp({ directory, manifestPath }) {
  const artifacts = await prepareArtifacts({ manifestPath, output: join(directory, 'artifacts') });
  const prepared = await prepareAttempt({ taskId: 'nested-workspace', artifacts, output: join(directory, 'consumer'), reference: true });
  const modules = join(prepared.workspace, 'node_modules');
  const imports = {};
  for (const entry of artifacts.packages) {
    const manifest = JSON.parse(await readFile(join(modules, entry.name, 'package.json'), 'utf8'));
    for (const [subpath, entrypoint] of Object.entries(manifest.exports)) {
      const path = entrypoint?.import?.default;
      if (path) {
        const specifier = subpath === '.' ? entry.name : `${entry.name}/${subpath.slice(2)}`;
        imports[specifier] = `/modules/${entry.name}/${path.replace(/^\.\//, '')}`;
      }
    }
  }
  return { publicRoot: join(repositoryRoot, 'benchmarks/agent'), modules, imports };
}

export async function startReferenceApp({ manifestPath = process.env.MARIONETTE_BROWSER_ARTIFACT_MANIFEST,
  port = 4178, temporaryRoot = tmpdir(), prepare = prepareReferenceApp } = {}) {
  const directory = await mkdtemp(join(temporaryRoot, 'marionette-reference-app-'));
  let server;
  const release = async() => {
    if (server) { await new Promise(done => server.close(done)); }
    await rm(directory, { recursive: true, force: true });
  };
  try {
    server = await createReferenceServer(await prepare({ directory, manifestPath }));
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.off('error', reject); done(); });
    });
    let closing;
    return { server, url: `http://127.0.0.1:${server.address().port}`, close: () => closing ||= release() };
  } catch (error) {
    await release();
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const app = await startReferenceApp({ manifestPath: option('--manifest'), port: Number(option('--port') || 4178) });
  console.log(`Reference app: ${app.url}`);
  const close = () => app.close().catch(error => { console.error(error); process.exitCode = 1; });
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
