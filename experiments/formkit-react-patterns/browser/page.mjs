import {mountReference,mountCurrent} from '../harness/reference.mjs';
import {mount as mountExperiment} from '../core/index.mjs';
import {fields,classes,values} from '../harness/fixtures.mjs';
const host = document.querySelector('#host'),output = document.querySelector('#result');let api;
const arm = new URL(location.href).searchParams.get('arm') || 'experiment';const count = Number(new URL(location.href).searchParams.get('count') || 20);
document.querySelector('#setup').textContent = JSON.stringify({arm,count,mode: 'correctness preflight, no timing samples'});
const pause = ()=>new Promise(r=>setTimeout(r,5));async function until(check) {for (let i = 0;i < 800;i++) {if (check()) {return;} await pause()} throw Error('settlement timeout')}
document.querySelector('#mount').onclick = async()=>{try {api?.destroy();api = arm === 'experiment' ? mountExperiment({host,count,fields: fields(count),classes,values: values(count)}) : arm === 'current' ? await mountCurrent(host,count) : await mountReference(arm,host,count);await until(()=>api.node.isSettled && host.querySelectorAll('input').length === count);output.textContent = JSON.stringify({status: 'mounted',arm,count,inputs: host.querySelectorAll('input').length,required: api.node.children.filter(n=>n.store.rule_required).length});} catch (e) {output.textContent = JSON.stringify({status: 'FAIL',error: e.stack})}};
document.querySelector('#check').onclick = async()=>{await pause();output.textContent = JSON.stringify({status: 'checked',arm,count,values: api.node.value,required: api.node.children.filter(n=>n.store.rule_required).length,inputs: host.querySelectorAll('input').length})};
document.querySelector('#reset').onclick = async()=>{api.reset();await until(()=>Object.values(api.node.value).every(v=>v === ''));output.textContent = JSON.stringify({status: 'reset',arm,count})};
document.querySelector('#destroy').onclick = ()=>{api.destroy();output.textContent = JSON.stringify({status: 'destroyed',inputs: host.querySelectorAll('input').length})};
