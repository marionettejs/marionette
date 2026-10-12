import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Region, CollectionView } from 'marionette';
import { FormView, FieldView, RowView } from '@mnjs/formkit';
import { Collection, DataApi } from '@mnjs/data';
import { getNode, createNode } from '@formkit/core';

const owners = [];
const drain = async() => { for (let i = 0; i < 30; i++) { await Promise.resolve(); } };
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); document.body.replaceChildren(); });
class ContactRow extends RowView {
  constructor(options) {
    super({template: ()=>'<fieldset><div data-name></div><div data-detail></div></fieldset>',
      regions: {name: '[data-name]',detail: '[data-detail]'},...options});
  }
  onRender() {
    this.showChildView('name',new FieldView({form: this.options.form,parent: this.node,name: 'name',removal: 'preserve',
      input: {type: 'text',label: 'Name',validation: 'required',config: {delay: 35}}}));
    if (this.options.detail !== false) {this.mountDetail();}
  }
  mountDetail() {
    this.showChildView('detail',new FieldView({form: this.options.form,parent: this.node,name: 'detail',removal: this.options.detailRemoval ?? 'preserve',
      input: {type: 'text',label: 'Detail',value: 'Authored default'}}));
  }
}
async function fixture({values = [{id: 'a',name: 'Alpha',detail: 'A detail'},{id: 'b',name: 'Beta',detail: 'B detail'}],listRemoval = 'clear'} = {}) {
  const form = new FormView({values: {contacts: values},template: ()=>'<div data-list></div><div data-elsewhere></div>',
    regions: {list: '[data-list]',elsewhere: '[data-elsewhere]'}});
  const owner = new Region({el: document.body.appendChild(document.createElement('div'))});owners.push(owner);owner.show(form);
  const list = new FieldView({form,name: 'contacts',removal: listRemoval,input: {type: 'list',dynamic: true,itemKey: 'id',
    slots: {default: ()=>({$el: 'div',attrs: {'data-rows': ''}})}},regions: {rows: '[data-rows]'}});
  form.showChildView('list',list);
  const display = new CollectionView();list.showChildView('rows',display);
  await drain();
  const row = (key,options = {})=>{
    const view = new ContactRow({form,parent: list.node,rowKey: key,removal: 'preserve',...options});display.addChildView(view);return view;
  };
  return {form,owner,list,display,row};
}
function input(row,name = 'name') {return row.getChildView(name).el.querySelector('input');}
async function edit(row,value,name = 'name') {
  const control = input(row,name);control.value = value;control.dispatchEvent(new Event('input',{bubbles: true}));
  await row.getChildView(name).node.settled;await drain();return control;
}


