var curlConverter = require('src/convert.js');

module.exports = {
	validate: require('./src/validate'),
	convert: curlConverter.convertCurlToRequest
};