import { extend as sharedExtend } from '@mnjs/utils';
import type { ArgumentsFor, Instance, Merge, MetadataFor, MnObjectConstructor, StateFor } from '../modules/object.ts';

// Keep Marionette constructor inference on the shared runtime implementation.
export interface MarionetteExtend {
  (this: Function & { prototype: object }, protoProps?: object, staticProps?: object): Function;
  call<Parent extends ((...args: never[]) => unknown) & { prototype: object },
    Added extends object = {}, AddedStatics extends object = {}>(
    this: MarionetteExtend,
    parent: Parent & ([MetadataFor<Parent>] extends [never] ? never : unknown),
    protoProps?: Added & ThisType<Instance<
      Merge<MetadataFor<Parent>['props'], Added>,
      ArgumentsFor<Merge<MetadataFor<Parent>['props'], Added>, MetadataFor<Parent>['args']>,
      StateFor<Merge<MetadataFor<Parent>['props'], Added>>
    >>,
    staticProps?: AddedStatics & ThisType<MnObjectConstructor<
      Merge<MetadataFor<Parent>['props'], Added>,
      ArgumentsFor<Merge<MetadataFor<Parent>['props'], Added>, MetadataFor<Parent>['args']>,
      StateFor<Merge<MetadataFor<Parent>['props'], Added>>,
      Merge<MetadataFor<Parent>['statics'], AddedStatics>
    >>
  ): MnObjectConstructor<
    Merge<MetadataFor<Parent>['props'], Added>,
    ArgumentsFor<Merge<MetadataFor<Parent>['props'], Added>, MetadataFor<Parent>['args']>,
    StateFor<Merge<MetadataFor<Parent>['props'], Added>>,
    Merge<MetadataFor<Parent>['statics'], AddedStatics>
  >;
  call(this: MarionetteExtend, parent: Function & { prototype: object }, protoProps?: object, staticProps?: object): Function;
}

const extend = sharedExtend as MarionetteExtend;
export default extend;
