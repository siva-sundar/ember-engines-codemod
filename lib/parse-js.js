/* eslint-env node */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
/* eslint-disable max-len */
/* eslint-disable no-magic-numbers */
/* eslint-disable no-param-reassign */
const jscodeshift = require('jscodeshift');
const fs = require('fs');
const stripBom = require('strip-bom');
const utils = require('../utils/helpers');

let parseTemplate;

const {
  isFileExists, iterateSync, normalizePath, resolveModulePath, trimQuotes, isLiteralNode, setDestinationDirectory, resolveDepedency, isDependencyFile,
} = utils;

function walkThroughJSFile(file) {
  let imports = new Set();
  let transitionTo = new Set();
  let unknownTransitionTo = new Set();
  let injectController = new Set();
  let controllerFor = new Set();
  let unknownControllerFor = new Set();
  let controllerName = new Set();
  let templateName = new Set();
  let render = new Set();
  let unknownRender = new Set();
  let modalDialogs = new Set();
  let isRoute = file.includes('app/routes/');
  let content = stripBom(fs.readFileSync(file, { encoding: 'utf8' }));

  let ast = jscodeshift(content);
  ast.find(jscodeshift.ImportDeclaration)
    .forEach((row) => {
      let importFilePath = resolveDepedency(file, row.node.source.value);
      let filePath = `${importFilePath}.js`;
      if (isFileExists(filePath)) {
        imports.add(filePath);
      }
    });

  ast.find(jscodeshift.CallExpression).forEach((nodePath) => {
    let { value } = nodePath;
    if (value.callee.type === 'MemberExpression') {
      let route = value.arguments[0] || {};
      let functionName = value.callee.property.name;
      if (functionName === 'transitionTo' || functionName === 'transitionToRoute') {
        if (route.type === 'Literal') {
          transitionTo.add(route.raw);
        } else {
          unknownTransitionTo.add(jscodeshift(nodePath).toSource());
        }
      } else if (functionName === 'controllerFor') {
        let normalizedValue = normalizePath(route.raw || '');
        if (route.type === 'Literal' && isDependencyFile(`controllers/${normalizedValue}.js`)) {
          controllerFor.add(normalizedValue);
        } else if (route.type === 'Identifier') {
          unknownControllerFor.add(jscodeshift(nodePath).toSource());
        }
      } else if (functionName === 'render') {
        let normalizedValue = normalizePath(route.raw || '');
        if (route.type === 'Literal' && isDependencyFile(`templates/${normalizedValue}.hbs`)) {
          render.add(normalizedValue);
        } else if (route.type === 'Identifier') {
          unknownRender.add(jscodeshift(nodePath).toSource());
        }
      } else if ((functionName === 'send' || functionName === 'sendAction') && route.type === 'Literal' && ['showModal', 'show-modal'].includes(route.raw)) {
        let normalizedValue = normalizePath(value.arguments[1] || '');
        if (isDependencyFile(`templates/${normalizedValue}.hbs`)) {
          modalDialogs.add(normalizedValue);
        }
      }
    }
  });

  ast.find(jscodeshift.ObjectExpression).forEach((nodePath) => {
    let { value: node } = nodePath;
    node.properties.forEach((prop) => {
      if (prop.key.type === 'Identifier' && prop.key.name === 'controllerName' && isRoute && isLiteralNode(prop.value)) {
        controllerName.add(trimQuotes(normalizePath(prop.value.raw)));
      } else if (prop.key.type === 'Identifier' && prop.key.name === 'templateName' && isRoute && isLiteralNode(prop.value)) {
        templateName.add(trimQuotes(normalizePath(prop.value.raw)));
      } else if (prop.key.type === 'Identifier' && prop.key.name === 'layoutName' && isLiteralNode(prop.value)) {
        templateName.add(trimQuotes(normalizePath(prop.value.raw)));
      } else if (prop.key.type === 'Identifier' && prop.value.type === 'CallExpression' && prop.value.callee.raw === 'controller') {
        let controller = prop.value.arguments ? prop.value.arguments[0] : prop.key.name;
        injectController.add(trimQuotes(normalizePath(controller)));
      }
    });
  });
  return {
    imports,
    transitionTo,
    unknownTransitionTo,
    controllerFor,
    unknownControllerFor,
    render,
    unknownRender,
    templateName,
    controllerName,
    modalDialogs,
    injectController,
  };
}

function parseJS({
  file, config, moduleConfig, outputDir, commonAddon, projectRoot,
}) {
  let fileConfig = config[file];

  if (moduleConfig[file]) {
    return moduleConfig[file];
  }

  iterateSync(fileConfig.imports, (row) => {
    row = resolveModulePath(row);
    let importFilePath = row.startsWith(projectRoot) ? row : `${projectRoot}/app/${row}.js`;
    parseJS({
      file: importFilePath, config, moduleConfig, outputDir, commonAddon, projectRoot,
    });
  });
  /*
    No need

    iterateSync(fileConfig.controllerFor, (row) => {
      parseJS(`${projectRoot}/app/controllers/${row}.js`, config);
    });
  */
  iterateSync(fileConfig.templateName, (row) => {
    row = resolveModulePath(row);
    let filePath = `${projectRoot}/app/templates/${row}.hbs`;
    if (!moduleConfig[filePath]) {
      let templateConfig = parseTemplate({
        file: filePath, config, moduleConfig, outputDir, commonAddon, projectRoot,
      });
      setDestinationDirectory({
        fileName: filePath,
        dependencyFileName: file,
        fileConfig: templateConfig,
        engineName: outputDir,
        commonAddon,
      });
      moduleConfig[filePath] = templateConfig;
    }
  });
  iterateSync(fileConfig.controllerName, (row) => {
    row = resolveModulePath(row).replace('/controllers', '');
    let controllerPath = `${projectRoot}/app/controllers/${row}.js`;
    if (!moduleConfig[controllerPath]) {
      let controllerConfig = parseJS({
        file: controllerPath, config, moduleConfig, outputDir, commonAddon, projectRoot,
      });
      setDestinationDirectory({
        fileName: controllerPath,
        dependencyFileName: file,
        fileConfig: controllerConfig,
        engineName: outputDir,
        commonAddon,
      });
      moduleConfig[controllerPath] = controllerConfig;
    }
  });
  iterateSync(fileConfig.render, (row) => {
    row = resolveModulePath(row).replace('/templates', '');
    let templatePath = `${projectRoot}/app/templates/${row}.js`;
    if (!moduleConfig[templatePath]) {
      let templateConfig = parseJS({
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
  });
  iterateSync(fileConfig.injectController, (row) => {
    row = resolveModulePath(row).replace('/controllers', '');
    let controllerPath = `${projectRoot}/app/controllers/${row}.js`;

    if (!moduleConfig[controllerPath]) {
      let controllerConfig = parseJS({
        file: controllerPath, config, moduleConfig, outputDir, commonAddon, projectRoot,
      });
      setDestinationDirectory({
        fileName: controllerPath,
        dependencyFileName: file,
        fileConfig: controllerConfig,
        engineName: outputDir,
        commonAddon,
      });
      moduleConfig[controllerPath] = controllerConfig;
    }
  });
  return fileConfig;
}

module.exports = { walkThroughJSFile, parseJS };
parseTemplate = require('./parse-templates').parseTemplate;
