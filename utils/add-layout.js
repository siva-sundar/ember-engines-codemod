const fs = require('fs');
const j = require('jscodeshift');

module.exports = (filePath) => {
  let contents = fs.readFileSync(filePath, { encoding: 'utf8' });
  let parsed = j(contents);

  const isLayoutImport = p => p && p.local.name === 'layout';
  // check to see for existing layout import
  let layoutImport = parsed.find(j.ImportDefaultSpecifier, {
    local: {
      type: 'Identifier',
      name: 'layout',
    },
  });

  if (!layoutImport.value) {
    let templatePath = filePath.replace(/.*lib\/(.*\/)addon\/(.*).js/, (match, p1, p2) => `${p1}templates/${p2}`);
    let insertContent = `import layout from '${templatePath}';`;

    let imports = parsed.find(j.ImportDeclaration);
    if (imports.length) {
      imports.at(0).get().insertAfter(insertContent);
    } else {
      parsed.get().node.program.body.unshift(insertContent);
    }

    parsed
      .find(j.ExportDefaultDeclaration, {
        declaration: {
          type: 'CallExpression',
        },
      })
      .forEach((mod) => {
        j(mod).find(j.Property).at(0).get()
          .insertBefore('layout');
      });

    // parsed
    //   .find(j.ObjectExpression, { parent: 'ExportDefaultDeclaration' })
    //   .filter(p => {
    //     return p.parent.parent.value.type === 'ExportDefaultDeclaration';
    //   })
    //   .forEach(p => {
    //     j(p).find(j.Property).at(0).get().insertBefore('layout');
    //   });
    // console.log(parsed.toSource());
  }
  const outputOptions = {
    quote: 'single',
  };
  fs.writeFileSync(filePath, parsed.toSource(outputOptions));
};

// const fs = require('fs');
// const path = require('path');

// module.exports = (filePath, engineName) => {
//   let contents = fs.readFileSync(filePath, { encoding: 'utf8' });
//   if (contents.includes('import layout')) {
//     return;
//   }
//   let templatePath = filePath.replace(/.*lib\/(.*\/)addon\/(.*).js/, (match, p1, p2) => {
//     return p1 + 'templates/' + p2;
//   });
//   let insertContent = `import layout from '${templatePath}';\n`;

//   contents = insertContent + contents;

//   insertContent = '\n\tlayout,';
//   let regex = /export default.*extend\(\{/;
//   let match = contents.match(regex);
//   if (match) {
//     let insertAfterIndex = match[0].length + match.index;
//     contents = contents.slice(0, insertAfterIndex) + insertContent + contents.slice(insertAfterIndex);
//   }

//   fs.writeFileSync(filePath, contents);
// }
