/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */

const webpack = require('webpack');
const path = require('path');
const BabelMinifyPlugin = require('babel-minify-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const { ifProd, isProd } = require('./env');

module.exports = {
  mode: isProd ? 'production' : 'development',
  entry: {
    cropFace: [path.join(__dirname, 'src', 'cropFace.ts')],
  },
  optimization: {
    mergeDuplicateChunks: true,
    occurrenceOrder: true,
    noEmitOnErrors: true,
    namedModules: true,
    namedChunks: true,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  target: 'node',
  devtool: 'source-map',
  output: {
    libraryTarget: 'commonjs',
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  stats: 'minimal',
  module: {
    rules: [
      {
        test: /\.ts$/i,
        use: [
          {
            loader: 'babel-loader',
          },
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: [nodeExternals()],
  plugins: [
    new webpack.WatchIgnorePlugin([/node_modules/]),
    ...ifProd([new BabelMinifyPlugin()]),
  ],
};
