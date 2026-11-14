// Root form presentation slots; declared fields keep their sole Core owner.
import {renderSections} from './section-renderer.mjs';
export function createRootSlots(view,provided={}){
  const anchor=view._fieldAnchor;let placed=false;
  const fields=({parent,before})=>{
    if(placed)throw new TypeError('Root fields require one active outlet');placed=true;
    parent.insertBefore(anchor,before);
    for(const field of view.fields.values())parent.insertBefore(field.el,anchor);
    view._layoutController?.place();view.trigger('fields:attached');
    let closed=false;return(remove=true)=>{
      if(closed)return;closed=true;placed=false;if(!remove)return;
      // A conditional/default slot can disappear while the form remains live.
      // Park its owned controls/layout so data updates still have a valid outlet.
      view._layoutController?.detach();
      const parking=document.createDocumentFragment();
      for(const field of view.fields.values())parking.append(field.el);
      parking.append(anchor);view._layoutController?.place();
    };
  };
  const slots={fields,default:fields};
  for(const [name,content]of Object.entries(provided)){
    if(name==='fields')throw new TypeError('The root fields slot is reserved');
    slots[name]=args=>{
      if(typeof content==='function'){
        const outlets=[];
        const renderFields=(parent=args.parent,before=args.before)=>{const dispose=fields({parent,before});outlets.push(dispose);return dispose;};
        const result=content({...args,renderFields});
        const destroy=(remove=true)=>{for(const dispose of outlets)dispose(remove);if(typeof result==='function')result(remove);else result?.destroy?.(remove);};
        return{update:next=>{if(typeof result==='object')result?.update?.(next);},destroy};
      }
      return renderSchemaSlot(view,content,args,slots);
    };
  }
  return slots;
}

// Shared schema-valued slot rendering for form slots and literal Schema slots.
export function renderSchemaSlot(view,content,args,slots={}){
      const host=document.createElement('span');host.style.display='contents';args.parent.insertBefore(host,args.before);
      let renderer;
      let currentData=view._schemaData;
      const data=Object.create(currentData);
      for(const key in args.locals)Object.defineProperty(data,key,{get:()=>args.locals[key]});
      try{renderer=renderSections({host,schema:content,context:args.context,data,parentNode:args.parentNode,configScope:args.configScope,domRoot:args.domRoot,components:view.components,metrics:view.metrics,slots});}
      catch(error){host.remove();throw error;}
      return{update(){if(currentData!==view._schemaData){currentData=view._schemaData;Object.setPrototypeOf(data,currentData);}renderer.refresh();},destroy(remove=true){renderer.destroy(remove);if(remove)host.remove();}};
}