it('genuine Core row groups mount in reverse order and native edits collect as an array',async()=>{
  const {form,row} = await fixture();const b = row('b'); const a = row('a');await drain();
  assert.equal(a.node.index,0);assert.equal(b.node.index,1);
  await edit(b,'Edited beta');assert.deepEqual(form.getValues().contacts.map(x=>x.name),['Alpha','Edited beta']);
});
it('authoritative keyed reorder retains live groups and controls, independent of display order',async()=>{
  const {form,row,display} = await fixture();const a = row('a'); const b = row('b');await drain();
  const an = a.node; const bn = b.node; const ac = input(a); const bc = input(b);
  form.setValues({contacts: [...form.getValues().contacts].reverse()},{notify: false});await drain();
  assert.equal(a.node,an);assert.equal(b.node,bn);assert.equal(a.node.index,1);assert.equal(b.node.index,0);
  assert.equal(input(a),ac);assert.equal(input(b),bc);assert.equal(ac.value,'Alpha');assert.equal(bc.value,'Beta');
  display.swapChildViews(a,b);assert.equal(a.node.index,1);assert.equal(b.node.index,0);
  await edit(a,'After reorder');assert.deepEqual(form.getValues().contacts.map(x=>x.name),['Beta','After reorder']);
});
it('preserved row teardown ends validation and remount restores the committed object',async()=>{
  const {form,row,display} = await fixture();const a = row('a'); const b = row('b');await edit(a,'');
  assert.equal(await form.submit(),'invalid');const id = input(a).id;
  display.removeChildView(a);await drain();assert.equal(getNode(id),undefined);
  assert.equal(form.getValues().contacts[0].name,'');assert.equal(await form.submit(),'success');
  const remount = row('a');await drain();assert.equal(input(remount).value,'');assert.equal(await form.submit(),'invalid');
  assert.equal(b.node.value.name,'Beta');
});
it('whole row clear below a non-preserved list keeps a sibling delayed native draft',async()=>{
  const {form,row,display} = await fixture();const a = row('a',{removal: 'clear'}); const b = row('b');
  const control = input(b);control.value = 'Pending beta';control.dispatchEvent(new Event('input',{bubbles: true}));
  assert.equal(b.getChildView('name').node.isSettled,false);
  display.removeChildView(a);await b.getChildView('name').node.settled;await drain();
  assert.deepEqual(form.getValues().contacts,[{id: 'b',name: 'Pending beta',detail: 'B detail'}]);
});
it('delayed first render resolves the current keyed index and root teardown ends detached row Views',async()=>{
  const {form,row,display,owner,list} = await fixture();const a = row('a');
  const b = new ContactRow({form,parent: list.node,rowKey: 'b',removal: 'preserve'});
  form.setValues({contacts: [...form.getValues().contacts].reverse()},{notify: false});display.addChildView(b);await drain();
  assert.equal(b.node.index,0);assert.equal(input(b).value,'Beta');
  display.detachChildView(b);assert.equal(b.isDestroyed(),false);const id = input(b).id;
  owner.destroy();assert.equal(a.isDestroyed(),true);assert.equal(b.isDestroyed(),true);assert.equal(getNode(id),undefined);
});
it('same-membership bare reset retains row controls and restores construction values',async()=>{
  const {form,row} = await fixture();const a = row('a'); const b = row('b');const ac = input(a); const bc = input(b);
  form.setValues({contacts: [...form.getValues().contacts].reverse()},{notify: false});await edit(a,'Edited');
  form.resetForm();await drain();assert.deepEqual(form.getValues().contacts.map(x=>x.name),['Alpha','Beta']);
  assert.equal(input(a),ac);assert.equal(input(b),bc);assert.equal(ac.value,'Alpha');assert.equal(bc.value,'Beta');
});
it('intermediate CollectionView destruction releases all row controls while preserving values',async()=>{
  const {form,row,display} = await fixture();const a = row('a'); const b = row('b');const ids = [input(a).id,input(b).id];
  display.destroy();await drain();assert.equal(a.isDestroyed(),true);assert.equal(b.isDestroyed(),true);
  assert.deepEqual(form.getValues().contacts.map(x=>x.name),['Alpha','Beta']);ids.forEach(id=>assert.equal(getNode(id),undefined));
});


