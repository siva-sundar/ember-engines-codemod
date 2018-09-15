const fs = require('fs');
const path = require('path');
const { isDirExists, createDir } = require('../utils/helpers');

module.exports = filePath => {
  let importPath = filePath.replace(/.*lib\/(.*\/)addon\/(.*).js/, (match, p1, p2) => {
    return p1 + p2;
  });
  let contents = `export { default } from '${importPath}';\n`;

  let appExportPath = filePath.replace(/(lib\/.*\/)addon/, (match, p1) => {
    return p1 + 'app';
  });
  if (!isDirExists(path.dirname(appExportPath))) {
    createDir(path.dirname(appExportPath));
  }
  fs.writeFileSync(appExportPath, contents);
};
