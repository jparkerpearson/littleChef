module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['apps/web/**/*'],
      env: {
        browser: true,
        es2022: true,
      },
      extends: [
        'next/core-web-vitals',
      ],
    },
  ],
};
