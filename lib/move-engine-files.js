const addLayout = require('../utils/add-layout');
const addAppExport = require('../utils/add-app-export');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { isFileExists, isDirExists, createDir } = require('../utils/helpers');


module.exports = (list, engineName, commonAddon) => {
  for (let file of list) {
    let { sourcePath, destinationDirectory } = file;
    if (!isFileExists(sourcePath)) {
      console.log(chalk.red(sourcePath, '=> file doesn\'t exist'));
    }

    let destinationPath1 = sourcePath.split('/app/')[0];
    let destinationPath2 = (sourcePath.split('/app/')[1] || '');
    if (engineName === destinationDirectory) {
      destinationPath2 = destinationPath2.replace(`/${engineName}/`, '/');
    }
    let inFolder = '/addon/';
    if (destinationPath2.includes('models/')) {
      // add models in app folder
      inFolder = '/app/';
    }

    let destinationPath = `${destinationPath1}/lib/${destinationDirectory}${inFolder}${destinationPath2}`;

    if (!isDirExists(path.dirname(destinationPath))) {
      createDir(path.dirname(destinationPath));
    }
    try {
      fs.renameSync(sourcePath, destinationPath);
      if (destinationPath.includes('/components/') && path.extname(destinationPath) === '.js') {
        // if component add 'import layout'
        addLayout(destinationPath);
      }
      if (!destinationPath.includes('/models/') && destinationDirectory === commonAddon && path.extname(destinationPath) === '.js') {
        addAppExport(destinationPath);
      }
      file.sourcePath = destinationPath;
    } catch (err) {
      console.log(err);
    }
  }
  return list;
};
