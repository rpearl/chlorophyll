'use strict'

process.env.BABEL_ENV = 'renderer'

const path = require('path')
const { dependencies } = require('../package.json')
const webpack = require('webpack')

const CopyWebpackPlugin = require('copy-webpack-plugin')

const outputDir = '../build/backend';

let backendConfig = {
  target: 'node',
  devtool: '#inline-source-map',
  entry: {
    backend: path.join(__dirname, '../backend/main.js')
  },
  externals: [
    ...Object.keys(dependencies || {}).filter(d => !whiteListedModules.includes(d))
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        exclude: /node_modules/,
        use: {
          loader: 'eslint-loader',
          options: {
            formatter: require('eslint-friendly-formatter')
          }
        }
      },
      {
        test: /\.js$/,
        use: [
          'cache-loader',
          'babel-loader',
        ],
        exclude: /node_modules/
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        use: {
          loader: 'url-loader',
          query: {
            limit: 10000,
            name: 'imgs/[name].[ext]'
          }
        }
      },
      // THREE examples add new constructors to the THREE object rather than
      // exporting a module, so they're imported for side effects.
      {
        test: /three\/examples\/js/,
        use: 'imports-loader?THREE=three'
      }
    ]
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    // Automatically inject 'var $ = require('jquery');' if $ is used
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    })
  ],
  output: {
    path: path.join(__dirname, '../build/backend')
    filename: 'chlorophyll.js',
  },
  resolve: {
    extensions: ['.js', '.json', '.node']
  },
}

/*
 * Production / dev config for static file paths
 */
if (process.env.NODE_ENV === 'production') {
  backendConfig.devtool = ''

  backendConfig.plugins.push(
    new CopyWebpackPlugin([
      {
        from: path.join(__dirname, '../static'),
        to: path.join(__dirname, outputDir, 'static'),
        ignore: ['.*']
      },
        {
        from: path.join(__dirname, '../../schemas'),
        to: path.join(__dirname, outputDir, 'schemas'),
        ignore: ['.*']
      }
    ]),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': '"production"'
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: false
    })
  )
} else {
  backendConfig.plugins.push(
    new webpack.DefinePlugin({
      '__static': `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`,
      '__schemas': `"${path.join(__dirname, '../../schemas').replace(/\\/g, '\\\\')}"`
    })
  )
}
module.exports = backendConfig
