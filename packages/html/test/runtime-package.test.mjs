import './setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {rollup} from 'rollup';
const packagePath = path => relative(process.cwd(), path).replaceAll('\\', '/');

test('runtime-only package has no compiler entries and keeps unused APIs tree-shakable',async()=>{
  const pkg=JSON.parse(await readFile('package.json','utf8'));
  assert.ok(!Object.keys(pkg.exports).some(name=>name.includes('compiled')));
  for(const [name,source]of[
    ['ordinary',`export {html,render} from '@mnjs/html';`],
    ['html-and-dom',`export {html} from '@mnjs/html';export {default as DomApi} from '@mnjs/html/marionette';`],
    ['static',`export {html} from '@mnjs/html/static';`],
    ['trusted-markup',`export {unsafeHTML} from '@mnjs/html/directives/unsafe-html.js';`],
  ]){
    const bundle=await rollup({input:'\0entry',plugins:[{
      name:'public-package-exports',
      resolveId(id,importer){
        if(id==='\0entry')return id;
        const resolution=path=>({id:path,moduleSideEffects:pkg.sideEffects.includes(`./${packagePath(path)}`)});
        if(id==='@mnjs/html'||id.startsWith('@mnjs/html/')){
          const entry=pkg.exports[id==='@mnjs/html'?'.':`.${id.slice('@mnjs/html'.length)}`];
          assert.ok(entry,`Unknown public import ${id}`);return resolution(resolve(typeof entry==='string'?entry:entry.default));
        }
        if(id.startsWith('.')&&importer!=='\0entry')return resolution(resolve(dirname(importer),id));
      },load(id){if(id==='\0entry')return source;},
    }]});
    try{
      const {output}=await bundle.generate({format:'es'});
      const modules=Object.keys(output[0].modules).map(packagePath);
      assert.ok(modules.some(id=>id.endsWith('dist/template.js')),name);
      assert.equal(modules.some(id=>/compiler|compiled-template|typescript|parse5/.test(id)),false,name);
      if(name==='html-and-dom')for(const unused of ['svg','mathml','render'])
        assert.ok(output[0].modules[resolve('dist/renderer.js')].removedExports.includes(unused),`${unused} should tree-shake`);
    }finally{await bundle.close();}
  }
});
