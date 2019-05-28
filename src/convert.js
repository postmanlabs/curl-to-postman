var fs = require('fs'),
    lib = require('./lib.js');

module.exports = function (input, cb) {
    var result;

    if (!input) {
        cb(null, {
            result: false,
            reason: 'Invalid input object provided'
        });
    }

    if (input.type === 'string') {        
        result = lib.convertCurlToRequest(input.data);
        if(result.error) {
            return cb(null, {
                result: false,
                reason: result.error.message
            });
        }
        else {
            return cb(null, {
                result: true,
                output: [{
                  type: 'request',
                  data: result
                }]
            });
        }
    }
    else {
        return cb(null, {
            result: false,
            reason: 'Only input.type=string supported for cURL'
        });
    }
}