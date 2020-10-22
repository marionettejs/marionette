import easySauce from 'easy-sauce';

import babel from 'rollup-plugin-babel';
import browsersync from 'rollup-plugin-browsersync';
import commonjs from 'rollup-plugin-commonjs';
import { eslint } from 'rollup-plugin-eslint';
import json from 'rollup-plugin-json';
import multiEntry from 'rollup-plugin-multi-entry';
import nodeResolve from 'rollup-plugin-node-resolve';
import nodeGlobals from 'rollup-plugin-node-globals';

const footer = 'this && this.Marionette && (this.Mn = this.Marionette);';

const isSauce = process.env.NODE_ENV === 'sauce';

function runSauce() {
  easySauce({
    name: 'Marionette.js',
    username: process.env.SAUCE_USERNAME,
    key: process.env.SAUCE_ACCESS_KEY,
    port: '8080',
    testPath: '/test/runner.html',
    framework: 'mocha',
    platforms: [
      ['Windows 10', 'internet explorer', 'latest'],
      ['Windows 10', 'MicrosoftEdge', 'latest'],
      ['Windows 10', 'chrome', 'latest'],
      ['macOS 10.13', 'chrome', 'latest'],
      ['macOS 10.13', 'firefox', 'latest']
    ],
    service: 'sauce-connect'
  })
    .on('message', message => {
      // eslint-disable-next-line
      console.log(message);
    })
    .on('update', job => {
      // eslint-disable-next-line
      console.log(job.status);
    })
    .on('done', (passed, jobs) => {
      if (passed) {
        // eslint-disable-next-line
        console.log('All tests passed!');
        process.exit(0);
      } else {
        // eslint-disable-next-line
        console.error('Failures: ' + JSON.stringify(jobs, false, 2));
        process.exit(1);
      }
    })
    .on('error', error => {
      // eslint-disable-next-line
      console.error(error.message);
      process.exit(1);
    });
}

export default {
  input: ['./test/setup/browser.js', './test/unit/**/*.js'],
  output: [
    {
      file: './test/tmp/__spec-build.js',
      format: 'umd',
      name: 'Marionette',
      exports: 'named',
      sourcemap: true,
      footer
    }
  ],
  plugins: [
    eslint(),
    commonjs(),
    multiEntry(),
    nodeGlobals(),
    nodeResolve(),
    json(),
    babel(),
    browsersync({
      server: {
        baseDir: ['test', 'test/tmp', 'node_modules'],
        index: 'browsersync.html'
      },
      open: !isSauce,
      callbacks: {
        ready(err, bs) {
          if (!isSauce) { return; }

          runSauce();
        }
      }
    })
  ]
}