it('a cleared descendant of a never clears b after keyed array reorder',async()=>{
  const {form,row} = await fixture();const a = row('a',{detailRemoval: 'clear'}); const b = row('b');
  a.getRegion('detail').empty();await drain();
  const snapshot = form.getValues().contacts;form.setValues({contacts: [...snapshot].reverse()},{notify: false});await drain();

  assert.equal(form.getValues().contacts.find(x=>x.id === 'b').detail,'B detail');
  assert.equal('detail' in form.getValues().contacts.find(x=>x.id === 'a'),false);
  assert.equal(input(b,'detail').value,'B detail');
});
it('cleared leaf remount after reorder restores its own original row baseline',async()=>{
  const {form,row} = await fixture();const a = row('a',{detailRemoval: 'clear'});row('b');
  form.setValues({contacts: [...form.getValues().contacts].reverse()},{notify: false});await drain();
  a.getRegion('detail').empty();await drain();a.mountDetail();await drain();

  assert.equal(a.getChildView('detail').getValue(),'A detail');
});
it('owning list FieldView setValue preserves the same keyed row identity as form setValues',async()=>{
  const {form,list,row} = await fixture();const a = row('a'); const b = row('b');const ac = input(a); const bc = input(b);
  list.setValue([...form.getValues().contacts].reverse(),{notify: false});await drain();

  assert.equal(a.node.value.id,'a');assert.equal(b.node.value.id,'b');
  assert.equal(input(a),ac);assert.equal(input(b),bc);assert.equal(ac.value,'Alpha');assert.equal(bc.value,'Beta');
});
it('clear row destruction splices exactly that row under a preserved list',async()=>{
  const {form,row,display} = await fixture({listRemoval: 'preserve'});const a = row('a',{removal: 'clear'});row('b');
  display.removeChildView(a);await drain();
  assert.deepEqual(form.getValues().contacts.map(x=>x.id),['b']);
});
it('preserved row teardown does not redirect a surviving sibling edit into the missing node slot',async()=>{
  const {form,row,display} = await fixture();const a = row('a'); const b = row('b');display.removeChildView(a);await drain();
  await edit(b,'Edited beta');
  assert.deepEqual(form.getValues().contacts.map(x=>[x.id,x.name]),[['a','Alpha'],['b','Edited beta']]);
});
it('authoritative replacement of a row key ends the old row View instead of reusing its group',async()=>{
  const {form,row} = await fixture();const a = row('a');row('b');
  form.setValues({contacts: [{id: 'c',name: 'Gamma',detail: 'C detail'},form.getValues().contacts[1]]},{notify: false});await drain();

  assert.equal(a.isDestroyed(),true);assert.equal(form.getValues().contacts[0].id,'c');
});

class Rows extends CollectionView {}
Rows.setDataApi(DataApi);
async function displayed(values,options = {}) {
  const f = await fixture({values});
  const collection = new Collection(values);const views = [];
  const display = new Rows({collection,childView: ContactRow,
    childViewOptions(model) {return {form: f.form,parent: f.list.node,rowKey: model.id,removal: 'preserve'};},
    ...options});
  display.on('add:child',(_owner,view)=>views.push(view));f.list.showChildView('rows',display);await drain();
  return {...f,display,collection,views,byKey: key=>views.findLast(view=>view.options.rowKey === key && !view.isDestroyed())};
}
it('observable collection display reorder, filter and rebuild preserve values and retained groups',async()=>{
  const values = [{id: 'a',name: 'Alpha',detail: 'A detail'},{id: 'b',name: 'Beta',detail: 'B detail'}];
  const {form,list,display,collection,byKey} = await displayed(values);
  const a = byKey('a'); const b = byKey('b'); const an = a.node; const bn = b.node; const ac = input(a); const bc = input(b);
  collection.move('b',0);await drain();assert.equal(display.el.firstElementChild,b.el);
  assert.equal(input(a),ac);assert.equal(input(b),bc);assert.equal(an.index,0);assert.equal(bn.index,1);
  display.setFilter(view=>view.options.rowKey === 'a');assert.equal(b.isDestroyed(),false);assert.equal(b.isAttached(),false);
  display.removeFilter();assert.equal(input(b),bc);
  display.render();await drain();
  assert.equal(a.isDestroyed(),true);assert.equal(b.isDestroyed(),true);
  assert.equal(byKey('a').node,an);assert.equal(byKey('b').node,bn);
  assert.deepEqual(form.getValues().contacts,values);
  collection.remove('a');await drain();assert.equal(byKey('a'),undefined);
  await edit(byKey('b'),'Beta after removal');
  assert.deepEqual(form.getValues().contacts.map(x=>x.name),['Alpha','Beta after removal']);
  const aId = an.props.id; const bId = bn.props.id;list.destroy();
  assert.equal(getNode(aId),undefined);assert.equal(getNode(bId),undefined);
});
it('first-render validation is lazy but filtering an already rendered row keeps its validation',async()=>{
  const {form,display,byKey} = await displayed([{id: 'a',name: 'Alpha'},{id: 'b',name: ''}],
    {viewFilter: view=>view.options.rowKey === 'a'});
  const b = byKey('b');assert.equal(b.isRendered(),false);assert.equal(await form.submit(),'success');
  display.removeFilter();await drain();assert.equal(b.isRendered(),true);assert.equal(await form.submit(),'invalid');
  display.setFilter(view=>view.options.rowKey === 'a');await drain();
  assert.equal(b.isDestroyed(),false);assert.equal(b.isAttached(),false);assert.equal(await form.submit(),'invalid');
});
it('duplicate placement rejects and preserved row retains group errors until list ownership ends',async()=>{
  const {form,list,row,display} = await fixture();const a = row('a');row('b');await drain();
  const duplicate = new ContactRow({form,parent: list.node,rowKey: 'a',removal: 'preserve'});
  assert.throws(()=>duplicate.render(),/already mounted/);duplicate.destroy();
  const group = a.node;const id = group.props.id;
  group.props.validationRules = {review: ()=>false};group.props.validation = 'review';
  await group.ledger.settled('validating');
  group.setErrors(['Review this row']);
  display.removeChildView(a);await drain();assert.equal(getNode(id),group);
  assert.equal(group.context.state.errors,true);
  assert.equal(await form.submit(),'invalid');
  const remount = row('a');assert.equal(remount.node,group);
  list.destroy();assert.equal(getNode(id),undefined);assert.equal(remount.isDestroyed(),true);
});

