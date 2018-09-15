/* eslint-env node */
/* eslint-disable no-restricted-syntax */
/* eslint-disable max-len */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-param-reassign */

const fs = require('fs');
const stripBom = require('strip-bom');
const { preprocess } = require('@glimmer/syntax');
const utils = require('../utils/helpers');
const dotTransform = require('../transforms/dot-transform');

let parseJS;

const {
  isDependencyTemplate, isDependencyJS, iterateSync, capitalize, setDestinationDirectory,
} = utils;


function processNode(node, fileConfig, engineName) {
  const { path: { original } } = node;

  if (original === 'component' || original === 'partial') {
    const firstParam = node.params[0] || {};

    if (firstParam.type === 'StringLiteral') {
      if (isDependencyTemplate(firstParam.value, engineName)) {
        fileConfig[`${original}s`].add(firstParam.value);
      } else if (isDependencyJS(firstParam.value, engineName)) {
        fileConfig.componentJS.add(firstParam.value);
      }
    } else {
      fileConfig[`unknown${capitalize(original)}s`].add(firstParam.original);
    }
  } else if (original.includes('-')) {
    if (isDependencyTemplate(original, engineName)) {
      fileConfig.components.add(original);
    } else if (isDependencyJS(original, engineName)) {
      fileConfig.componentJS.add(original);
    }
  }
}

function getPlugin(fileConfig, engineName) {
  let visitor = {
    MustacheStatement(node) {
      processNode(node, fileConfig, engineName);
    },
    BlockStatement(node) {
      processNode(node, fileConfig, engineName);
    },
    SubExpression(node) {
      processNode(node, fileConfig, engineName);
    },
  };
  function plugin() {
    return {
      visitor,
      name: 'my-plugin',
    };
  }
  return plugin;
}

function walkThroughHBSFile(file, engineName) {
  let components = new Set();
  let partials = new Set();
  let componentJS = new Set();
  let fileConfig = {
    components,
    partials,
    componentJS,
    unknownComponents: new Set(),
    unknownPartials: new Set(),
  };

  let content = fs.readFileSync(file, { encoding: 'utf8' });

  preprocess(stripBom(content), {
    moduleName: file,
    rawSource: stripBom(content),
    plugins: {
      ast: [dotTransform, getPlugin(fileConfig, engineName)],
    },
  });
  return fileConfig;
}

function parseTemplate({
  file, config, moduleConfig, outputDir, commonAddon, projectRoot,
}) {
  let fileConfig = config[file];

  if (moduleConfig[file]) {
    return moduleConfig[file];
  }
  iterateSync(fileConfig.components, (row) => {
    let templatePath = `${projectRoot}/app/templates/components/${row}.hbs`;
    let jsPath = `${projectRoot}/app/components/${row}.js`;

    if (!moduleConfig[templatePath]) {
      let templateConfig = parseTemplate({
        file: templatePath, config, moduleConfig, outputDir, commonAddon, projectRoot,
      });
      setDestinationDirectory({
        fileName: templatePath,
        dependencyFileName: file,
        fileConfig: templateConfig,
        engineName: outputDir,
        commonAddon,
      });
      moduleConfig[templatePath] = templateConfig;
    }
    if (!moduleConfig[jsPath]) {
      let jsConfig = parseJS({
        file: jsPath, config, moduleConfig, outputDir, commonAddon, projectRoot,
      });
      setDestinationDirectory({
        fileName: jsPath,
        dependencyFileName: file,
        fileConfig: jsConfig,
        engineName: outputDir,
        commonAddon,
      });
      moduleConfig[jsPath] = jsConfig;
    }
  });
  iterateSync(fileConfig.partials, (row) => {
    let partialPath = `${projectRoot}/app/templates/${row}.hbs`;
    if (!moduleConfig[partialPath]) {
      let partialConfig = parseTemplate({
        file: partialPath, config, moduleConfig, outputDir, commonAddon, projectRoot,
      });
      setDestinationDirectory({
        fileName: partialPath,
        dependencyFileName: file,
        fileConfig: partialConfig,
        engineName: outputDir,
        commonAddon,
      });
      moduleConfig[partialPath] = partialConfig;
    }
  });
  return fileConfig;
}

module.exports = { walkThroughHBSFile, parseTemplate };
parseJS = require('./parse-js').parseJS;
