var Converter = require('../src/lib'),
  convert = require('../src/convert'),
  getMetaData = require('../index').getMetaData,
  expect = require('expect.js'),
  _ = require('lodash');

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
      expect(result.reason).to.equal('Error while parsing cURL: Could not identify the URL.' +
        ' Please use the --url option.');
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
      expect(result.reason).to.equal('Error while parsing cURL: Could not identify the URL.' +
       ' Please use the --url option.');
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
        data: `curl http://example.com -H 'Content-type: application/json' -d $'{"a":"\\'\""}'`
      }, function (err, result) {
        expect(result.result).to.equal(true);
        // eslint-disable-next-line quotes
        expect(result.output[0].data.body.raw).to.equal(`{"a":"'\""}`);
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
      expect(result.reason).to.equal('Error while parsing cURL: Both (--head/-I) and' +
       '(-d/--data/--data-raw/--data-binary/--data-ascii/--data-urlencode) are not supported');
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

  it('convert a simple GET request with Basic auth', function (done) {
    var result = Converter.convertCurlToRequest('curl --request GET -u testUser:testPass --url http://www.google.com');

    expect(result.auth.type).to.equal('basic');
    expect(result.auth.basic[0].key).to.equal('username');
    expect(result.auth.basic[1].key).to.equal('password');

    done();
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
    --data-binary $'[{"operationName":"someMutation","variables":{"aRequiredVar":"foo"},"query":"mutation ` +
    'someMutation($aRequiredVar: String\\u0021) {\\\\n  mutateSomething(aRequiredVar: $aRequiredVar) ' +
    `{\\\\n    message\\\\n    __typename\\\\n  }\\\\n}\\\\n"}]' \\
    --compressed`);

    expect(result.body).to.have.property('mode', 'raw');
    expect(result.body.raw).to.eql('[{\"operationName\":\"someMutation\",\"variables\":{\"aRequiredVar\":\"foo\"},' +
      '\"query\":\"mutation someMutation($aRequiredVar: String!) {\\n  mutateSomething(aRequiredVar: ' +
      '$aRequiredVar) {\\n    message\\n    __typename\\n  }\\n}\\n\"}]');
    done();
  });
});