it('clear teardown is terminal data deletion and cannot rebuild from an unchanged collection',async()=>{
  const values = [{id: 'a',name: 'Alpha'},{id: 'b',name: 'Beta'}];
  const f = await fixture({values});const collection = new Collection(values);
  const display = new Rows({collection,childView: ContactRow,
    childViewOptions: model=>({form: f.form,parent: f.list.node,rowKey: model.id,removal: 'clear'})});
  f.list.showChildView('rows',display);await drain();
  assert.throws(()=>display.render(),/Row key must already exist/);
  assert.deepEqual(f.form.getValues().contacts,[]);
});

it('mounting a newly added array row does not append it to the construction reset baseline',async()=>{
  const {form,row} = await fixture();row('a');row('b');const initial = form.getValues();
  form.setValues({contacts: [...initial.contacts,{id: 'c',name: 'Gamma',detail: 'C detail'}]},{notify: false});row('c');await drain();
  form.resetForm();await drain();
  assert.deepEqual(form.getValues(),initial);
});

it('root and list silent projections retain row widgets without callbacks; native field edits retain user origin',async()=>{
  const {form,list,row} = await fixture();const a = row('a'); const b = row('b'); const ac = input(a);await drain();
  const events = [];form.on('form:change',(_values,_form,meta)=>events.push(meta));
  form.setValues({contacts: [...form.getValues().contacts].reverse()},{notify: false});await drain();
  list.setValue([...form.getValues().contacts].reverse(),{notify: false});await drain();
  assert.equal(events.length,0);assert.equal(input(a),ac);assert.equal(a.node.value.id,'a');assert.equal(b.node.value.id,'b');
  await edit(a,'Edited');assert.ok(events.length);assert.ok(events.every(event=>event.source === 'user'));
});
it('force clear beneath preserved list keeps actual delayed sibling draft',async()=>{
  const {form,row,display} = await fixture({listRemoval: 'preserve'});const a = row('a',{removal: 'clear'}); const b = row('b');await drain();
  const control = input(b);control.value = 'Pending beta';control.dispatchEvent(new Event('input',{bubbles: true}));
  assert.equal(b.getChildView('name').node.isSettled,false);display.removeChildView(a);
  await b.getChildView('name').node.settled;await drain();
  assert.deepEqual(form.getValues().contacts,[{id: 'b',name: 'Pending beta',detail: 'B detail'}]);
  assert.equal(input(b),control);assert.equal(control.value,'Pending beta');
});
it('list placement teardown and remount preserves keyed exclusion and baseline through reorder',async()=>{
  const {form,list,row} = await fixture({listRemoval: 'preserve'});const a = row('a',{detailRemoval: 'clear'});row('b');await drain();
  a.getRegion('detail').empty();list.destroy();await drain();
  form.setValues({contacts: [...form.getValues().contacts].reverse()});
  const replacement = new FieldView({form,name: 'contacts',removal: 'preserve',input: {type: 'list',dynamic: true,itemKey: 'id',slots: {default: ()=>({$el: 'div',attrs: {'data-rows': ''}})}},regions: {rows: '[data-rows]'}});
  form.showChildView('list',replacement);const display = new CollectionView();replacement.showChildView('rows',display);
  const mounted = new ContactRow({form,parent: replacement.node,rowKey: 'a',removal: 'preserve',detailRemoval: 'clear'});display.addChildView(mounted);await drain();
  assert.equal(mounted.node.value.detail,'A detail');assert.equal(form.getValues().contacts[0].detail,'B detail');
});
it('new row clear remount uses its own baseline and membership reset ends placements for explicit rebuild',async()=>{
  const {form,list,row} = await fixture();const a = row('a'); const b = row('b');await drain();
  list.setValue([...form.getValues().contacts,{id: 'c',name: 'Gamma',detail: 'C original'}]);const c = row('c',{detailRemoval: 'clear'});await drain();
  await edit(c,'Changed','detail');c.getRegion('detail').empty();c.mountDetail();await drain();assert.equal(c.node.value.detail,'C original');
  const ids = [a,b,c].map(view=>view.node.props.id);form.resetForm();await drain();
  assert.ok([a,b,c].every(view=>view.isDestroyed()));assert.ok(ids.every(id=>getNode(id) === undefined));
  assert.deepEqual(form.getValues().contacts.map(item=>item.id),['a','b']);
  const restoredA = row('a'); const restoredB = row('b');await drain();assert.equal(input(restoredA).value,'Alpha');assert.equal(input(restoredB).value,'Beta');
});
it('authoritative list writes end an unmounted retained group before replacing its key',async()=>{
  const {form,list,row,display} = await fixture();const a = row('a'); const b = row('b'); const id = a.node.props.id;await drain();display.removeChildView(a);
  list.setValue([{id: 'c',name: 'Charlie'},form.getValues().contacts[1]]);await drain();
  assert.equal(getNode(id),undefined);assert.equal(b.node.value.id,'b');await edit(b,'Still beta');
  assert.deepEqual(form.getValues().contacts.map(item=>item.name),['Charlie','Still beta']);
});

