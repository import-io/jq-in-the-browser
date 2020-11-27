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
    'brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
    'consistent-return': 'error',
    'eqeqeq': 'error',
    'implicit-arrow-linebreak': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-trailing-spaces': 'error',
    'no-var': 'error',
    'prefer-const': ['error', { destructuring: 'all' }],
    'quotes': ['error', 'single'],
    'semi': ['error', 'never'],
  },
}
