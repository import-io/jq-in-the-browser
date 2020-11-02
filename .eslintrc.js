module.exports = {
  root: true,
  env: { es2021: true },
  overrides: [
    {
      files: 'src/tests*',
      env: { mocha: true },
    },
  ],
  parserOptions: {
    sourceType: 'module',
  },
  extends: 'eslint:recommended',
  rules: {
    'consistent-return': 'error',
    'eqeqeq': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'quotes': ['error', 'single'],
  },
}
