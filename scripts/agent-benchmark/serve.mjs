import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { prepareArtifacts, prepareAttempt, repositoryRoot } from './harness.mjs';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name);return index < 0 ? undefined : args[index + 1]; };
const directory = await mkdtemp(join(tmpdir(), 'marionette-reference-app-'));
const artifacts = await prepareArtifacts({ manifestPath: option('--manifest'), output: join(directory,'artifacts') });
const prepared = await prepareAttempt({ taskId: 'nested-workspace', artifacts, output: join(directory,'consumer'), reference: true });
const publicRoot = resolve(repositoryRoot,'benchmarks/agent');
const modules = join(prepared.workspace,'node_modules');
const imports = {};
for (const entry of artifacts.packages) {
  const manifest = JSON.parse(await readFile(join(modules,entry.name,'package.json'),'utf8'));
  for (const [subpath, entrypoint] of Object.entries(manifest.exports)) {
    const path = entrypoint?.import?.default;
    if (path) {
      const specifier = subpath === '.' ? entry.name : `${entry.name}/${subpath.slice(2)}`;
      imports[specifier] = `/modules/${entry.name}/${path.replace(/^\.\//, '')}`;
    }
  }
}
const mime = {'.html': 'text/html; charset=utf-8','.mjs': 'text/javascript','.js': 'text/javascript','.css': 'text/css'};
const server = createServer(async(request,response)=>{
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const moduleRequest = pathname.startsWith('/modules/');
    const base = moduleRequest ? modules : publicRoot;
    const relativePath = moduleRequest ? pathname.slice('/modules/'.length) : (pathname === '/' ? 'app/index.html' : pathname.slice(1));
    const path = resolve(base,relativePath);
    if (!path.startsWith(`${base}${sep}`) || (!moduleRequest && !relativePath.startsWith('app/') && !/^tasks\/[a-z-]+\/reference\//.test(relativePath))) {response.writeHead(404).end();return;}
    let body = await readFile(path);
    if (path.endsWith('index.html')) {body = Buffer.from(body.toString().replace('<!-- IMPORT_MAP -->',`<script type="importmap">${JSON.stringify({imports})}</script>`));}
    response.writeHead(200,{'Content-Type': mime[extname(path)] || 'application/octet-stream','Cache-Control': 'no-store'}).end(body);
  } catch {response.writeHead(404).end('Not found');}
});
server.listen(Number(option('--port') || 4178),'127.0.0.1',()=>console.log(`Reference app: http://127.0.0.1:${server.address().port}`));
let closing = false;
async function close() {if (closing) {return;}closing = true;server.close();await rm(directory,{recursive: true,force: true});process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
