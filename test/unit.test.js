var Converter = require('../src/lib.js'),
  validate = require('../src/validate.js'),
  shellQuote = require('../assets/shell-quote'),
  expect = require('expect.js');

describe('trimQuotesFromString should', function() {
  it('work properly', function(done) {
    expect(Converter.trimQuotesFromString('"glasnost"')).to.equal('glasnost');
    expect(Converter.trimQuotesFromString('\'glasnost\'')).to.equal('glasnost');
    expect(Converter.trimQuotesFromString()).to.be.equal('');
    done();
  });
});

describe('convertArrayToAmpersandString should', function() {
  it('work properly', function(done) {
    expect(Converter.convertArrayToAmpersandString([1, 2])).to.equal('1&2');
    done();
  });
});

describe('validator should', function () {
  it('indicate valid curl', function () {
    expect(validate('curl helloworld').result).to.be(true);

    var result = validate('invalid curl');
    expect(result.result).to.be(false);
  });
});

describe('getRequestMethod should', function() {
  it('return POST if -d options is given in the curl command', function(done) {
    let object = {
        data: ['a=b'],
        dataAscii: [],
        dataUrlencode: [],
        dataBinary: null,
        uploadFile: []
      },
      result = Converter.getRequestMethod(object);
    expect(result).to.equal('POST');

    done();
  });

  it('return GET if --get and -d options are given in the curl command', function(done) {
    let object = {
        data: ['a=b'],
        dataAscii: [],
        dataUrlencode: [],
        dataBinary: null,
        uploadFile: [],
        get: true
      },
      result = Converter.getRequestMethod(object);
    expect(result).to.equal('GET');

    done();
  });

  it('return HEAD if --get, -d, -I options are given in the curl command', function(done) {
    let object = {
        data: ['a=b'],
        dataAscii: [],
        dataUrlencode: [],
        dataBinary: null,
        uploadFile: [],
        get: true,
        head: true
      },
      result = Converter.getRequestMethod(object);
    expect(result).to.equal('HEAD');

    done();
  });

  it('return PUT if --get, -d, -I and -T options are given in the curl command', function(done) {
    let object = {
        data: ['a=b'],
        dataAscii: [],
        dataUrlencode: [],
        dataBinary: null,
        uploadFile: ['./text.txt'],
        get: true,
        head: true
      },
      result = Converter.getRequestMethod(object);
    expect(result).to.equal('PUT');

    done();
  });
});

describe('sanitizeArgs function should', function () {
  it('remove all unnecessary $ from string', function (done) {
    let string = 'curl -X $\'POST\' ' +
      '-H $\'Host: example.com.br\' -H $\'User-Agent: Mozilla/5.0 ' +
       '(Macintosh; Intel Mac OS X 10.13;rv:68.0) Gecko/20100101 Firefox/68.0\' ' +
      '$\'https://example.com.br/login.html\'',
      sanitizedArgs = Converter.sanitizeArgs(string);
    expect(sanitizedArgs[3]).to.equal('POST');
    expect(sanitizedArgs[5]).to.equal('Host: example.com.br');
    expect(sanitizedArgs[7]).to.equal('User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13;' +
       'rv:68.0) Gecko/20100101 Firefox/68.0');
    expect(sanitizedArgs[8]).to.equal('https://example.com.br/login.html');

    done();
  });

  it('remove all unnecessary options which are in the unnecessary options list', function(done) {
    // In this case -i, -v and -a will be removed
    let string = 'curl -i -v http://example.com -a',
      sanitizeArgs = Converter.sanitizeArgs(string);
    expect(sanitizeArgs[1]).to.equal('curl');
    expect(sanitizeArgs[2]).to.equal('http://example.com');
    done();
  });
});

describe('shell-quote should', function() {
  it('escape characters correctly', function(done) {
    let string = '\\\'"\\\""',
      result = shellQuote.parse(string);
    expect(result[0]).to.equal('\'"');
    done();
  });
});
