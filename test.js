#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable quotes */
var lib = require('./src/lib.js'),
  result = lib.convertCurlToRequest(`curl -L 'https://countries.trevorblades.com' \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"{\r\n  countries {\r\n    code\r\n    name\r\n    emoji\r\n  }\r\n}"}'`);

console.log(result);
