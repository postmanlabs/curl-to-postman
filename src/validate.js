var lib = require('./lib.js');
module.exports = function (curlCommand) {
  // must be a string that starts with "curl "
  if (
    typeof curlCommand === 'string' &&
		curlCommand.startsWith('curl ')
  ) {
    return lib.validate(curlCommand);
  }

  return {
    result: false,
    reason: 'Curl commands must begin with `curl `'
  };
};
