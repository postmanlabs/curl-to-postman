/* eslint-disable max-len */

module.exports = {
  USER_ERRORS: {
    INVALID_FORMAT: 'Invalid format for cURL.',
    METHOD_NOT_SUPPORTED: (_, method) => { return `The method ${method} is not supported.`; },
    UNABLE_TO_PARSE_HEAD_AND_DATA: 'Unable to parse: Both (--head/-I) and (-d/--data/--data-raw/--data-binary/--data-ascii/--data-urlencode) are not supported.',
    UNABLE_TO_PARSE_NO_URL: 'Unable to parse: Could not identify the URL. Please use the --url option.',
    CANNOT_DETECT_URL: 'Could not detect the URL from cURL. Please make sure it\'s a valid cURL.',
    INPUT_WITHOUT_OPTIONS: 'Only the URL can be provided without an option preceding it. All other inputs must be specified via options.',
    MALFORMED_URL: 'Please check your cURL string for malformed URL.'
  }
};

