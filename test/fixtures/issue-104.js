/* eslint-disable max-len */
/**
 * Fixture for https://github.com/postmanlabs/curl-to-postman/issues/104
 *
 * Real output of Chrome DevTools → Network → right-click → "Copy as cURL (bash)".
 * `--data-raw` uses bash ANSI-C quoting ($'...'), inside which `$` is a literal
 * character: variables are never expanded, so `${field}` / `${runMode}` must
 * survive the import untouched.
 */
module.exports = {
  curlText: [
    'curl --url \'https://example.com/hi\' \\',
    '  -H \'Content-Type: application/json\' \\',
    '  --data-raw $\'{"stringObjData":"{\\\\"value\\\\":\\\\"[{ name: \\\'exampleName\\\', value: \\\'${field}\\\' }]\\\\"}","stringData":"exampleString ${runMode}"}\''
  ].join('\n'),

  expectedBody: '{"stringObjData":"{\\"value\\":\\"[{ name: \'exampleName\', value: \'${field}\' }]\\"}","stringData":"exampleString ${runMode}"}'
};
