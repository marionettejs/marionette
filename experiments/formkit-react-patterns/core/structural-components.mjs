import { providerBoundary, formKitDomRoot } from './provider-scope.mjs';

export function createFormKitStructuralComponents(view,createSchemaOwner) {
  const FormKitSchema = args=>{
    const owner = createSchemaOwner(args);
    return {update: props=>owner.update(props),refresh: ()=>owner.refresh(),destroy: remove=>owner.destroy(remove)};
  };
  const FormKitRoot = ({host,renderChildren})=>{
    let dispose,dead = false;
    const activate = ()=>{
      if (dead || dispose) return;
      const root = host.getRootNode();
      if (root.nodeType !== 9 && !(root.nodeType === 11 && root.host?.nodeType === 1)) return;
      view.off('attach',activate);
      dispose = renderChildren(undefined,null,{[formKitDomRoot]: root});
    };
    view.on('attach',activate);activate();queueMicrotask(activate);
    return {update() {},refresh: activate,destroy(remove = true) {if (dead) return;dead = true;view.off('attach',activate);dispose?.(remove);}};
  };
  FormKitSchema[providerBoundary] = true;FormKitRoot[providerBoundary] = true;
  return {FormKitSchema,FormKitRoot};
}
