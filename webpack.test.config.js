const config = require('./webpack.config.js')
module.exports = config

config.entry = ['./src/test.js', './src/common_tests.js']
config.output.path = __dirname + '/test'
config.mode = 'none'
