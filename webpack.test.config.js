module.exports = {
  entry: './src/jq.js',
  target: 'node',
  output: {
    filename: './lib/jq.js'
  },
  module: {
    rules: [
      {
        test: /\.pegjs$/,
        use: ['babel-loader', 'pegjs-loader'],
      }
    ]
  }
}
