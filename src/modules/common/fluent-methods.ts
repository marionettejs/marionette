import type { DOMEvents } from '../../mixins/view-events.ts';
import type { ShowOptions } from '../region.ts';
import type { SupportedView } from './view.ts';

// Keep inherited methods as declarations: mapping them through Omit loses
// polymorphic this and turns native method overrides into property overrides.
type Inherited<Props, Method> = Extract<keyof Method, keyof Props> extends never ? Method : {};
interface SetElement { setElement(element: Element): this; }
interface Render { render(): this; }
interface RenderAttributes { renderAttributes(): this; }
interface Destroy<Options = unknown> { destroy(options?: Options): this; }
interface DelegateEvents { delegateEvents(events?: DOMEvents): this; }
interface UndelegateEvents { undelegateEvents(): this; }
interface DelegateEntityEvents { delegateEntityEvents(): this; }
interface UndelegateEntityEvents { undelegateEntityEvents(): this; }
interface BindUIElements { bindUIElements(): this; }
interface UnbindUIElements { unbindUIElements(): this; }
interface BehaviorDestroy { destroy(): this; }
interface SyncElement { _syncElement(): this; }
interface Show { show(view: SupportedView, options?: ShowOptions): this | undefined; }
interface Empty { empty(options?: ShowOptions): this; }
interface Reset { reset(options?: ShowOptions): this; }

export type ViewFluent<Props> = Inherited<Props, SetElement> & Inherited<Props, Render> &
  Inherited<Props, RenderAttributes> & Inherited<Props, Destroy> & Inherited<Props, DelegateEvents> &
  Inherited<Props, UndelegateEvents> & Inherited<Props, DelegateEntityEvents> &
  Inherited<Props, UndelegateEntityEvents> & Inherited<Props, BindUIElements> & Inherited<Props, UnbindUIElements>;
export type BehaviorFluent<Props> = Inherited<Props, BehaviorDestroy> & Inherited<Props, BindUIElements> &
  Inherited<Props, UnbindUIElements> & Inherited<Props, DelegateEntityEvents> &
  Inherited<Props, UndelegateEntityEvents> & Inherited<Props, SyncElement>;
export type RegionFluent<Props> = Inherited<Props, Show> & Inherited<Props, Empty> &
  Inherited<Props, Reset> & Inherited<Props, Destroy<ShowOptions>>;
