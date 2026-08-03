// ESLint flat config (ESM). Plain JavaScript + JSX — there is no TypeScript here.
//
// Deliberately loose: the goal at this stage is a gate that catches real
// breakage (undefined identifiers, broken hook rules) on the *existing*
// codebase without a mass rewrite. Tighten rule by rule as the code is
// touched; do not tighten by disabling files.

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

// Globals injected by vitest when `test.globals: true` is set.
const vitestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  suite: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', 'public/**', 'coverage/**'],
  },

  js.configs.recommended,
  react.configs.flat.recommended,
  // Vite's react plugin uses the automatic JSX runtime, so `React` does not
  // have to be in scope for JSX.
  react.configs.flat['jsx-runtime'],

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // The codebase still writes `import React from 'react'` even though the
      // automatic runtime does not need it. This rule marks that import as
      // used so no-unused-vars stays quiet, without requiring it in new files.
      'react/jsx-uses-react': 'error',

      // No prop-types in this codebase by convention.
      'react/prop-types': 'off',
      // styled-components and inline SVG markup trip these constantly.
      'react/no-unknown-property': 'off',
      'react/no-unescaped-entities': 'off',

      // Warnings, not errors: they mark cleanup work, they don't block a PR.
      'no-unused-vars': [
        'warn',
        {
          args: 'none',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'react-hooks/exhaustive-deps': 'warn',
      // The one offender (src/index.js, a dead Create React App leftover) was
      // deleted with KAN-2, so this is clean and stays an error.
      'react/no-deprecated': 'error',
    },
  },

  // Test files and the vitest setup file.
  {
    files: ['**/*.{test,spec}.{js,jsx}', 'vitest.setup.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...vitestGlobals,
      },
    },
  },

  // Node-context config files.
  {
    files: ['*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
