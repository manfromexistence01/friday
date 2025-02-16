module.exports = {
  extends: ['next/babel', 'next/core-web-vitals'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['next/babel'],
    },
  },
}