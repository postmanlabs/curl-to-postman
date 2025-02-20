// list of all options that are supported by this module
/* eslint-disable max-len */
let supportedOptions = [
  {
    short: '-A',
    long: '--user-agent',
    description: 'An optional user-agent string',
    format: '<string>',
    collectValues: false
  },
  {
    short: '-d',
    long: '--data',
    description: 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded',
    format: '[string]',
    collectValues: true
  },
  {
    long: '--data-raw',
    description: 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded',
    format: '[string]',
    collectValues: true
  },
  {
    long: '--data-ascii',
    description: 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded',
    format: '[string]',
    collectValues: true
  },
  {
    long: '--data-urlencode',
    description: 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded',
    format: '[string]',
    collectValues: true
  },
  {
    long: '--data-binary',
    description: 'Data sent as-is',
    format: '[string]',
    collectValues: false
  },
  {
    short: '-F',
    long: '--form',
    description: 'A single form-data field',
    format: '<name=content>',
    collectValues: true
  },
  {
    short: '-G',
    long: '--get',
    description: 'Forces the request to be sent as GET, with the --data parameters appended to the query string',
    collectValues: false
  },
  {
    short: '-H',
    long: '--header',
    description: 'Add a header (can be used multiple times)',
    format: '[string]',
    collectValues: true
  },
  {
    short: '-X',
    long: '--request',
    description: 'Specify a custom request method to be used',
    format: '[string]',
    collectValues: false
  },
  {
    short: '-I',
    long: '--head',
    description: 'Forces the request to be sent as HEAD, with the --data parameters appended to the query string',
    collectValues: false
  },
  {
    short: '-T',
    long: '--upload-file',
    description: 'Forces the request to be sent as PUT with the specified local file to the server',
    format: '[string]',
    collectValues: true
  },
  {
    long: '--url',
    description: 'An alternate way to specify the URL',
    format: '[string]',
    collectValues: false
  },
  {
    long: '--basic',
    description: 'Use HTTP Basic authentication',
    collectValues: false
  },
  {
    long: '--digest',
    description: 'Use HTTP Digest authentication',
    collectValues: false
  },
  {
    long: '--ntlm',
    description: 'Use NTLM Digest authentication',
    collectValues: false
  },
  {
    short: '-u',
    long: '--user',
    description: 'Username and password for server authentication',
    format: '[string]',
    collectValues: false
  },
  {
    short: '-b',
    long: '--cookie',
    description: 'Specifies cookies to be used in the format "NAME=VALUE" or a file to read cookies from',
    format: '[string]',
    collectValues: true
  }
];
module.exports = supportedOptions;
