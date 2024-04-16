/* eslint-disable max-len */
const largeRequest = require('./large-request');

var Converter = require('../src/lib'),
  convert = require('../src/convert'),
  getMetaData = require('../index').getMetaData,
  validate = require('../index').validate,
  expect = require('expect.js'),
  _ = require('lodash');

describe('validate', function () {
  it('return false result for malformed curl snippet', function (done) {
    const result = validate('curl --request');
    expect(result.result).to.equal(false);
    expect(result.reason).to.equal('Unable to parse: Could not identify the URL.' +
      ' Please use the --url option.');
    expect(result.error).to.have.property('message', result.reason);
    done();
  });
});

describe('getMetaData', function () {
  it('get meta data for a correct simple request', function (done) {
    getMetaData({
      type: 'string',
      data: 'curl --request GET --url http://www.google.com'
    }, function (err, result) {
      expect(result.result).to.equal(true);

      expect(result.output.length).to.equal(1);
      expect(result.output[0].type).to.equal('request');
      expect(result.name).to.equal('http://www.google.com');
      done();
    });
  });

  it('return false result for malformed curl snippet', function (done) {
    getMetaData({
      type: 'string',
      data: 'curl --request'
    }, function (err, result) {
      expect(result.result).to.equal(false);
      expect(result.reason).to.equal('Unable to parse: Could not identify the URL.' +
        ' Please use the --url option.');
      expect(result.error).to.have.property('message', result.reason);
      done();
    });
  });

  it('return false result requests that do not contain a URL', function (done) {
    getMetaData({
      type: 'string',
      data: 'curl --location --request POST --header "Content-Type: application/json"'
    }, function (err, result) {
      expect(result.result).to.equal(false);
      expect(result.reason).to.equal('Unable to parse: Could not identify the URL.' +
        ' Please use the --url option.');
      expect(result.error).to.have.property('message', result.reason);
      done();
    });
  });
});

