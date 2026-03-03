module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script'
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'max-lines': ['error', { max: 1000, skipBlankLines: true, skipComments: true }]
  },
  ignorePatterns: ['node_modules/', 'data/', 'logs/']
};
