var lib = require('./lib.js');

module.exports = function (input, cb) {
  var result;

  if (!input) {
    cb(null, {
      result: false,
      reason: 'Invalid input object provided'
    });
  }

  if (input.type === 'string') {
    result = lib.getMetaData(input.data);
    if (result.error) {
      return cb(null, {
        result: false,
        error: result.error,
        reason: result.error.message
      });
    }

    return cb(null, {
      result: true,
      name: result.url,
      output: [{
        type: 'request',
        data: result.url
      }]
    });

  }

  return cb(null, {
    result: false,
    reason: 'Only input.type=string supported for cURL'
  });
};
