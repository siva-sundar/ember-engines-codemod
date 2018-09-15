
# Ember Engines Codemod

This codemod uses [`glimmer`](https://github.com/glimmerjs/glimmer-vm) and [`jscodeshift`](https://github.com/facebook/jscodeshift) to transform a module into an in-repo-engine. It focuses mainly on moving the dependent files.

## Installation

```bash
npm i git+https://git.csez.zohocorpin.com/gerald.nishan/ember-engine-codemod.git -g
```

## Usage

Run the following command

```bash
ember-engines-codemod --inputDir=contacts --outputDir=contacts --commonAddon=common-adddon
```

`inputDir` -  Input directory name that you want to transform
`outputDir` -  Name of the in-repo engine
`commonAddon` - The name of the addon where the files shared by the app and the engine needs to be moved.


All the files of the module and its dependent files will be moved automatically. However, manual intervention is required to resolve the following.

- unknownPartial
- unknownControllerFor
- unknownInjectController
- unknownRender
- unknownComponents
- transitionTo
- `show-modal`
- updating routes.js
- Need to mention external dependencies(eg: `ember-addons`)

The above changes will be logged to `engine-codemod.log`.
