const libraryName = 'jq-in-the-browser';
const outputFile = libraryName + '.js';

module.exports = {
  entry: './src/index.js',
  output: {
    path: __dirname + '/lib',
    filename: outputFile,
    library: libraryName,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  target: 'node',
  mode: 'production',
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
