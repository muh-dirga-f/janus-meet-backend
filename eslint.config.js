const path = require('path');
const js = require('@eslint/js');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierFlat = require('eslint-config-prettier/flat');
const globals = require('globals');

module.exports = [
    // 1. Core eslint:recommended rules
    js.configs.recommended,

    // 2. Prettier config override
    prettierFlat,

    // 3. Project rules (TS/JS)
    {
        files: ['**/*.{ts,js}'],
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                project: path.resolve(__dirname, 'tsconfig.json'),
                tsconfigRootDir: __dirname,
                sourceType: 'module',
                ecmaVersion: 2021,
            },
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
        plugins: {
            '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
            prettier: prettierPlugin,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/explicit-function-return-type': 'warn',
            'prettier/prettier': 'error',
        },
    },
];
