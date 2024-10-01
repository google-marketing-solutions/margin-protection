import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const ignores = [
  'main.js',
  '**/Code.js',
  'googleads/new/**/*',
  'cm360/**/*',
  'dv360_api/**/*',
  'dist/**/*',
];

const rules = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
};

export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.browser } },
  { rules },
  { ignores },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
];
