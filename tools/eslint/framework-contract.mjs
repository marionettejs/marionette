export const FRAMEWORK_CLASSES = new Set([
  'Application',
  'Behavior',
  'CollectionView',
  'MnObject',
  'Region',
  'View',
]);

const objectPrivate = ['_channel', '_destroyRadio', '_destroyState', '_initRadio', '_initState',
  '_initStateEvents', '_isDestroyed', '_isDestroying', '_ownsState', '_setOptions', '_state',
  '_stateEventCleanup', '_stateOptions', '_stateReleased'];
const visualPrivate = ['_behaviors', '_bindUIElements', '_buildEventProxies', '_collectionEventCleanup',
  '_collectionEvents', '_dataObserverCleanup', '_delegate', '_delegateEntityEvents', '_delegateEvents',
  '_delegateTriggers', '_delegateViewEvents', '_destroyBehaviors', '_destroyState', '_domEvents',
  '_getAttributes', '_getEl', '_getImmediateChildren', '_getUI', '_getUIBindings', '_initBehaviors',
  '_initState', '_initStateEvents', '_initViewEvents', '_isAttached', '_isDestroyed', '_isDestroying',
  '_isElAttached', '_isRendered', '_modelEventCleanup', '_modelEvents', '_removeBehavior', '_renderTemplate',
  '_ownsState', '_setOptions', '_state', '_stateEventCleanup', '_stateOptions', '_stateReleased',
  '_triggerEventOnBehaviors', '_ui', '_uiBindings', '_unbindUIElements',
  '_undelegateEntityEvents', '_undelegateViewEvents'];
const behaviorPrivate = ['_bindUIElements', '_collectionEventCleanup', '_collectionEvents', '_delegate',
  '_delegateEntityEvents', '_delegateEvents', '_delegateTriggers', '_delegateViewEvents', '_destroyState',
  '_domEvents', '_getUI', '_getUIBindings', '_initState', '_initStateEvents', '_initViewEvents',
  '_isDestroyed', '_modelEventCleanup', '_modelEvents', '_ownsState', '_setOptions', '_state',
  '_stateEventCleanup', '_stateOptions', '_stateReleased', '_ui', '_uiBindings', '_unbindUIElements',
  '_undelegateEntityEvents', '_undelegateViewEvents'];

// These names are implementation facts, not supported API. Each entry is
// checked against authored source so a rename cannot leave a stale lint error.
export const PRIVATE_MEMBERS = {
  Application: new Set([...objectPrivate, '_childApps', '_initRegion', '_lifecycleOperation',
    '_lifecycleState', '_name', '_ownedRegion', '_parentApp', '_region']),
  Behavior: new Set(behaviorPrivate),
  CollectionView: new Set([...visualPrivate, '_addChild', '_addChildModel', '_addChildModels',
    '_attachChildren', '_children', '_collectionChangeQueue', '_collectionObservedSnapshot',
    '_collectionSnapshot', '_createChildView', '_destroyChildView', '_destroyChildren', '_destroyEmptyView',
    '_detachChildView', '_detachChildren', '_emptyRegion', '_filterChildren', '_getBuffer', '_getChildView',
    '_getChildViewContainer', '_getChildViewOptions', '_getEmptyView', '_getEmptyViewOptions', '_getFilter',
    '_getView', '_initChildViewStorage', '_initialEvents', '_onCollectionChange', '_onCollectionReorder',
    '_onCollectionReset', '_onCollectionUpdate', '_proxyChildViewEvents', '_removeChild', '_removeChildView',
    '_removeChildViews', '_renderChildren', '_setChildrenFromSnapshot', '_setupChildView', '_showEmptyView',
    '_sortChildren', '_viewComparator']),
  MnObject: new Set(objectPrivate),
  Region: new Set(['_attachView', '_detachView', '_empty', '_ensureElement', '_getView', '_initEl',
    '_isDestroyed', '_isDestroying', '_isElAttached', '_isReplaced', '_isSwappingView', '_name', '_parentView',
    '_proxyChildViewEvents', '_replaceEl', '_restoreEl', '_setEl', '_setOptions', '_setupChildView',
    '_shouldDisableMonitoring', '_stopChildViewEvents']),
  View: new Set([...visualPrivate, '_addRegion', '_addRegions', '_getRegions', '_initRegions', '_regions',
    '_reInitRegions', '_removeReferences', '_removeRegion']),
};

export const PRIVATE_MEMBER_SOURCES = {
  Application: ['src/modules/application.ts', 'src/mixins/common.ts', 'src/mixins/destroy.ts',
    'src/mixins/radio.ts', 'src/mixins/state.ts'],
  Behavior: ['src/modules/behavior.ts', 'src/mixins/common.ts', 'src/mixins/delegate-entity-events.ts',
    'src/mixins/state.ts', 'src/mixins/ui.ts', 'src/mixins/view-events.ts'],
  CollectionView: ['src/modules/collection-view.ts', 'src/mixins/behaviors.ts', 'src/mixins/common.ts',
    'src/mixins/delegate-entity-events.ts', 'src/mixins/state.ts', 'src/mixins/template-render.ts',
    'src/mixins/ui.ts', 'src/mixins/view-events.ts', 'src/mixins/view.ts'],
  MnObject: ['src/modules/object.ts', 'src/mixins/common.ts', 'src/mixins/destroy.ts',
    'src/mixins/radio.ts', 'src/mixins/state.ts'],
  Region: ['src/modules/region.ts', 'src/mixins/common.ts'],
  View: ['src/modules/view.ts', 'src/mixins/behaviors.ts', 'src/mixins/common.ts',
    'src/mixins/delegate-entity-events.ts', 'src/mixins/state.ts', 'src/mixins/template-render.ts',
    'src/mixins/ui.ts', 'src/mixins/view-events.ts', 'src/mixins/view.ts'],
};