it('authoritative deletion while list placement is absent ends keyed clear masks before a later same-key addition',async()=>{
  const {form,list,row} = await fixture({listRemoval: 'preserve'});const a = row('a',{detailRemoval: 'clear'});await drain();
  a.getRegion('detail').empty();list.destroy();await drain();
  form.setValues({contacts: []});form.setValues({contacts: [{id: 'a',name: 'Replacement',detail: 'Fresh detail'}]});await drain();
  const replacement = new FieldView({form,name: 'contacts',removal: 'preserve',input: {type: 'list',dynamic: true,itemKey: 'id',slots: {default: ()=>({$el: 'div',attrs: {'data-rows': ''}})}},regions: {rows: '[data-rows]'}});
  form.showChildView('list',replacement);const display = new CollectionView();replacement.showChildView('rows',display);
  const mounted = new ContactRow({form,parent: replacement.node,rowKey: 'a',removal: 'preserve',detailRemoval: 'clear'});display.addChildView(mounted);await drain();
  assert.equal(mounted.node.value.detail,'Fresh detail');assert.equal(mounted.getChildView('detail').el.querySelector('input').value,'Fresh detail');
});
it('absent-list authoritative deletion retires first-mount defaults of added rows',async()=>{
  const {form,list,row} = await fixture({listRemoval: 'preserve'});
  form.setValues({contacts: [...form.getValues().contacts,{id: 'c',name: 'Gamma',detail: 'Old C'}]});row('c',{detailRemoval: 'clear'});await drain();
  list.destroy();await drain();form.setValues({contacts: []});form.setValues({contacts: [{id: 'c',name: 'New gamma',detail: 'New C'}]});await drain();
  const replacement = new FieldView({form,name: 'contacts',removal: 'preserve',input: {type: 'list',dynamic: true,itemKey: 'id',slots: {default: ()=>({$el: 'div',attrs: {'data-rows': ''}})}},regions: {rows: '[data-rows]'}});
  form.showChildView('list',replacement);const display = new CollectionView();replacement.showChildView('rows',display);
  const mounted = new ContactRow({form,parent: replacement.node,rowKey: 'c',removal: 'preserve',detailRemoval: 'clear'});display.addChildView(mounted);await drain();
  mounted.getRegion('detail').empty();mounted.mountDetail();await drain();assert.equal(mounted.node.value.detail,'New C');
});

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
it('preserved placement teardown cancels native work before a fresh placement borrows its real group', async() => {
  const { form, row, display } = await fixture(); const a = row('a'); row('b'); await drain();
  const group = a.node; const field = a.getChildView('name'); const old = input(a); const changes = [];
  field.on('field:change', value => changes.push(value));
  old.value = 'Uncommitted draft'; old.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(field.node.isSettled, false);
  display.removeChildView(a); const next = row('a'); await drain();
  assert.equal(next.node, group); assert.notEqual(input(next), old); assert.equal(input(next).value, 'Alpha');
  old.value = 'Detached callback'; old.dispatchEvent(new Event('input', { bubbles: true }));
  await pause(65); await drain();
  assert.deepEqual(changes, []); assert.equal(form.getValues().contacts[0].name, 'Alpha');
});
it('authoritative key removal ends pending native work and cannot affect a surviving registered control', async() => {
  const { form, row } = await fixture(); const a = row('a'); const b = row('b'); await drain();
  const old = input(a); const survivor = input(b); const field = a.getChildView('name'); const changes = []; const rootChanges = [];
  field.on('field:change', value => changes.push(value)); form.on('form:change', value => rootChanges.push(value));
  old.value = 'Late alpha'; old.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(field.node.isSettled, false);
  form.setValues({ contacts: [form.getValues().contacts[1]] }, { notify: false }); await drain();
  assert.equal(a.isDestroyed(), true); assert.equal(getNode(old.id), undefined); assert.equal(input(b), survivor);
  await pause(65); await drain();
  assert.deepEqual(changes, []); assert.deepEqual(rootChanges, []);
  assert.deepEqual(form.getValues().contacts, [{ id: 'b', name: 'Beta', detail: 'B detail' }]);
});

