import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintChaiFriendly from 'eslint-plugin-chai-friendly';
import eslintMocha from 'eslint-plugin-mocha';

const ignores = [
  'main.js',
  '**/Code.js',
  'googleads/**/*',
  'cm360/**/*',
  'ts/dv360_api/**/*',
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
  '@typescript-eslint/no-unused-expressions': ['off'],
  'mocha/max-top-level-suites': ['off'],
};

export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.browser } },
  { ignores },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintMocha.configs.flat.recommended,
  eslintChaiFriendly.configs.recommendedFlat,
  { rules },
];
