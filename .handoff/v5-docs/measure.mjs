import { readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const [pkg,input,output]=process.argv.slice(2);
const fixture=JSON.parse(await readFile(input,'utf8'));
const helper=resolve(pkg,'skills/marionette/scripts/docs.mjs');
const run=(mode,query)=>{
 const result=spawnSync(process.execPath,[helper,'--package-root',pkg,mode,query],{encoding:'utf8'});
 if(result.status!==0) throw Error(result.stderr);
 return {metadataBytes:Buffer.byteLength(result.stdout), result:JSON.parse(result.stdout)};
};
const manifest=JSON.parse(await readFile(resolve(pkg,'docs-manifest.json'),'utf8'));
const measured={sourceRevision:manifest.sourceRevision,sourceDirty:manifest.sourceDirty,contentSha256:manifest.contentSha256,symbols:[],questions:[]};
for(const query of fixture.symbols??[]) measured.symbols.push({query,...run('--symbol',query)});
for(const entry of fixture.questions){
 const query=entry.query;
 const found=run('--search',query);
 const sections=found.result.results;
 const locationRank=sections.findIndex(s=>entry.locations.includes(s.id));
 const content=await Promise.all(sections.map(async s=>{
  const index=JSON.parse(await readFile(resolve(pkg,'docs-sections.json'),'utf8'));
  const sec=index.sections.find(x=>x.id===s.id);
  const full=await readFile(resolve(pkg,sec.source),'utf8');
  const text=full.slice(sec.start,sec.end);
  return {id:s.id,selectedBytes:Buffer.byteLength(text),text};
 }));
 measured.questions.push({...entry,...found,locationRank:locationRank<0?null:locationRank+1,sections:content});
}
await writeFile(output,JSON.stringify(measured,null,2)+'\n');
console.log(JSON.stringify({questions:measured.questions.length,topFiveLocationHits:measured.questions.filter(q=>q.locationRank).length,symbols:measured.symbols.map(s=>({query:s.query,metadataBytes:s.metadataBytes}))},null,2));
