import type { RouterInstance } from './router.ts';

export type Params = Record<string, string | number | null | undefined>;
export type Query = URLSearchParams | Record<string, string | number | null | undefined> | string;
export type EntryState = Record<string, unknown>;
export type NavigationType = 'push' | 'replace' | 'traverse' | 'reload';
export interface DriverNavigateOptions { history?: 'auto' | 'push' | 'replace'; state?: unknown; info?: unknown }
export interface NavigationOptions extends DriverNavigateOptions { state?: EntryState | null }
export interface DriverEntry { url: string; key: string; index: number; getState(): unknown }
export interface NavigationResult<T = DriverEntry> { committed: Promise<T>; finished: Promise<T> }
export interface DriverEvent {
  destination: DriverEntry;
  navigationType: NavigationType;
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  formData: FormData | null;
  userInitiated: boolean;
  info: unknown;
  signal: AbortSignal;
  cancelable: boolean;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
  intercept(options?: { handler?: () => unknown; focusReset?: 'manual'; scroll?: 'manual' }): void;
}
export interface Driver {
  capabilities: { cancelTraverse: boolean; interceptsLinks: boolean };
  readonly currentEntry: DriverEntry;
  entries(): DriverEntry[];
  navigate(url: string, options?: DriverNavigateOptions): NavigationResult;
  reload(options?: { info?: unknown; state?: unknown }): NavigationResult;
  back(): NavigationResult;
  traverseTo(key: string): NavigationResult;
  updateCurrentEntry(options: { state: unknown }): void;
  addEventListener(type: 'navigate', listener: (event: DriverEvent) => void, options?: { signal?: AbortSignal }): void;
}
export interface SimulateOptions {
  navigationType?: 'push' | 'replace'; userInitiated?: boolean; canIntercept?: boolean;
  hashChange?: boolean; downloadRequest?: string | null; formData?: FormData | null; info?: unknown; state?: unknown;
}
export interface MemoryDriver extends Driver {
  simulate(target: string, options?: SimulateOptions): NavigationResult;
  documentNavigations: string[];
}
export interface BranchEntry { name: string | undefined; path: string; params: Record<string, string>; meta: Record<string, unknown> }
export interface Match {
  name: string; params: Record<string, string>; query: URLSearchParams; url: URL;
  meta: Record<string, unknown>; branch: BranchEntry[];
  navigationType: NavigationType | null; initial: boolean; info: unknown; state: unknown;
  key: string; signal: AbortSignal | null; userInitiated: boolean;
}
export interface ActiveMatch extends Match { signal: AbortSignal; navigationType: NavigationType }
export type RedirectTarget = string | { name: string; params?: Params; query?: Query };
export type Redirect = (match: ActiveMatch, context: { signal: AbortSignal }) => RedirectTarget | null | undefined | Promise<RedirectTarget | null | undefined>;
export interface RouteDefinition {
  name?: string; path: string; children?: RouteDefinition[]; meta?: Record<string, unknown>;
  redirect?: Redirect;
}
export interface MatcherResult extends Pick<Match, 'name' | 'params' | 'query' | 'url' | 'meta' | 'branch'> {
  redirect?: Redirect;
}
export interface NavigateOptions extends NavigationOptions { query?: Query }
export type RouteSource = RouteDefinition[] | ((this: RouterInstance) => RouteDefinition[]);
export interface RouterOptions {
  routes?: RouteSource; driver?: Driver; intercept?: (this: RouterInstance, url: URL) => boolean;
  notFound?: { name: string; within: (url: URL) => boolean }; persistParams?: string[];
  handler?: (this: RouterInstance, match: ActiveMatch, context: { signal: AbortSignal }) => unknown; maxRedirects?: number;
}
