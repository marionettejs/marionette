const mochaGlobals = require('../.globals.json').globals;

global.mocha.setup('bdd');
global.onload = function() {
  global.mocha.checkLeaks();
  global.mocha.globals(Object.keys(mochaGlobals));

  const runner = global.mocha.run();

  mochaResults(runner);
  require('./setup')();
};

const mochaResults = function(runner) {
  const failedTests = [];

  runner.on('end', function() {
    global.mochaResults = runner.stats;
    global.mochaResults.reports = failedTests;
  });

  runner.on('fail', function(test, err) {
    failedTests.push({
      title: test.title,
      fullTitle: test.fullTitle(),
      error: {
        message: err.message,
        stack: err.stack
      }
    });
  });
}
