/* eslint-env node */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
/* eslint-disable max-len */
/* eslint-disable prefer-rest-params */

const fs = require('fs');
const nodePath = require('path');

const fileCache = {};
const literals = ['StringLiteral', 'Literal'];

let projectRoot = process.cwd(); // need to find a proper way to construct project root.

function isFileExists(fileName) {
  let isFileAvailable;
  if (Object.prototype.hasOwnProperty.call(fileCache, fileName)) {
    isFileAvailable = fileCache[fileName];
  } else {
    isFileAvailable = fs.existsSync(fileName);
    fileCache[fileName] = isFileAvailable;
  }
  return isFileAvailable;
}

function isDirExists(directoryPath) {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch (err) {
    return false;
  }
}

// mkdirp
function createDir(directoryPath) {
  try {
    fs.mkdirSync(directoryPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      createDir(nodePath.dirname(directoryPath));
      createDir(directoryPath);
    }
  }
}

function iterateSync(arrayList, callBack) {
  let { length } = arrayList;
  let index = 1;
  for (let row of arrayList) {
    index += 1;
    callBack(row, index, length);
  }
}

function normalizePath(path = '') {
  return path.replace(/\./g, '/');
}

function getModuleName(path) {
  return path.replace(`${projectRoot}/app`, 'zb').replace(/\.js|\.hbs/, '');
}

function moduleDirs(moduleName) {
  return [
    `${projectRoot}/app/templates/${moduleName}`,
    `${projectRoot}/app/controllers/${moduleName}`,
    `${projectRoot}/app/routes/${moduleName}`,
    `${projectRoot}/app/templates/components/${moduleName}`,
    `${projectRoot}/app/components/${moduleName}`,
    `${projectRoot}/app/models/${moduleName}`,
  ];
}

function isIncludedInArray(arr1, searchText) {
  arr1 = [...arr1];
  return arr1.find(row => row.includes(searchText));
}

function resolveModulePath(dependentModulePath) {
  return dependentModulePath.replace('zb/', '');
}
function trimQuotes(fileName) {
  return fileName.replace(/^('|")|("|')$/g, '');
}

function isLiteralNode(node) {
  return literals.includes(node.type);
}

function processArguments(args) {
  let inputDir;
  let outputDir;
  let commonAddon;

  [inputDir = '', outputDir = '', commonAddon = ''] = args.slice(-3);

  return {
    projectRoot,
    inputDir: inputDir.split('=')[1],
    outputDir: outputDir.split('=')[1],
    commonAddon: commonAddon.split('=')[1],
  };
}

function capitalize(str = '') {
  return str.replace(/\b\w/, l => l.toUpperCase());
}

const requiredKeys = ['unknownPartials', 'unknownComponents', 'unknownRender', 'unknownControllerFor', 'transitionTo', 'unknownTransitionTo', 'modalDialogs'];

function convertSetToArray(content) {
  let migrateConfig = [];
  Object.keys(content).forEach((row) => {
    let rowContent = content[row];
    Object.keys(rowContent).forEach((key) => {
      let value = rowContent[key] || '';
      if (value.constructor === Set) {
        rowContent[key] = [...value];
      }
    });
    rowContent.sourcePath = row;
    migrateConfig.push(rowContent);
  });
  return migrateConfig;
}

function writeConfigToFile(file, content) {
  let newConfig = [];
  content.forEach((rowContent) => {
    let addtoConfig = false;
    let obj = {
      src: rowContent.sourcePath,
    };
    requiredKeys.forEach((key) => {
      let unknownHash = rowContent[key] || [];
      if (unknownHash.length) {
        addtoConfig = true;
        obj[key] = [...unknownHash];
      }
    });
    if (addtoConfig) {
      newConfig.push(obj);
    }
  });
  fs.writeFileSync(file, JSON.stringify(newConfig, null, 2));
}

function setDestinationDirectory({
  fileName, dependencyFileName = '', fileConfig, engineName, commonAddon,
}) {
  let regex = new RegExp(`/(templates|components|templates/components|controllers|routes)/${engineName}/`);
  if (fileConfig.destinationDirectory !== commonAddon && fileName.match(regex) && dependencyFileName.match(regex)) {
    fileConfig.destinationDirectory = engineName;
  } else {
    fileConfig.destinationDirectory = commonAddon;
  }
}

function resolveDepedency(srcPath, fileName) {
  if (fileName.match(/\.\/|\.\.\//)) {
    let dirPath = fs.statSync(srcPath).isDirectory() ? srcPath : nodePath.dirname(srcPath);
    return nodePath.resolve(dirPath, fileName);
  }

  fileName = fileName.replace('zb/', '');
  return `${projectRoot}/app/${fileName}`;
}

function isDependencyFile(file) {
  return isFileExists(`${projectRoot}/app/${file}.js`);
}

const filePaths = {
  componentTemplate: `${projectRoot}/app/templates/components`,
  componentJS: `${projectRoot}/app/components`,
  partial: `${projectRoot}/app/templates`,
};

function isDependencyTemplate(fileName, engineModuleName) {
  if (fileName.startsWith(engineModuleName)) {
    return false;
  }
  return isFileExists(`${filePaths.componentTemplate}/${fileName}.hbs`) ||
    isFileExists(`${filePaths.partial}/${fileName}.hbs`);
}

function isDependencyJS(fileName, engineModuleName) {
  if (fileName.startsWith(engineModuleName)) {
    return false;
  }
  return isFileExists(`${filePaths.componentJS}/${fileName}.js`);
}

module.exports = {
  iterateSync,
  isFileExists,
  normalizePath,
  getModuleName,
  isIncludedInArray,
  moduleDirs,
  resolveModulePath,
  trimQuotes,
  isLiteralNode,
  processArguments,
  capitalize,
  convertSetToArray,
  isDirExists,
  createDir,
  setDestinationDirectory,
  resolveDepedency,
  isDependencyFile,
  isDependencyTemplate,
  isDependencyJS,
  writeConfigToFile,
};
