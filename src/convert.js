var lib = require('./lib.js');

module.exports = function (curlCommand, cb) {
	var result = lib.convertCurlToRequest(curlCommand);
    if(result.error) {
        process.nextTick(function() {
            cb(null, {
                result: false,
                reason: result.error.message
            });
        });
    }
    else {
        process.nextTick(function() {
            cb(null, {
                result: true,
                output: [{
                  type: 'request',
                  data: result
                }]
            });
        });
    }
}