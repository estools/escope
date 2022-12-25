'use strict';
module.exports = {
    extends: 'eslint:recommended',
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly'
    },
    overrides: [{
        files: '.eslintrc.js',
        parserOptions: {
            sourceType: 'script'
        },
        rules: {
            strict: 'error'
        }
    }, {
        files: 'test/**',
        globals: {
            expect: true
        },
        env: {
            mocha: true
        }
    }],
    rules: {
        semi: ['error'],
        indent: ['error', 4, { SwitchCase: 1 }],
        'prefer-const': ['error'],
        'no-var': ['error'],
        'prefer-destructuring': ['error'],
        'object-shorthand': ['error'],
        'object-curly-spacing': ['error', 'always'],
        quotes: ['error', 'single'],
        'quote-props': ['error', 'as-needed'],
        'brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'prefer-template': ['error']
    },
    env: {
        node: true,
        es6: true
    },
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2018
    },
};
