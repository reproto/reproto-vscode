// @ts-check

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import nodeBuiltins from 'builtin-modules';

/** @type { import('rollup').RollupOptions } */
export default {
    input: 'out/src/extension.js',
    plugins: [
        resolve({
            preferBuiltins: true
        }),
        commonjs()
    ],
    external: [...nodeBuiltins, 'vscode'],
    output: {
        file: './out/src/extension.js',
        format: 'cjs'
    }
};