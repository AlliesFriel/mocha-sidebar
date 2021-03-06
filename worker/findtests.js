'use strict';

const
  Glob = require('glob').Glob,
  Mocha = require('mocha'),
  path = require('path'),
  fs = require('fs'),
  Promise = require('bluebird'),
  trimArray = require('../utils').trimArray;

const args = JSON.parse(process.argv[process.argv.length - 1]);
module.paths.push(args.rootPath, path.join(args.rootPath, 'node_modules'));
for (let file of args.requires) {
  let abs = fs.existsSync(file) || fs.existsSync(file + '.js');
  if (abs) {
    file = path.resolve(file);
  }
  require(file);
}
createMocha(args.rootPath, args.options, args.files.glob, args.files.ignore)
  .then(mocha => crawlTests(mocha.suite))
  .then(tests => {
    setTimeout(()=>{
      console.error('timeout sending to parent process. Exiting');
      process.exit(-1);      
    },5000)
    process.send(tests,(error)=>{
      if (error){
        console.error('error sending to parent process.',error);
        process.exit(-1);
      }
      console.log('data send to parent. Exiting.')
      process.exit(0);
    })
  })
  .catch(err => {
    console.error('Error:', err.stack);

    process.exit(-1);
  });

function createMocha(rootPath, options, glob, ignore) {
  return new Promise((resolve, reject) => {

    new Glob(glob, { cwd: rootPath, ignore }, (err, files) => {
      if (err) { return reject(err); }

      try {
        const mocha = new Mocha(options);
        files.forEach(file => mocha.addFile(path.resolve(rootPath, file)));
        mocha.loadFiles();
        resolve(mocha);
      } catch (ex) {
        reject(ex);
      }
    });
  });
}

function crawlTests(suite) {
  let suites = [{ suite, path: [suite.fullTitle()] }];
  let tests = [];
  while (suites.length) {
    const
      entry = suites.shift(),
      suite = entry.suite;

    tests = tests.concat(
      (suite.tests || []).map(test => {
        const name = test.title;

        return {
          name,
          //fullName: trimArray(entry.path).concat([ name ]).join(' '),
          fullName: entry.path[entry.path.length - 1].concat(' ').concat([name]),
          suitePath: entry.path,
          file: test.file
        };
      })
    );

    suites = suites.concat(
      (suite.suites || []).map(suite => {
        return {
          suite,
          path: entry.path.concat(suite.fullTitle())
        };
      })
    );
  }

  return tests;
}
