// tslint:disable:no-implicit-dependencies
/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
import webpack from 'webpack';
import slsw from 'serverless-webpack';
import path from 'path';
import nodeExternals from 'webpack-node-externals';
import { isProd } from '@hollowverse/utils/helpers/env';

module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  mode: isProd ? 'production' : 'development',
  devtool: 'source-map',
  output: {
    libraryTarget: 'commonjs',
    path: path.resolve(__dirname, '.webpack'),
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
  plugins: [new webpack.WatchIgnorePlugin([/node_modules/])],
  externals: [nodeExternals()],
};
