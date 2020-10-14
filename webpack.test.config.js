const config = require('./webpack.config.js')
module.exports = config

config.entry = ['./src/tests_common.js', './src/tests_jq_web.js']
config.output.path = __dirname + '/test'
config.mode = 'none'
