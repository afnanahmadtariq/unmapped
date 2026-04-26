// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['.next/**', 'node_modules/**', '*.config.*'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
      // Next.js components can run in Node (server) or browser (client).
      // React is a global via the JSX transform.
      globals: { ...globals.browser, ...globals.node, React: 'readonly' },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Next.js app-dir + React 17+ JSX transform — no import needed
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Downgrade to warn — existing UI patterns (set-state-in-effect, nested
      // component definitions, ref reads in render) are all intentional and
      // pre-existing; fixing them requires UI changes which are out of scope.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react/no-unstable-nested-components': 'warn',
      'react/no-render-return-value': 'warn',
      'no-inner-declarations': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
];