class NestedContactRow extends RowView {
  constructor(options) {
    super({ ...options, template: () => '<div data-profile></div>', regions: { profile: '[data-profile]' } });
  }
  onRender() {
    const profile = new FieldView({ form: this.options.form, parent: this.node, name: 'profile', removal: 'preserve',
      input: { type: 'group', slots: { default: () => ({ $el: 'div', attrs: { 'data-note': '' } }) } },
      regions: { note: '[data-note]' } });
    this.showChildView('profile', profile);
    profile.showChildView('note', new FieldView({ form: this.options.form, parent: profile.node, name: 'note',
      removal: 'clear', input: { type: 'text', label: 'Note', value: 'Authored note', validation: 'required', config: { delay: 20 } } }));
  }
}
const noteField = row => row.getChildView('profile').getChildView('note');
const noteControl = row => noteField(row).el.querySelector('input');
const contactValues = () => ['a', 'b', 'c'].map(id => ({ id, profile: { note: `${id.toUpperCase()} note` } }));
async function nestedFixture() {
  const initial = contactValues();
  const f = await fixture({ values: initial, listRemoval: 'preserve' });
  const add = (key, removal = 'preserve') => {
    const row = new NestedContactRow({ form: f.form, parent: f.list.node, rowKey: key, removal });
    f.display.addChildView(row); return row;
  };
  return { ...f, initial, add };
}
it('keeps three nested object rows keyed through add, insert, reorder, edit, validation and terminal removal', async() => {
  const { form, list, display, add, initial } = await nestedFixture();
  const a = add('a'); const b = add('b', 'clear'); const c = add('c');
  const controls = [a, b, c].map(noteControl);
  form.setValues({ contacts: [...form.getValues().contacts, { id: 'd', profile: { note: 'D note' } }] });
  const d = add('d');
  const [av, bv, cv, dv] = form.getValues().contacts;
  list.setValue([av, { id: 'e', profile: { note: 'E note' } }, bv, cv, dv]); const e = add('e');
  const byKey = Object.fromEntries(form.getValues().contacts.map(value => [value.id, value]));
  list.setValue(['e', 'c', 'b', 'd', 'a'].map(id => byKey[id]), { notify: false }); await drain();
  assert.deepEqual(form.getValues().contacts.map(value => value.id), ['e', 'c', 'b', 'd', 'a']);
  [a, b, c].forEach((row, index) => assert.equal(noteControl(row), controls[index]));
  const control = noteControl(a); control.value = ''; control.dispatchEvent(new Event('input', { bubbles: true }));
  await noteField(a).node.settled; assert.equal(await form.submit(), 'invalid');
  assert.equal(noteField(a).node.context.state.valid, false); assert.equal(noteField(c).node.context.state.valid, true);
  display.removeChildView(b); await drain();
  assert.deepEqual(form.getValues().contacts.map(value => value.id), ['e', 'c', 'd', 'a']);
  assert.equal(noteControl(c), controls[2]);
  control.value = 'Edited A'; control.dispatchEvent(new Event('input', { bubbles: true }));
  await noteField(a).node.settled; await drain(); assert.equal(await form.submit(), 'success');
  assert.equal(form.getValues().contacts.at(-1).profile.note, 'Edited A');
  assert.equal(noteControl(d).value, 'D note'); assert.equal(noteControl(e).value, 'E note');
  assert.deepEqual(initial, contactValues());
});
it('preserves nested row defaults by key across UI unmount and rebuilds membership reset explicitly', async() => {
  const { form, display, add, initial } = await nestedFixture(); const a = add('a'); const b = add('b'); const c = add('c');
  const group = c.node; display.removeChildView(c); const remount = add('c'); await drain();
  assert.equal(remount.node, group); assert.equal(noteControl(remount).value, 'C note');
  const profile = remount.getChildView('profile'); profile.getRegion('note').empty();
  form.setValues({ contacts: [...form.getValues().contacts].reverse() }, { notify: false });
  profile.showChildView('note', new FieldView({ form, parent: profile.node, name: 'note', removal: 'clear', input: { type: 'text', label: 'Note' } }));
  await noteField(remount).node.settled; await drain();
  assert.equal(noteControl(remount).value, 'C note');
  form.setValues({ contacts: [...form.getValues().contacts, { id: 'd', profile: { note: 'D note' } }] }); const d = add('d');
  form.resetForm(); await drain();
  assert.ok([a, b, remount, d].every(row => row.isDestroyed())); assert.deepEqual(form.getValues().contacts, initial);
  const rebuilt = form.getValues().contacts.map(value => add(value.id)); await drain();
  assert.deepEqual(rebuilt.map(row => noteControl(row).value), ['A note', 'B note', 'C note']);
});
it('isolates same-named forms and rows, releases detached descendants and leaves an unrelated host alive', async() => {
  const first = await nestedFixture(); const second = await nestedFixture();
  const a = first.add('a'); const b = second.add('a'); const host = document.body.appendChild(document.createElement('aside')); host.textContent = 'Host';
  const old = noteControl(a); const survivor = noteControl(b); const field = noteField(a); const changes = [];
  field.on('field:change', value => changes.push(value)); old.value = 'Pending first'; old.dispatchEvent(new Event('input', { bubbles: true }));
  first.display.detachChildView(a); first.owner.destroy();
  old.value = 'Late callback'; old.dispatchEvent(new Event('input', { bubbles: true })); await pause(45); await drain();
  assert.equal(a.isDestroyed(), true); assert.equal(getNode(old.id), undefined); assert.deepEqual(changes, []);
  assert.equal(noteControl(b), survivor); assert.equal(survivor.value, 'A note'); assert.equal(host.textContent, 'Host'); assert.equal(host.isConnected, true);
  assert.deepEqual(second.form.getValues().contacts, contactValues());
});
it('rejects foreign, destroyed, unowned-array and missing-key row parents through public construction', async() => {
  const first = await fixture(); const second = await fixture();
  const foreign = new RowView({ form: first.form, parent: second.list.node, rowKey: 'a', removal: 'preserve' });
  assert.throws(() => foreign.render(), /live list owned/); foreign.destroy();
  const missing = new RowView({ form: first.form, parent: first.list.node, rowKey: 'missing', removal: 'preserve' });
  assert.throws(() => missing.render(), /must already exist/); missing.destroy();
  const before = new RowView({ form: first.form, parent: first.list.node, rowKey: 'a', removal: 'preserve' });
  assert.throws(() => before.node, /Render the RowView/); before.destroy(); assert.equal(before.render(), before);
  const a = first.row('a');
  const raw = new FieldView({ form: first.form, parent: a.node, name: 'raw', removal: 'preserve', input: { type: 'list', dynamic: true, itemKey: 'id', value: [{ id: 'outer', nested: [{ id: 'inner' }] }] } });
  a.showChildView('detail', raw);
  const rawGroup = createNode({ type: 'group', parent: raw.node, index: 0, value: raw.getValue()[0], props: { type: 'group' } });
  const nestedList = new FieldView({ form: first.form, parent: rawGroup, name: 'nested', removal: 'preserve', input: { type: 'list', dynamic: true, itemKey: 'id' } });
  first.form.addRegion('raw-child', { el: first.form.el.appendChild(document.createElement('div')) });
  first.form.showChildView('raw-child', nestedList);
  const nested = new RowView({ form: first.form, parent: nestedList.node, rowKey: 'inner', removal: 'preserve' });
  assert.throws(() => nested.render(), /owned RowView ancestors/); nested.destroy();
  const delayed = new RowView({ form: second.form, parent: second.list.node, rowKey: 'a', removal: 'preserve' });
  second.owner.destroy(); assert.throws(() => delayed.render(), /live list owned/); delayed.destroy();
});
it.each([
  [[{ id: 'a' }, { id: 'a' }], 'duplicate'],
  [[{ id: '' }], 'empty'],
  [[{ id: 7 }], 'non-string']
])('rejects %s row keys before acquiring a placement (%s)', async(values) => {
  const { form, list } = await fixture({ values });
  const row = new RowView({ form, parent: list.node, rowKey: 'a', removal: 'preserve' });
  assert.throws(() => row.render(), /unique non-empty strings/); row.destroy();
});
it('requires an explicit string itemKey and rejects non-array authoritative row writes', async() => {
  const { form, list, row } = await fixture(); row('a');
  assert.throws(() => list.setValue({ id: 'a' }), /require an array/);
  const ordinary = new FieldView({ form, name: 'unkeyed', removal: 'preserve', input: { type: 'list', dynamic: true, value: [{ id: 'a' }] } });
  form.showChildView('elsewhere', ordinary);
  const unkeyed = new RowView({ form, parent: ordinary.node, rowKey: 'a', removal: 'preserve' });
  assert.throws(() => unkeyed.render(), /string itemKey/); unkeyed.destroy();
});
