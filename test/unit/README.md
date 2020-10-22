### Unit Tests


### Running unit tests

1. Running just unit tests - `yarn test`

2. Running coverage reporter - `yarn coverage`.
To check coverage, open `./coverage/lcov-report/index.html`.

3. Running tests in browser - `yarn test-browser`.


### Common concepts for writing tests

1. Test suites should cover public API.

> In most cases it will be public API testing,
but sometimes we should test something like: When models added to collection,
hence, in this case we are adding needed suites.

2. Code style.

- Each `describe` should have name of tested method.

> If it's possible, there should be not more then one nested describe for one method.

_Wrong way_

```javascript
  describe('#MyClass', function() {
    describe('some events in myMethod', function() {
      describe('some logic', function() {
        it('do something', function() {
          ...
        });

        describe('some other logic', function() {
          // other nested describes
        });
      });
    });
  });
```


**Correct way**

```javascript
  describe('#MyClass', function() {
    describe('#myMethod', function() {
      describe('when some logic', function() {
        it('should do something', function() {
          ...
        });
      });

      describe('when some other logic', function() {
        it('should do something', function() {
          ...
        });
      });
    });
  });
```

- In case of testing some behavior

> behavior means not Marionette Behavior class

**Correct way**

```javascript
  describe('#MyClass', function() {
    describe('when some data was changed', function() {
      it('should do something', function() {
        ...
      });
    });
  });
```

- `before/beforeEach` should consist only some preparation logic
but inside it should not present calling methods you expect to test.

_Wrong way_

```javascript
  describe('#MyClass', function() {
    describe('#myMethod', function() {
      let myInstance;

      beforeEach(function() {
        myInstance = new MyClass({
          render: this.sinon.spy
        });
        myInstance.render();
      });

      it('should do something', function() {
        expect(myInstance.render).to.have.been.calledOnce;
      });
    });
  });
```


**Correct way**

```javascript
  describe('#MyClass', function() {
    describe('#myMethod', function() {
      let myInstance;
      let renderSpy;

      beforeEach(function() {
        renderSpy = this.sinon.spy();

        myInstance = new MyClass({
          render: renderSpy
        });
      });

      it('should do something', function() {
        myInstance.render();

        expect(renderSpy).to.have.been.calledOnce;
      });
    });
  });
```
