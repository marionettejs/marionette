import View from '../../../src/view';
import Region from '../../../src/region';

describe('Region', function() {
  describe('.buildRegion', function() {
    let DefaultRegionClass;
    let view;
    let fooSelector;
    let barSelector;
    let BarRegion;
    let BazRegion;

    beforeEach(function() {

      DefaultRegionClass = Region.extend();

      view = new View({
        template: _.noop,
        regionClass: DefaultRegionClass
      });

      fooSelector = '#foo-region';

      barSelector = '#bar-region';
      BarRegion = Region.extend({el: barSelector});

      BazRegion = Region.extend();
    });

    describe('with a selector string', function() {
      let region;

      beforeEach(function() {
        region = view.addRegion(_.uniqueId('region_'), fooSelector);
      });

      it('uses the default region class', function() {
        expect(region).to.be.an.instanceof(DefaultRegionClass);
      });

      it('uses the selector', function() {
        expect(region.el).to.equal(fooSelector);
      });
    });

    describe('with a region class', function() {
      describe('with `el` defined', function() {
        let region;

        beforeEach(function() {
          region = view.addRegion(_.uniqueId('region_'), BarRegion);
        });

        it('uses the passed in region class', function() {
          expect(region).to.be.an.instanceof(BarRegion);
        });

        it('uses the defined el', function() {
          expect(region.el).to.equal(barSelector);
        });
      });

      describe('without `el` defined', function() {
        let buildRegion;

        beforeEach(function() {
          buildRegion = function() {
            view.addRegion(_.uniqueId('region_'), BazRegion);
          };
        });

        it('throws a `NoElError`', function() {
          expect(buildRegion).to.throw('An "el" must be specified for a region.');
        });
      });
    });

    describe('with an object literal', function() {
      describe('with `el` defined', function() {
        describe('when el is a selector string', function() {
          let definition;
          let region;

          beforeEach(function() {
            definition = {el: fooSelector};
            region = view.addRegion(_.uniqueId('region_'),definition);
          });

          it('uses the default region class', function() {
            expect(region).to.be.an.instanceof(DefaultRegionClass);
          });

          it('uses the el', function() {
            expect(region.el).to.equal(fooSelector);
          });

          describe('with `parentEl` also defined', function() {
            describe('including the selector', function() {
              beforeEach(function() {
                this.setFixtures('<div id="parent"><div id="child">text</div></div>');
                const parentEl = $('#parent');
                definition = _.defaults({parentEl: parentEl, el: '#child' }, definition);
                region = view.addRegion(_.uniqueId('region_'), definition);
              });

              it('returns the jQuery(el)', function() {
                expect(region.getEl(region.el).text()).to.equal($(region.el).text());
              });
            });

            describe('excluding the selector', function() {
              beforeEach(function() {
                this.setFixtures('<div id="parent"></div><div id="not-child">text</div>');
                const parentEl = $('#parent');
                definition = _.defaults({parentEl: parentEl, el: '#not-child' }, definition);
                region = view.addRegion(_.uniqueId('region_'), definition);
              });

              it('returns the jQuery(el)', function() {
                expect(region.getEl(region.el).text()).to.not.equal($(region.el).text());
              });
            });

            describe('including multiple instances of the selector', function() {
              beforeEach(function() {
                this.setFixtures('<div id="parent"><div class="child">text</div><div class="child">text</div></div>');
                const parentEl = $('#parent');
                definition = _.defaults({parentEl: parentEl, el: '.child' }, definition);
                region = view.addRegion(_.uniqueId('region_'), definition);
              });

              it('should ensure a jQuery(el) of length 1', function() {
                // calls _ensureElement
                region.empty();
                expect(region.$el.length).to.equal(1);
              });
            });
          });
        });

        describe('when el is an HTML node', function() {
          let el;
          let definition;
          let region;

          beforeEach(function() {
            el = $('<div id="baz-region">')[0];
            new DefaultRegionClass({el: el});
            definition = {el: el};
            region = view.addRegion(_.uniqueId('region_'), definition);
          });

          it('uses the default region class', function() {
            expect(region).to.be.an.instanceof(DefaultRegionClass);
          });

          it('uses the el', function() {
            expect(region.el).to.equal(el);
          });

          describe('with `parentEl` also defined', function() {
            beforeEach(function() {
              const parentEl = $('<div id="not-actual-parent"></div>');
              definition = _.defaults({parentEl: parentEl}, definition);
              region = view.addRegion(_.uniqueId('region_'), definition);
            });

            it('returns the jQuery(el)', function() {
              expect(region.getEl(el)).to.deep.equal($(el));
            });

          });
        });

        describe('when el is a jQuery object', function() {
          let el;
          let region;

          beforeEach(function() {
            el = $('<div id="baz-region">');
            new DefaultRegionClass({el: el});
            const definition = {el: el};
            region = view.addRegion(_.uniqueId('region_'), definition);
          });

          it('uses the default region class', function() {
            expect(region).to.be.an.instanceof(DefaultRegionClass);
          });

          it('uses the el', function() {
            expect(region.el).to.equal(el[0]);
          });
        });
      });

      describe('when el is an empty jQuery object', function() {
        let buildRegion;

        beforeEach(function() {
          const el = $('i-am-not-real');
          const definition = {el: el};

          buildRegion = function() {
            view.addRegion(_.uniqueId('region_'), definition);
          };
        });

        it('throws a `NoElError`', function() {
          expect(buildRegion).to.throw('An "el" must be specified for a region.');
        });
      });

      describe('with `regionClass` defined', function() {
        describe('with `el` also defined', function() {
          let el;
          let region1;
          let region2;
          let region3;

          beforeEach(function() {
            const $el = $('<div id="baz-region">');
            el = $el[0];

            const baseDefinition = {regionClass: BazRegion};
            const region1Definition = _.defaults({el: fooSelector}, baseDefinition);
            const region2Definition = _.defaults({el: el}, baseDefinition);
            const region3Definition = _.defaults({el: $el}, baseDefinition);

            region1 = view.addRegion(_.uniqueId('region_'), region1Definition);
            region2 = view.addRegion(_.uniqueId('region_'), region2Definition);
            region3 = view.addRegion(_.uniqueId('region_'), region3Definition);
          });

          it('uses the region class', function() {
            expect(region1).to.be.an.instanceof(BazRegion);
            expect(region2).to.be.an.instanceof(BazRegion);
            expect(region3).to.be.an.instanceof(BazRegion);
          });

          it('uses the el', function() {
            expect(region1.el).to.equal(fooSelector);
            expect(region2.el).to.equal(el);
            expect(region3.el).to.equal(el);
          });
        });

        describe('without `selector` or `el` defined on `regionConfig`', function() {
          describe('with `el` defined on `regionClass`', function() {
            let region;

            beforeEach(function() {
              const definition = {regionClass: BarRegion};
              region = view.addRegion(_.uniqueId('region_'), definition);
            });

            it('uses the region class', function() {
              expect(region).to.be.an.instanceof(BarRegion);
            });
          });

          describe('without `el` defined on `regionClass`', function() {
            let buildRegion;

            beforeEach(function() {
              const definition = {regionClass: BazRegion};

              buildRegion = function() {
                view.addRegion(_.uniqueId('region_'), definition);
              };
            });

            it('throws a `NoElError`', function() {
              expect(buildRegion).to.throw('An "el" must be specified for a region.');
            });
          });
        });
      });

      describe('with additional region options', function() {
        let region;

        beforeEach(function() {
          const definition = {
            el: fooSelector,
            regionClass: BazRegion,
            myRegionOption: 42,
            myOtherRegionOption: 'foobar'
          };

          region = view.addRegion(_.uniqueId('region_'), definition);
        });

        it('it sets the region options', function() {
          expect(region.getOption('myRegionOption')).to.equal(42);
          expect(region.getOption('myOtherRegionOption')).to.equal('foobar');
        });
      });
    });

    describe('with a instantiated region', function() {
      let region;

      beforeEach(function() {
        region = view.addRegion(_.uniqueId('region_'), new BarRegion());
      });

      it('uses the region class', function() {
        expect(region).to.be.an.instanceof(BarRegion);
      });
    });

    describe('with a missing regionConfig', function() {
      let buildRegion;

      beforeEach(function() {
        buildRegion = function() {
          view.addRegion(_.uniqueId('region_'));
        };
      });

      it('throws an error', function() {
        expect(buildRegion).to.throw('Improper region configuration type.');
      });
    });
  });
});
