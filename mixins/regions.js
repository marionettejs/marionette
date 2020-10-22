import { clone, result, isEmpty, extend, partial, each, reduce } from 'underscore';
import buildRegion from '../modules/common/build-region';
import Region from '../modules/region';

// MixinOptions
// - regions
// - regionClass

export default {
  regionClass: Region,

  // Internal method to initialize the regions that have been defined in a
  // `regions` attribute on this View.
  _initRegions() {

    // init regions hash
    this.regions = this.regions || {};
    this._regions = {};

    this.addRegions(result(this, 'regions'));
  },

  // Internal method to re-initialize all of the regions by updating
  // the `el` that they point to
  _reInitRegions() {
    each(this._regions, region => region.reset());
  },

  // Add a single region, by name, to the View
  addRegion(name, definition) {
    const regions = {};
    regions[name] = definition;
    return this.addRegions(regions)[name];
  },

  // Add multiple regions as a {name: definition, name2: def2} object literal
  addRegions(regions) {
    // If there's nothing to add, stop here.
    if (isEmpty(regions)) {
      return;
    }

    // Normalize region selectors hash to allow
    // a user to use the @ui. syntax.
    regions = this.normalizeUIValues(regions, 'el');

    // Add the regions definitions to the regions property
    this.regions = extend({}, this.regions, regions);

    return this._addRegions(regions);
  },

  // internal method to build and add regions
  _addRegions(regionDefinitions) {
    const defaults = {
      regionClass: this.regionClass,
      parentEl: partial(result, this, 'el')
    };

    return reduce(regionDefinitions, (regions, definition, name) => {
      regions[name] = buildRegion(definition, defaults);
      this._addRegion(regions[name], name);
      return regions;
    }, {});
  },

  _addRegion(region, name) {
    this.triggerMethod('before:add:region', this, name, region);

    region._parentView = this;
    region._name = name;

    this._regions[name] = region;

    this.triggerMethod('add:region', this, name, region);
  },

  // Remove a single region from the View, by name
  removeRegion(name) {
    const region = this._regions[name];

    this._removeRegion(region, name);

    return region;
  },

  // Remove all regions from the View
  removeRegions() {
    const regions = this._getRegions();

    each(this._regions, this._removeRegion.bind(this));

    return regions;
  },

  _removeRegion(region, name) {
    this.triggerMethod('before:remove:region', this, name, region);

    region.destroy();

    this.triggerMethod('remove:region', this, name, region);
  },

  // Called in a region's destroy
  _removeReferences(name) {
    delete this.regions[name];
    delete this._regions[name];
  },

  // Empty all regions in the region manager, but
  // leave them attached
  emptyRegions() {
    const regions = this.getRegions();
    each(regions, region => region.empty());
    return regions;
  },

  // Checks to see if view contains region
  // Accepts the region name
  // hasRegion('main')
  hasRegion(name) {
    return !!this.getRegion(name);
  },

  // Provides access to regions
  // Accepts the region name
  // getRegion('main')
  getRegion(name) {
    if (!this._isRendered) {
      this.render();
    }
    return this._regions[name];
  },

  _getRegions() {
    return clone(this._regions);
  },

  // Get all regions
  getRegions() {
    if (!this._isRendered) {
      this.render();
    }
    return this._getRegions();
  },

  showChildView(name, view, options) {
    const region = this.getRegion(name);
    region.show(view, options);
    return view;
  },

  detachChildView(name) {
    return this.getRegion(name).detachView();
  },

  getChildView(name) {
    return this.getRegion(name).currentView;
  }

};
