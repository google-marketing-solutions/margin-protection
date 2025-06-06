/**
 * @license
 * Copyright 2024 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import GasPlugin from 'gas-webpack-plugin';
import TsConfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import path from 'path';
const __dirname = decodeURI(path.dirname(new URL(import.meta.url).pathname));

export default {
  context: __dirname,
  entry: './src/main.ts',
  output: { path: __dirname, filename: 'Code.js' },
  plugins: [new GasPlugin({ autoGlobalExportsFiles: ['**/*.ts'] })],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts'],
    plugins: [new TsConfigPathsPlugin({ configFile: './tsconfig.build.json' })],
  },
};
