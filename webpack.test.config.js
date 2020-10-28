const config = require('./webpack.config.js')
module.exports = config

config.entry = ['./src/tests.js', './src/tests-jqw.js']
config.output.path = __dirname + '/test'
config.mode = 'none'
