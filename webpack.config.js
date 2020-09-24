const libraryName = 'jq-in-the-browser';
const outputFile = libraryName + '.js';
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  entry: './src/index.js',
  devtool: 'source-map',
  output: {
    path: __dirname + '/lib',
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  target: 'node',
  plugins: [new UglifyJsPlugin()],
  module: {
    rules: [
      {
        test: /\.pegjs$/,
        use: ['babel-loader', 'pegjs-loader'],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
    ]
  }
}
