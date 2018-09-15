#! /usr/bin/env node
/* eslint-env node */
/* eslint-disable no-restricted-syntax */
/* eslint-disable max-len */
/* eslint-disable no-magic-numbers */

const ora = require('ora');
const chalk = require('chalk');
const { execSync } = require('child_process');
const {
  iterateSync, getModuleName, moduleDirs, isIncludedInArray, processArguments, convertSetToArray, setDestinationDirectory, writeConfigToFile,
} = require('./utils/helpers');
const { walkThroughJSFile, parseJS } = require('./lib/parse-js');
const { walkThroughHBSFile, parseTemplate } = require('./lib/parse-templates');
const moveEngineFiles = require('./lib/move-engine-files');

const jsFiles = [];
const templates = [];
const moduleFiles = [];
const config = {};
let moduleConfig = {};
let { argv: { length } } = process;
const args = process.argv.slice(length - 4, length);
const {
  projectRoot, inputDir, outputDir, commonAddon,
} = processArguments(args);

const dirs = moduleDirs(inputDir);
const spinner = ora({
  text: '[1/7] Loading all modules',
  spinner: 'line',
}).start();

const allFiles = execSync(`find -E ${projectRoot}/app -regex ".*\\.(hbs|js)"`).toString().split('\n').filter(row => !!row);

spinner.succeed('[1/7] Loaded all modules');
spinner.start('[2/7] Generating config for .hbs and .js files (this might take a while)');

iterateSync(allFiles, (file) => {
  if (file.endsWith('.js')) {
    config[file] = walkThroughJSFile(file);
  } else {
    config[file] = walkThroughHBSFile(file, outputDir);
  }
});

spinner.succeed('[2/7] Generated config for .hbs and .js files');

spinner.start('[3/7] Loading engine related modules');
iterateSync(dirs, (dir) => {
  moduleFiles.push(...execSync(`find ${dir} -type f`).toString().split('\n').filter(row => !!row));
});

spinner.succeed('[3/7] Loaded engine related modules');
spinner.start('[4/7] Resolving interdependencies');

const dependentFiles = allFiles.filter(file => !moduleFiles.includes(file));
for (let file of moduleFiles) {
  let moduleName = getModuleName(file, projectRoot);
  for (let row of dependentFiles) {
    let fileConfig = config[row];
    let {
      imports = [],
      controllerFor = [],
      render = [],
      partials = [],
      components = [],
      templateName = [],
      injectController = [],
    } = fileConfig;
    if (isIncludedInArray(imports, file) ||
    isIncludedInArray(controllerFor, moduleName.replace('zb/controllers/', '')) ||
    isIncludedInArray(render, moduleName.replace('zb/templates/', '')) ||
    isIncludedInArray(partials, moduleName.replace('zb/templates/', '')) ||
    isIncludedInArray(components, moduleName.replace('zb/templates/', '')) ||
    isIncludedInArray(templateName, moduleName.replace('zb/templates/', '')) ||
    isIncludedInArray(components, moduleName.replace('zb/templates/', '')) ||
    isIncludedInArray(injectController, moduleName.replace('zb/templates/', ''))) {
      config[file].destinationDirectory = commonAddon;
    }
  }
}

moduleFiles.forEach((file) => {
  if (file.match(/.+\.js/g)) {
    jsFiles.push(file);
  } else if (file.match(/.+\.hbs/g)) {
    templates.push(file);
  }
});

iterateSync(jsFiles, (row) => {
  let jsConfig = parseJS({
    file: row, config, moduleConfig, outputDir, commonAddon, projectRoot,
  });

  setDestinationDirectory({
    fileName: row,
    dependencyFileName: row,
    fileConfig: jsConfig,
    engineName: outputDir,
    commonAddon,
  });
  moduleConfig[row] = jsConfig;
});

iterateSync(templates, (row) => {
  let templateConfig = parseTemplate({
    file: row, config, moduleConfig, outputDir, commonAddon, projectRoot,
  });

  setDestinationDirectory({
    fileName: row,
    fileConfig: templateConfig,
    engineName: outputDir,
    dependencyFileName: row,
    commonAddon,
  });
  moduleConfig[row] = templateConfig;
});

spinner.succeed('[4/7] Resolved inter dependencies');


moduleConfig = convertSetToArray(moduleConfig);

spinner.start(`[5/7] Creating Engine ${outputDir}`);
execSync(`ember generate in-repo-engine ${outputDir}`, { stdio: [] });
spinner.succeed(`[5/7] Successfully created engine ${chalk.green(outputDir)}`);

spinner.start('[6/7] Beginning to move engine related files');
moduleConfig = moveEngineFiles(moduleConfig, outputDir, commonAddon);


spinner.succeed('[6/7] Successfully moved engine related files');

spinner.start('[7/7] Log manual resolving discrepancy to engine-codemod.log');
writeConfigToFile(`${projectRoot}/engine-codemod.log`, moduleConfig);

spinner.succeed('[7/7] Successfully Logged manual resolving discrepancy to engine-codemod.log');

module.exports = {};
