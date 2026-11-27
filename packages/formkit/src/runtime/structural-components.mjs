import { destroyWithRemovalRoot } from './section-renderer.mjs';
import { providerBoundary, formKitDomRoot } from './provider-scope.mjs';

export function createFormKitStructuralComponents(view,createSchemaOwner) {
  const FormKitSchema = args=>{
    const owner = createSchemaOwner(args);
    return {update: props=>owner.update(props),refresh: ()=>owner.refresh(),destroy: remove=>owner.destroy(remove),[destroyWithRemovalRoot]: root=>owner.destroy(false,root)};
  };
  const FormKitRoot = ({host,renderChildren})=>{
    let active = false,dead = false;
    const activate = ()=>{
      if (dead || active) {return;}
      const root = host.getRootNode();
      if (root.nodeType !== 9 && !(root.nodeType === 11 && root.host?.nodeType === 1)) {return;}
      view.off('attach',activate);
      renderChildren(undefined,null,{[formKitDomRoot]: root});active = true;
    };
    view.on('attach',activate);activate();queueMicrotask(activate);
    return {update() {},refresh: activate,destroy() {if (dead) {return;}dead = true;view.off('attach',activate);}};
  };
  FormKitSchema[providerBoundary] = true;FormKitRoot[providerBoundary] = true;
  return {FormKitSchema,FormKitRoot};
}
