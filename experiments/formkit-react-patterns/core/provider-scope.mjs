// Lexical options and opaque projection markers; never DOM/schema properties.
export const formKitScope = Symbol('FormKit options scope');
export const providerBoundary = Symbol('FormKit provider boundary');
export const formKitDomRoot = Symbol('FormKit DOM root');
export const formKitParent = Symbol('FormKit Core parent');

// Identifies the built-in FormKit factory for native schema ownership.
export const nativeFormKitFactory = Symbol('FormKit native factory');