describe('Curl converter should', function() {

  it('throw an error for a malformed request', function (done) {
    convert({
      type: 'string',
      data: 'curl --request'
    }, function (err, result) {
      expect(result.result).to.equal(false);
      expect(result.reason).to.equal('Unable to parse: Could not identify the URL.' +
       ' Please use the --url option.');
      expect(result.error).to.have.property('message', result.reason);
      done();
    });
  });

  it('return false result requests that do not contain a URL', function (done) {
    convert({
      type: 'string',
      data: 'curl --location --request POST --header "Content-Type: application/json"'
    }, function (err, result) {
      expect(result.result).to.equal(false);
      expect(result.reason).to.equal('Unable to parse: Could not identify the URL.' +
        ' Please use the --url option.');
      expect(result.error).to.have.property('message', result.reason);
      done();
    });
  });

  it('throw an error when an invalid method is specificied', function (done) {
    convert({
      type: 'string',
      data: 'curl --request INVALIDMETHOD --url http://www.google.com'
    }, function (err, result) {
      expect(result.result).to.equal(false);
      expect(result.reason).to.equal('The method INVALIDMETHOD is not supported.');
      expect(result.error).to.have.property('message', result.reason);
      done();
    });
  });

  it('throw an error for a cURL without URL defined correctly', function (done) {
    convert({
      type: 'string',
      data: 'curl -X POST -H \'Content-type: application/json\' #{reply_url} --data \'#{response.to_json}\''
    }, function (err, result) {
      expect(result.result).to.equal(false);
      expect(result.reason).to.equal('Unable to parse: Could not identify the URL.' +
       ' Please use the --url option.');
      expect(result.error).to.have.property('message', result.reason);
      done();
    });
  });

  it('[Github #7390]: set request URL correctly irrespective of where it is mentioned', function (done) {
    convert({
      type: 'string',
      data: 'curl -i http://example.com -d "{\\"a\\": 1}"'
    }, function (err, result) {
      expect(result.result).to.equal(true);
      expect(result.output[0].data.url).to.equal('http://example.com');
      done();
    });
  });

  describe('[Github #2791]: escaping single and double quotes correctly', function() {
    it('in case where there is nothing between single and double quote', function(done) {
      convert({
        type: 'string',
        // eslint-disable-next-line quotes
        data: `curl http://example.com -d $'{"a":"\\'\""}' -H 'Content-type: application/json'`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output[0].data.body.raw).to.equal('{"a":"\'\""}');
        done();
      });
    });
    it('in case where there is something between single and double quote', function(done) {
      convert({
        type: 'string',
        // eslint-disable-next-line quotes
        data: `curl http://example.com -d $'{"a":"\"abcd\\'"}' -H 'Content-type: application/json'`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output[0].data.body.raw).to.equal('{"a":"\"abcd\'"}');
        done();
      });
    });
  });

  it('not throw an error for sending GET with a request body', function (done) {
    convert({
      type: 'string',
      data: 'curl -X GET -d "a=b&c=d" http://post.com'
    }, function (err, result) {
      expect(result.result).to.equal(true);
      done();
    });
  });

  describe('[Github #2] - set the method to ', function() {
    it('GET if --get option is given in the curl command', function(done) {
      convert({
        type: 'string',
        data: 'curl --get https://example.com'
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });

    it('POST if only -d option is given in the curl command', function(done) {
      convert({
        type: 'string',
        data: 'curl -d "key=example" https://example.com'
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output[0].data.method).to.equal('POST');
        done();
      });
    });

    it('HEAD if --head or -I is given in the curl command', function(done) {
      convert({
        type: 'string',
        data: 'curl --head https://example.com'
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output[0].data.method).to.equal('HEAD');
        done();
      });
    });

    it('PUT if -T or --upload-file is given in the curl command', function(done) {
      convert({
        type: 'string',
        data: 'curl --upload-file "./example.txt" https://example.com'
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output[0].data.method).to.equal('PUT');
        done();
      });
    });
  });
  it('[Github: #1]: not throw an error for having $ before method', function (done) {
    convert({
      type: 'string',
      data: 'curl -X $\'POST\' \'https://example.com.br/login.html\''
    }, function (err, result) {
      expect(result.result).to.equal(true);
      expect(result.output[0].data.method).to.equal('POST');
      done();
    });
  });

  it('convert a correct simple request', function (done) {
    convert({
      type: 'string',
      data: 'curl --request GET --url http://www.google.com'
    }, function (err, result) {
      expect(result.result).to.equal(true);

      expect(result.output.length).to.equal(1);
      expect(result.output[0].type).to.equal('request');

      var request = result.output[0].data;
      expect(request.method).to.equal('GET');
      expect(request.url).to.equal('http://www.google.com');
      done();
    });
  });

  it('convert a simple request with comment at the end correctly', function (done) {
    convert({
      type: 'string',
      data: 'curl --request GET --url http://www.google.com #comment1'
    }, function (err, result) {
      expect(result.result).to.equal(true);

      expect(result.output.length).to.equal(1);
      expect(result.output[0].type).to.equal('request');

      var request = result.output[0].data;
      expect(request.method).to.equal('GET');
      expect(request.url).to.equal('http://www.google.com');
      done();
    });
  });

  it('convert a simple GET request', function (done) {
    var result = Converter.convertCurlToRequest('curl --request GET --url http://www.google.com');
    expect(result.method).to.equal('GET');
    expect(result.url).to.equal('http://www.google.com');
    done();
  });

  it('throw an error if POST body option is given with HEAD without --get/-G', function(done) {
    convert({
      type: 'string',
      data: 'curl -I http://example.com -d "a=b"'
    }, function (err, result) {
      expect(result.result).to.equal(false);
      expect(result.reason).to.equal('Unable to parse: Both (--head/-I) and' +
       ' (-d/--data/--data-raw/--data-binary/--data-ascii/--data-urlencode) are not supported.');
      expect(result.error).to.have.property('message', result.reason);
      done();
    });
  });

  it('convert a simple GET request w/o the --url param', function (done) {
    var result = Converter.convertCurlToRequest('curl --request GET http://www.google.com');
    expect(result.method).to.equal('GET');
    expect(result.url).to.equal('http://www.google.com');
    done();
  });

  it('append the data params with & if query params are already present in the url', function (done) {
    convert({
      type: 'string',
      data: 'curl -d "a=b" --get http://post.com?name=example'
    }, function (err, result) {
      expect(result.result).to.equal(true);
      expect(result.output[0].data.url).to.equal('http://post.com?name=example&a=b');
      done();
    });
  });

  it('convert a simple GET request w/ headers', function (done) {
    var result = Converter.convertCurlToRequest('curl --request GET http://www.google.com -H ' +
     '"h1:v1" -H "h2:v2" -H "h3;" -H "h4" -H "h1:v11"'),
      h1Header = _.find(result.header, function (header) { return header.key === 'h1'; }),
      h2Header = _.find(result.header, function (header) { return header.key === 'h2'; }),
      h3Header = _.find(result.header, function (header) { return header.key === 'h3'; }),
      h4Header = _.find(result.header, function (header) { return header.key === 'h4'; });

    expect(h1Header.value).to.equal('v1');
    expect(h2Header.value).to.equal('v2');
    expect(h3Header.value).to.equal('');
    expect(h4Header).to.be(undefined);

    done();
  });

  it('convert a simple GET request w/ user-agent', function (done) {
    var result = Converter.convertCurlToRequest('curl --request GET http://www.google.com --user-agent mosaic'),
      uaHeader = _.find(result.header, function (header) { return header.key === 'User-Agent'; });
    expect(uaHeader.value).to.equal('mosaic');


    // should clear user-agent this time
    result = Converter.convertCurlToRequest('curl --request GET http://www.google.com');

    uaHeader = _.find(result.header, function (header) { return header.key === 'User-Agent'; });
    expect(uaHeader).to.be(undefined);

    done();
  });

  describe('auth', function () {
    it('convert a simple GET request with Basic auth', function () {
      const result = Converter.convertCurlToRequest('curl -u testUser:testPass --url "http://postman-echo.com/get"');

      expect(result.auth.type).to.equal('basic');
      expect(result.auth.basic[0].key).to.equal('username');
      expect(result.auth.basic[0].value).to.equal('testUser');
      expect(result.auth.basic[1].key).to.equal('password');
      expect(result.auth.basic[1].value).to.equal('testPass');
    });

    it('convert a simple GET request with Digest auth', function () {
      const result = Converter.convertCurlToRequest('curl -u testUser:testPass --digest "http://postman-echo.com/get"');

      expect(result.auth.type).to.equal('digest');
      expect(result.auth.digest[0].key).to.equal('username');
      expect(result.auth.digest[0].value).to.equal('testUser');
      expect(result.auth.digest[1].key).to.equal('password');
      expect(result.auth.digest[1].value).to.equal('testPass');
    });

    it('convert a simple GET request with NTLM auth', function () {
      const result = Converter.convertCurlToRequest('curl -u testUser:testPass --ntlm "http://postman-echo.com/get"');

      expect(result.auth.type).to.equal('ntlm');
      expect(result.auth.ntlm[0].key).to.equal('username');
      expect(result.auth.ntlm[0].value).to.equal('testUser');
      expect(result.auth.ntlm[1].key).to.equal('password');
      expect(result.auth.ntlm[1].value).to.equal('testPass');
    });

    it('convert a simple GET request with Basic auth with only username', function () {
      const result = Converter.convertCurlToRequest('curl -u testUser --url "http://postman-echo.com/get"');

      expect(result.auth.type).to.equal('basic');
      expect(result.auth.basic[0].key).to.equal('username');
      expect(result.auth.basic[0].value).to.equal('testUser');
      expect(result.auth.basic[1].key).to.equal('password');
      expect(result.auth.basic[1].value).to.equal('');
    });
  });

  it('convert a request with a forced POST', function (done) {
    var result = Converter.convertCurlToRequest('curl -X POST --get --url http://www.google.com -d ' +
     '"username=postman&password=newman&randomKey"');

    // even with --get
    expect(result.method).to.equal('POST');
    expect(result.url).to.equal('http://www.google.com?username=postman&password=newman&randomKey');

    done();
  });

  it('convert a simple POST request', function (done) {
    var result = Converter.convertCurlToRequest('curl --request POST --url http://www.google.com');
    expect(result.method).to.equal('POST');
    expect(result.url).to.equal('http://www.google.com');

    done();
  });

  it('convert a simple POST request with -X', function (done) {
    var result = Converter.convertCurlToRequest('curl -X POST --url http://www.google.com');
    expect(result.method).to.equal('POST');
    expect(result.url).to.equal('http://www.google.com');

    done();
  });

  it('convert a simple POST request with formdata', function (done) {
    var result = Converter.convertCurlToRequest('curl --request POST --url http://google.com -F ' +
     '"username=postman" -F "password=newman"'),
      usernameRow, passwordRow;

    expect(result.body.mode).to.equal('formdata');

    usernameRow = _.find(result.body.formdata, function (row) { return row.key === 'username'; });
    passwordRow = _.find(result.body.formdata, function (row) { return row.key === 'password'; });

    expect(usernameRow.value).to.equal('postman');
    expect(usernameRow.type).to.equal('text');

    expect(passwordRow.value).to.equal('newman');
    expect(passwordRow.type).to.equal('text');

    done();
  });

  it('convert a simple POST request with x-www-form-urlencoded data', function (done) {
    var result = Converter.convertCurlToRequest('curl --request POST --url http://google.com ' +
     '-d "username=postman&password=newman&randomKey"'),
      usernameRow, passwordRow, randomKeyRow;
    expect(result.body.mode).to.equal('urlencoded');

    usernameRow = _.find(result.body.urlencoded, function (row) { return row.key === 'username'; });
    passwordRow = _.find(result.body.urlencoded, function (row) { return row.key === 'password'; });
    randomKeyRow = _.find(result.body.urlencoded, function (row) { return row.key === 'randomKey'; });

    expect(usernameRow.value).to.equal('postman');
    expect(usernameRow.type).to.equal('text');

    expect(passwordRow.value).to.equal('newman');
    expect(passwordRow.type).to.equal('text');

    expect(randomKeyRow.value).to.equal('');
    expect(randomKeyRow.type).to.equal('text');

    done();
  });

  it('convert a simple request with a arg-less option before the URL', function (done) {
    var result = Converter.convertCurlToRequest('curl --compressed \'http://www.google.com\'');
    expect(result.method).to.equal('GET');
    expect(result.url).to.equal('http://www.google.com');

    done();
  });

  it('convert a simple request with a arg-less option after the URL (Github #4770)', function (done) {
    var result = Converter.convertCurlToRequest('curl -X POST http://www.google.com --compressed');
    expect(result.method).to.equal('POST');
    expect(result.url).to.equal('http://www.google.com');

    done();
  });

  it('convert a simple request with a arg-less option after the URL', function (done) {
    var result = Converter.convertCurlToRequest('curl -XPOST http://www.google.com --compressed');
    expect(result.method).to.equal('POST');
    expect(result.url).to.equal('http://www.google.com');

    done();
  });

  it('urldecode urlencoded data params while importing (Github #3623)', function (done) {
    var result = Converter.convertCurlToRequest('curl --url testUrl -X POST -H \'content-type:' +
     'application/x-www-form-urlencoded\' -d \'config_type=v1%3Av2%3Av3\''),
      row;

    expect(result.body.mode).to.equal('urlencoded');

    row = _.find(result.body.urlencoded, function (row) { return row.key === 'config_type'; });
    expect(row.value).to.equal('v1:v2:v3'); // and not v1%3Av2%3Av3

    done();
  });

  it('support -XPOST type method specifiers (Github #3135)', function (done) {
    var result = Converter.convertCurlToRequest('curl --url testUrl -XPOST');
    expect(result.method).to.equal('POST');
    expect(result.url).to.equal('testUrl');

    result = Converter.convertCurlToRequest('curl testUrl -XPOST');
    expect(result.method).to.equal('POST');
    expect(result.url).to.equal('testUrl');

    done();
  });

  it('Github #2791', function (done) {
    // no idea how to solve this yet
    // eslint-disable-next-line no-implicit-globals
    str = 'curl -XPOST \'http://httpbin.org/post\' --data-binary $\'{"SearchTerms":' +
    '[{"termValue":"`~!@#$%^&*()-+=<.,./?;:\'\\"[{]}\\\\|","termOption"\:2}]}\'';
    Converter.convertCurlToRequest(str);
    done();
  });

  it('Empty data strings should work (Github #4018)', function (done) {
    let result1 = Converter.convertCurlToRequest('curl http://getpostman.com/ --data \"\"'),
      result2 = Converter.convertCurlToRequest('curl http://getpostman.com/ --data \'\'');
    expect(result1.body).to.be.empty();
    expect(result2.body).to.be.empty();

    done();
  });

  it('Should not try to resolve env vars in the curl input', function (done) {
    var result = Converter.convertCurlToRequest('curl --location --request POST ' +
     '"https://sample.com" --header "h1: $v1"'),
      header = _.find(result.header, function (header) { return header.key === 'h1'; });
    expect(header.value).to.equal('$v1');
    done();
  });

  it('[GitHub #8126] [GitHub #7983] [GitHub #7895]: should import body data with --data-raw argument', function (done) {

    // content-type application/json, so mode = raw
    var result = Converter.convertCurlToRequest(`curl --location --request POST "https://sample.com"
    --header "Content-Type: application/json"
    --data-raw '{ "sampleKey": "sampleValue" }'`),
      rawBody = {
        sampleKey: 'sampleValue'
      };
    expect(result.body).to.have.property('mode', 'raw');
    expect(JSON.parse(result.body.raw)).to.eql(rawBody);

    // no content-type, so mode = appliation/x-www-form-urlencoded
    result = Converter.convertCurlToRequest(`curl --location --request POST 'https://postman-echo.com/post'
    --data-raw 'raw body'`);
    expect(result.body).to.have.property('mode', 'urlencoded');
    expect(result.body.urlencoded[0]).to.eql({
      key: 'raw body',
      value: '',
      type: 'text'
    });
    done();
  });

  it('should import body data with --data-raw argument containing "+"', function (done) {
    var result = Converter.convertCurlToRequest(`curl --location --request POST "https://sample.com"
    --header "Content-Type: application/x-www-form-urlencoded"
    --data-raw 'a=hello+world&key+with+space=hello%20world'`);

    expect(result.body).to.have.property('mode', 'urlencoded');
    expect(result.body.urlencoded[0]).to.eql({
      key: 'a',
      value: 'hello world',
      type: 'text'
    });
    expect(result.body.urlencoded[1]).to.eql({
      key: 'key with space',
      value: 'hello world',
      type: 'text'
    });

    done();
  });

  it('[GitHub #7806]: should parse -X method correctly', function (done) {
    var result = Converter.convertCurlToRequest('curl -H "X-XSRF-Token: token_value" https://domain.com');
    expect(result.method).to.eql('GET');
    expect(result.header).to.eql([
      {
        key: 'X-XSRF-Token',
        value: 'token_value'
      }
    ]);

    // should not tamper -X present elsewhere than method name
    result = Converter.convertCurlToRequest(`curl -XPUT -H "accept:application/-Xjson"
    https://domain-Xvalue.com --data-raw "a=-Xb"`);
    expect(result.method).to.equal('PUT');
    expect(result.url).to.equal('https://domain-Xvalue.com');
    expect(result.header).to.eql([
      {
        key: 'accept',
        value: 'application/-Xjson'
      }
    ]);
    expect(result.body).to.eql({
      mode: 'urlencoded',
      urlencoded: [
        {
          key: 'a',
          value: '-Xb',
          type: 'text'
        }
      ]
    });

    // check for various positions of -XMETHOD
    result = Converter.convertCurlToRequest('curl -XPUT https://domain.com');
    expect(result.method).to.equal('PUT');
    result = Converter.convertCurlToRequest('curl https://domain.com -XPUT --data “d“');
    expect(result.method).to.equal('PUT');
    result = Converter.convertCurlToRequest('curl https://domain.com --data “d“ -XPUT -H ”a:b”');
    expect(result.method).to.equal('PUT');
    result = Converter.convertCurlToRequest('curl https://domain.com --data “d“ -H ”a:b” -XPUT');
    expect(result.method).to.equal('PUT');

    // more than one -XMETHOD, last one gets the preference
    result = Converter.convertCurlToRequest('curl -XGET -XPUT https://domain.com');
    expect(result.method).to.equal('PUT');
    done();
  });

  it('[GitHub #8292]: should import body with --data-urlencode argument', function (done) {
    var result = Converter.convertCurlToRequest(`curl --location --request POST 'https://httpbin.org/post'
    --header 'accept: application/json'
    --header 'Content-Type: application/x-www-form-urlencoded'
    --data-urlencode 'test=test'`);
    expect(result.body).to.have.property('mode', 'urlencoded');
    expect(result.body.urlencoded[0]).to.eql({
      key: 'test',
      value: 'test',
      type: 'text'
    });
    done();
  });

  it('[GitHub #8505] [GitHub #8953]: should correctly handle unicode characters present in data', function (done) {
    var result = Converter.convertCurlToRequest(`curl 'http://localhost:4000/graphql' \\
    --data-binary $'[{"operationName":"someMutation","variables":{"aRequiredVar":"foo\\x78bar\\u{1064A9}"},"query":` +
    '"mutation someMutation($aRequiredVar: String\\u0021) {\\\\n  mutateSomething(aRequiredVar: $aRequiredVar) ' +
    `{\\\\n    message\\\\n    __typename\\\\n  }\\\\n}\\\\n"}]' \\
    --compressed`);

    expect(result.body).to.have.property('mode', 'raw');
    expect(result.body.raw).to.eql('[{\"operationName\":\"someMutation\",\"variables\":{\"aRequiredVar\":' +
      '\"fooxbar撩\"},\"query\":\"mutation someMutation($aRequiredVar: String!) {\\n  mutateSomething(aRequiredVar: ' +
      '$aRequiredVar) {\\n    message\\n    __typename\\n  }\\n}\\n\"}]');
    done();
  });

  it('[GitHub #9391] [GitHub #10090]: should correctly handle escaped newlines present in data', function (done) {
    var result = Converter.convertCurlToRequest(`curl 'https://api.secretdomain.com/v3/login.awp' \\
      -H 'authority: api.secretdomain.com' \\
      -H 'accept: application/json, text/plain, */*' \\
      -H 'content-type: application/x-www-form-urlencoded' \\
      -H 'origin: https://www.secretdomain.com' \\
      --data-raw $'data={\n  "username": "someValue",\n  "password": "somethingSecret",\n  "token": "secret-token"\n}'\\
      --compressed`);

    expect(result.body).to.have.property('mode', 'urlencoded');
    expect(result.body.urlencoded[0].value).to.eql('{\n  "username": "someValue",\n  "password": "somethingSecret"' +
      ',\n  "token": "secret-token"\n}');
    expect(JSON.parse(result.body.urlencoded[0].value)).to.be.an.object;
    done();
  });

  it('[GitHub #10090]: should correctly handle escaped newlines present in data', function (done) {
    var result = Converter.convertCurlToRequest(`curl 'http://host' \\
    --data-binary $'{\n  "foo": "bar"\n}'`);

    expect(result.body).to.have.property('mode', 'raw');
    expect(result.body.raw).to.eql('{\n  "foo": "bar"\n}');
    expect(JSON.parse(result.body.raw)).to.be.an.object;
    done();
  });

  it('[GitHub #4772]: should correctly handle escaped newlines present in urlencoded data', function (done) {
    var result = Converter.convertCurlToRequest(`curl 'https://api.secretdomain.com/v3/login.awp' --data-raw \\
      $'data={\n    "username": "someValue",\n    "password": "somethingSecret",\n    "token": "secret-token"\n}' \\
      --compressed`);

    expect(result.body).to.have.property('mode', 'urlencoded');
    expect(result.body.urlencoded.length).to.eql(1);
    expect(result.body.urlencoded[0].key).to.eql('data');
    expect(result.body.urlencoded[0].value).to.eql('{\n    \"username\": \"someValue\",\n    \"password\": ' +
      '\"somethingSecret\",\n    \"token\": \"secret-token\"\n}');
    done();
  });

  it('[GitHub #7895]: should correctly handle raw form data with boundry separated body', function (done) {
    var result = Converter.convertCurlToRequest(`curl 'https://httpbin.org/post'
    -H 'Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7oJTsSWYoA2LdaPx' --data $'` +
    '------WebKitFormBoundary7oJTsSWYoA2LdaPx\r\nContent-Disposition: form-data; name="source"\r\n\r\ns\r\n' +
    '------WebKitFormBoundary7oJTsSWYoA2LdaPx\r\nContent-Disposition: form-data; name="files"; ' +
    'filename="index.js"\r\n\r\nt\r\n------WebKitFormBoundary7oJTsSWYoA2LdaPx--\r\n\' --compressed');

    expect(result.body).to.have.property('mode', 'formdata');
    expect(result.body.formdata[0]).to.eql({
      key: 'source',
      value: 's',
      type: 'text'
    });
    expect(result.body.formdata[1]).to.eql({
      key: 'files',
      value: 'index.js',
      type: 'file'
    });
    done();
  });

  it('[GitHub #10068]: should correctly handle raw form data with boundry separated body', function (done) {
    var result = Converter.convertCurlToRequest(`curl --location --request POST 'https://httpbin.org/post' \\
    --header 'Content-Type: multipart/form-data' \\
    --form 'name="value"' \\
    --form 'request="{\"hello\":\"world\"}"'`);

    expect(result.body).to.have.property('mode', 'formdata');
    expect(result.body.formdata.length).to.eql(2);
    expect(result.body.formdata[0].key).to.eql('name');
    expect(result.body.formdata[0].value).to.eql('value');
    expect(result.body.formdata[1].key).to.eql('request');
    expect(result.body.formdata[1].value).to.eql('{\"hello\":\"world\"}');
    done();
  });

  it('[GitHub #5299]: should correctly import file references for formdata', function(done) {
    var result = Converter.convertCurlToRequest('curl -F "content=@/Users/John/file.txt" google.com');
    expect(result.body).to.have.property('mode', 'formdata');
    expect(result.body.formdata[0]).to.eql({
      key: 'content',
      value: '/Users/John/file.txt',
      type: 'file'
    });
    done();
  });

  it('[GitHub #8506]: should correctly add content type field for formdata', function(done) {
    var result = Converter.convertCurlToRequest(`curl --location --request POST 'https://httpbin.org/post' \\
    --header 'Content-Type: multipart/form-data' \\
    --form 'request={ "title": "My template" };type=application/json' \\
    --form 'contentFile=@/tmp/archive.zip;type=application/octet-stream'`);

    expect(result.body).to.have.property('mode', 'formdata');
    expect(result.body.formdata[0]).to.eql({
      key: 'request',
      value: '{ "title": "My template" }',
      contentType: 'application/json',
      type: 'text'
    });
    expect(result.body.formdata[1]).to.eql({
      key: 'contentFile',
      value: '/tmp/archive.zip',
      contentType: 'application/octet-stream',
      type: 'file'
    });
    done();
  });

  it('[Github #9941]: should correctly identify graphql queries', function(done) {
    var result = Converter.convertCurlToRequest(`curl -L 'https://countries.trevorblades.com' \\
    -H 'Content-Type: application/json' \\
    -d '{"query":"{\r\n  countries {\r\n    code\r\n    name\r\n    emoji\r\n  }\r\n}","variables":{}}'`);

    expect(result.body).to.have.property('mode', 'graphql');
    expect(result.body.graphql.query).to.eql('{\r\n  countries {\r\n    code\r\n    name\r\n    emoji\r\n  }\r\n}');
    expect(result.body.graphql.variables).to.eql('');
    done();
  });

  it('[Github #12349]: should correctly convert graphql queries without operationName', function(done) {
    var result = Converter.convertCurlToRequest(`curl --location 'https://spacex-production.up.railway.app' \\
    --header 'Content-Type: application/json' \\
    --data '{"query":"query getCompanyData {\r\n    company {\r\n        ceo\r\n    }\r\n}","variables":{}}'`);

    expect(result.body).to.have.property('mode', 'graphql');
    expect(result.body.graphql.query).to.eql('query getCompanyData {\r\n    company {\r\n        ceo\r\n    }\r\n}');
    expect(result.body.graphql.variables).to.eql('');
    expect(result.body.graphql).to.not.have.property('operationName');
    done();
  });

  it('should convert a POST request and assign json language using content-type header', function(done) {
    var result = Converter.convertCurlToRequest(`curl -X POST -H "Content-Type: application/json" \\
    -d \'{"key":"value"}\' https://www.example.com`);

    expect(result.body).to.eql({
      mode: 'raw',
      raw: '{"key":"value"}',
      options: { raw: { language: 'json' } }
    });

    done();
  });

  it('should convert a POST request and assign xml language using content-type header', function(done) {
    var result = Converter.convertCurlToRequest(`curl -X POST -H "Content-Type: application/xml" \\
    -d \'<root><key>value</key></root>\' https://www.example.com`);

    expect(result.body).to.eql({
      mode: 'raw',
      raw: '<root><key>value</key></root>',
      options: { raw: { language: 'xml' } }
    });

    done();
  });

  describe('[Github #8843]: It should recognize non-apostrophed ("...") url with multi-param', function() {
    it('in case where there is multiple params with & in between in the url (https)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (SM-A705FN Build/QP1A.190711.020)" \\
        -H "Authorization: bearer XXX" \\
        -H "Build: 4.6.4.459" \\
        -H "Platform: Android" \\
        -H "Accept-Language: tr-TR" \\
        -H "Content-Type: application/json" \\
        https://test.com/test/foo?bar=1&baz=2`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        const headerArr = result.output[0].data.header;
        expect(headerArr[0].key).to.equal('User-Agent');
        expect(headerArr[0].value).to.equal('Dalvik/2.1.0 (SM-A705FN Build/QP1A.190711.020)');
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        expect(result.output[0].data.url).to.equal('https://test.com/test/foo?bar=1&baz=2');
        done();
      });
    });
    it('in case where there is multiple params with & in between in the url in apostrophes (https)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (SM-A705FN Build/QP1A.190711.020)" \\
        -H "Authorization: bearer XXX" \\
        -H "Build: 4.6.4.459" \\
        -H "Platform: Android" \\
        -H "Accept-Language: tr-TR" \\
        -H "Content-Type: application/json" \\
        "https://test.com/test/foo?bar=1&baz=2"`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        const headerArr = result.output[0].data.header;
        expect(headerArr[0].key).to.equal('User-Agent');
        expect(headerArr[0].value).to.equal('Dalvik/2.1.0 (SM-A705FN Build/QP1A.190711.020)');
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        expect(result.output[0].data.url).to.equal('https://test.com/test/foo?bar=1&baz=2');
        done();
      });
    });
    it('in case where there is multiple params with & in between in the url (http)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Build: 4.6.4.459" \\
        -H "Platform: Android" \\
        -H "Accept-Language: tr-TR" \\
        -H "Content-Type: application/json" \\
        http://test.com/test/foo?bar=1&baz=2`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('http://test.com/test/foo?bar=1&baz=2');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        done();
      });
    });
    it('in case where there is multiple params (3-4) with & in between in the url (https)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Build: 4.6.4.459" \\
        -H "Platform: Android" \\
        -H "Accept-Language: tr-TR" \\
        -H "Content-Type: application/json" \\
        https://test.com/test/foo?bar=1&baz=2&bax=3`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://test.com/test/foo?bar=1&baz=2&bax=3');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        // done();
      });
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Build: 4.6.4.459" \\
        -H "Platform: Android" \\
        -H "Accept-Language: tr-TR" \\
        -H "Content-Type: application/json" \\
        https://test.com/test/foo?bar=1&baz=2&bax=3&bay=4`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://test.com/test/foo?bar=1&baz=2&bax=3&bay=4');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        done();
      });
    });
    it('in case where there is multiple params with & in between in the url in apostrophes (http)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Build: 4.6.4.459" \\
        -H "Platform: Android" \\
        -H "Accept-Language: tr-TR" \\
        -H "Content-Type: application/json" \\
        "http://test.com/test/foo?bar=1&baz=2"`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('http://test.com/test/foo?bar=1&baz=2');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        done();
      });
    });
    it('in case where there is multiple params with & in between in the url (www)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        "www.test.com/test/foo?bar=1&baz=2"`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('www.test.com/test/foo?bar=1&baz=2');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        done();
      });
    });
    it('in case where there is multiple params with & in between in the url (without www)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (SM-A705FN Build/QP1A.190711.020)" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        "test.com/test/foo?bar=1&baz=2"`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        const headerArr = result.output[0].data.header;
        expect(headerArr[0].key).to.equal('User-Agent');
        expect(headerArr[0].value).to.equal('Dalvik/2.1.0 (SM-A705FN Build/QP1A.190711.020)');
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        expect(result.output[0].data.url).to.equal('test.com/test/foo?bar=1&baz=2');
        done();
      });
    });
    it('in case where there is multiple params with & in between in the url (direct param)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        "test.com?bar=1&baz=2"`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('test.com?bar=1&baz=2');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        done();
      });
    });
    it('in case where there is multiple params with & in between in the url (param after route)', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        "test.com/?bar=1&baz=2"`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('test.com/?bar=1&baz=2');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Content-Type');
        expect(headerArr[headerArr.length - 1].value).to.equal('application/json');
        done();
      });
    });
    it('in case where there is a header with URL in it and the URL is unquoted', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        -H "Referrer: test.com/?bar=1&baz=2" \\
        test.com/?bar=1&baz=2`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('test.com/?bar=1&baz=2');
        const headerArr = result.output[0].data.header;
        expect(headerArr[headerArr.length - 1].key).to.equal('Referrer');
        expect(headerArr[headerArr.length - 1].value).to.equal('test.com/?bar=1&baz=2');
        done();
      });
    });
    it('in case where there is a malformed URL with &(amp) in it, it should throw error', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        test?bar=1&baz=2`
      }, function (err, result) {
        expect(result.result).to.equal(false);
        expect(result.reason).to.equal('Please check your cURL string for malformed URL.');
        expect(result.error).to.have.property('message', result.reason);
        done();
      });
    });
    it('in case where there is a malformed URL (variant 2) with &(amp) in it, it should throw error', function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        bar=1&baz=2`
      }, function (err, result) {
        expect(result.result).to.equal(false);
        expect(result.reason).to.equal('Please check your cURL string for malformed URL.');
        expect(result.error).to.have.property('message', result.reason);
        done();
      });
    });
    it(`in case where there is a malformed URL (variant 2) with &(amp) in it and no prefix space or
        newline,it should throw error`, function(done) {
      convert({
        type: 'string',
        data: `curl -X GET \\
        -H "User-Agent: Dalvik/2.1.0 (Linux; U; Android 10; SM-A705FN Build/QP1A.190711.020) Test/4.6.4.459" \\
        -H "Authorization: bearer XXX" \\
        -H "Content-Type: application/json" \\
        "test.com/?bar=1&baz=2`
      }, function (err, result) {
        expect(result.result).to.equal(false);
        expect(result.reason).to.equal('Please check your cURL string for malformed URL.');
        expect(result.error).to.have.property('message', result.reason);
        done();
      });
    });
    it('properly formed large requests shouldn\'t hang the process', function(done) {
      convert({
        type: 'string',
        data: largeRequest
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://www.example.com/views/ajax?etc_category_tid=5&d=1');
        done();
      });
    });
  });

  it('in case where there is a invalid character at the end it should safely generate request', function(done) {
    convert({
      type: 'string',
      data: `curl --location --request POST \\
      "postman-echo.com/post?qwerty=One" \\
      -H 'Cookie: sails.sid=s%3AGntztErGu9IDGjIBVu2-w7vTipGS3zsf.j9%2BHttqloZ2UJFwtSQbTx6tTTkOz2k6NkNq4NGCaDLI' \\
      ;`
    }, function (err, result) {
      expect(result.result).to.equal(true);
      expect(result.output.length).to.equal(1);
      expect(result.output[0].type).to.equal('request');
      expect(result.output[0].data.url).to.equal('postman-echo.com/post?qwerty=One');

      const headerArr = result.output[0].data.header;
      expect(headerArr[0].key).to.equal('Cookie');
      expect(headerArr[0].value).to.equal('sails.sid=s%3AGntztErGu9IDGjIBVu2-w7vTipGS3zsf.j9%2BHttqloZ2UJFwtSQbTx6tTTkOz2k6NkNq4NGCaDLI');
      done();
    });
  });

  describe('[Github #5182]: It should correctly import cURL commands compatible with Windows cmd', function() {

    it('containing double quotes escaped with ^ (caret)', function(done) {
      convert({
        type: 'string',
        data: 'curl "https://trello.com/1/cards" --data-binary ' +
          '"^{^\\^"name^\\^":^\\^"hello world^\\^",^\\^"pos^\\^":65535,^\\^"closed^\\^":false,' +
          '^\\^"idLabels^\\^":^[^],^\\^"idMembers^\\^":^[^],^\\^"dateLastActivity^\\^":1536871503239,' +
          '^\\^"idBoard^\\^":^\\^"5a84a94fc77d9f99cf9ecd8a^\\^",^\\^"idList^\\^":^\\^"a^\\^",' +
          '^\\^"token^\\^":^\\^"a/L8nmd9rC5gyBYaBx6RVXGjHuMIRfMQS4b3p3zIhKWin8ejxTzJ5E5ERACxT2IILp^\\^"^}" --compressed'
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://trello.com/1/cards');
        done();
      });
    });

    it('containing double quotes escaped with " (double quotes)', function(done) {
      convert({
        type: 'string',
        data: `curl "https://www.youtube.com/youtubei/v1/guide?key=321456467855697&prettyPrint=false" ^
        -H "authority: www.youtube.com" ^
        -H "sec-ch-ua: ^\\^"Not_A Brand^\\^";v=^\\^"99^\\^", ^\\^"Chromium^\\^";v=^\\^"109^\\^"" ^
        -H "sec-ch-ua-arch: ^\\^"arm^\\^"" ^
        -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) (KHTML, like Gecko) Chrome/109.0.0.0" ^
        -H "content-type: application/json" ^
        --data-raw "^{^\\^"context^\\^":^{^\\^"client^\\^":^{^\\^"hl^\\^":^\\^"en^\\^"^}^},^\\^"state^\\^":true^}" ^
        --compressed
      `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        const headerArr = result.output[0].data.header;
        expect(headerArr[0].key).to.equal('authority');
        expect(headerArr[0].value).to.equal('www.youtube.com');
        expect(headerArr[1].key).to.equal('sec-ch-ua');
        expect(headerArr[1].value).to.equal(
          '\"Not_A Brand\";v=\"99\", \"Chromium\";v=\"109\"');
        expect(headerArr[2].key).to.equal('sec-ch-ua-arch');
        expect(headerArr[2].value).to.equal('\"arm\"');
        expect(headerArr[3].key).to.equal('user-agent');
        expect(headerArr[3].value).to.equal(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) (KHTML, like Gecko) Chrome/109.0.0.0');
        expect(headerArr[4].key).to.equal('content-type');
        expect(headerArr[4].value).to.equal('application/json');
        expect(result.output[0].data.url).to.equal(
          'https://www.youtube.com/youtubei/v1/guide?key=321456467855697&prettyPrint=false');
        expect(result.output[0].data.body.mode).to.equal('raw');
        expect(result.output[0].data.body.raw).to.equal(
          '{\"context\":{\"client\":{\"hl\":\"en\"}},\"state\":true}');
        done();
      });
    });
  });

  describe('[Github #8296]: It should correctly generate request for form-data body', function() {

    it('containing form-data boundry with correct method', function(done) {
      convert({
        type: 'string',
        data: `curl 'https://httpbin.org/anything' \
        -H 'authority: httpbin.org' \
        -H 'accept: application/json, text/plain, */*' \
        -H 'content-type: multipart/form-data; boundary=----WebKitFormBoundaryDjpz6jUyMpfzNVCh' \
        --data-raw $'------WebKitFormBoundaryDjpz6jUyMpfzNVCh\r\nContent-Disposition: form-data; name="hello"\r\n\r\nworld\r\n------WebKitFormBoundaryDjpz6jUyMpfzNVCh\r\nContent-Disposition: form-data; name="contact[phone]"\r\n\r\n12345\r\n------WebKitFormBoundaryDjpz6jUyMpfzNVCh\r\nContent-Disposition: form-data; name="data"; filename="wsdl1.wsdl"\r\nContent-Type: application/octet-stream\r\n\r\n\r\n------WebKitFormBoundaryDjpz6jUyMpfzNVCh--\r\n' \
        --compressed
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything');
        expect(result.output[0].data.method).to.equal('POST');
        expect(result.output[0].data.body.mode).to.equal('formdata');
        expect(result.output[0].data.body.formdata).to.eql([
          {
            key: 'hello',
            value: 'world',
            type: 'text'
          },
          {
            key: 'contact[phone]',
            value: '12345',
            type: 'text'
          },
          {
            key: 'data',
            value: 'wsdl1.wsdl',
            type: 'file'
          }
        ]);
        done();
      });
    });

    it('containing form params with correct method', function(done) {
      convert({
        type: 'string',
        data: `curl --location "https://httpbin.org/anything" \
        --form "hello=\"world\"" \
        --form "contact[phone]=\"12345\"" \
        --form "data=@\"wsdl1.wsdl\""
      `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything');
        expect(result.output[0].data.method).to.equal('POST');
        expect(result.output[0].data.body.mode).to.equal('formdata');
        expect(result.output[0].data.body.formdata).to.eql([
          {
            key: 'hello',
            value: 'world',
            type: 'text'
          },
          {
            key: 'contact[phone]',
            value: '12345',
            type: 'text'
          },
          {
            key: 'data',
            value: 'wsdl1.wsdl',
            type: 'file'
          }
        ]);
        done();
      });
    });
  });

  describe('It should correctly generate request for cURL with allowed bash operators', function() {

    it('containing "<" or/and ">" in URL', function(done) {
      convert({
        type: 'string',
        data: `curl https://httpbin.org/anything/<userId>/team \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/<userId>/team');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });

    it('containing "(" or/and ")" in URL', function(done) {
      convert({
        type: 'string',
        data: `curl https://httpbin.org/anything/(userId)/team \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/(userId)/team');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });

    it('containing allowed character with url option defined in URL', function(done) {
      convert({
        type: 'string',
        data: `curl --url https://httpbin.org/anything/<userId>/team \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/<userId>/team');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });
  });

  describe('It should correctly generate request for cURL with non-allowed bash operators without error', function() {

    it('containing non allowed operator "|" in URL', function(done) {
      convert({
        type: 'string',
        data: `curl https://httpbin.org/anything/user|id/team \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/user');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });

    it('containing non allowed operator "&" in URL host part', function(done) {
      convert({
        type: 'string',
        data: `curl https://httpbin.org/anything/user&id/team \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/user');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });

    it('containing "&" in URL query part', function(done) {
      convert({
        type: 'string',
        data: `curl https://httpbin.org/anything?hello=world&how=areyou \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything?hello=world&how=areyou');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });

    it('containing non allowed operator ";" in URL', function(done) {
      convert({
        type: 'string',
        data: `curl https://httpbin.org/anything/user;id/team \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/user');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });
  });

  it('It should correctly generate request for cURL with special characters in URL without error', function(done) {
    convert({
      type: 'string',
      data: `curl https://httpbin.org/anything/!@$%^*-_=+.,\\{}[]/team \
      -H 'authority: httpbin.org'
      `
    }, function (err, result) {
      expect(result.result).to.equal(true);
      expect(result.output.length).to.equal(1);
      expect(result.output[0].type).to.equal('request');
      expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/!@$%^*-_=+.,\{}[]/team');
      expect(result.output[0].data.method).to.equal('GET');
      done();
    });
  });

  it('It should correctly generate request for cURL with extra arguments apart from URL without error', function(done) {
    convert({
      type: 'string',
      data: `curl https://httpbin.org/anything/team 5678 \
      -H 'authority: httpbin.org'
      `
    }, function (err, result) {
      expect(result.result).to.equal(true);
      expect(result.output.length).to.equal(1);
      expect(result.output[0].type).to.equal('request');
      expect(result.output[0].data.url).to.equal('https://httpbin.org/anything/team');
      expect(result.output[0].data.method).to.equal('GET');
      done();
    });
  });

  it('It should correctly generate request for cURL with allowed operators not in URL correctly', function(done) {
    convert({
      type: 'string',
      data: `curl 'https://httpbin.org/anything' \
      -H 'authority: httpbin.org' \
      -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) (KHTML, like Gecko) Chrome/109.0.0.0" \
      -H 'accept: application/json, text/plain, */*' \
      -H 'content-type: application/json' \
      --data "{\"context\":{\"client\":{\"hl\":\"en\"}},\"state\":true}"
    `
    }, function (err, result) {
      expect(result.result).to.equal(true);
      expect(result.output.length).to.equal(1);
      expect(result.output[0].type).to.equal('request');
      expect(result.output[0].data.url).to.equal('https://httpbin.org/anything');
      expect(result.output[0].data.method).to.equal('POST');

      const headerArr = result.output[0].data.header;
      expect(headerArr.length).to.equal(4);
      expect(headerArr[0].key).to.equal('authority');
      expect(headerArr[0].value).to.equal('httpbin.org');
      expect(headerArr[1].key).to.equal('user-agent');
      expect(headerArr[1].value).to.equal('Mozilla/5.0 (Windows NT 10.0; Win64; x64) (KHTML, like Gecko) Chrome/109.0.0.0');
      expect(headerArr[2].key).to.equal('accept');
      expect(headerArr[2].value).to.equal('application/json, text/plain, */*');
      expect(headerArr[3].key).to.equal('content-type');
      expect(headerArr[3].value).to.equal('application/json');
      done();
    });
  });

  describe('It should correctly generate request for cURL with various postman id formats in URL', function() {

    it('containing path variable with ":" character', function(done) {
      convert({
        type: 'string',
        data: `curl https://httpbin.org/team/:teamId/user/:userId \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('https://httpbin.org/team/:teamId/user/:userId');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });

    it('containing collection/environment variable in URL', function(done) {
      convert({
        type: 'string',
        data: `curl {{baseUrl}}/user/{{userId}} \
        -H 'authority: httpbin.org'
        `
      }, function (err, result) {
        expect(result.result).to.equal(true);
        expect(result.output.length).to.equal(1);
        expect(result.output[0].type).to.equal('request');
        expect(result.output[0].data.url).to.equal('{{baseUrl}}/user/{{userId}}');
        expect(result.output[0].data.method).to.equal('GET');
        done();
      });
    });
  });
});
