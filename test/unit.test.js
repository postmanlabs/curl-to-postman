var Converter = require('../src/lib.js'),
	validate = require('../src/validate.js'),
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
			expect(Converter.convertArrayToAmpersandString([1,2])).to.equal('1&2');
			done();
		});
	});

	describe('validator should', function () {
		it('indicate valid curl', function (done) {
			expect(validate('curl helloworld').result).to.be(true);

			var result = validate('invalid curl');
			expect(result.result).to.be(false);

			done();
		});
	});

	describe('sanitizeArgs function should', function () {
		it('remove all unnecessary $ from string', function (done) {
			let string = `curl -X $'POST' \
			-H $'Host: example.com.br' -H $'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:68.0) Gecko/20100101 Firefox/68.0'\
			$'https://example.com.br/login.html'`
			let sanitizedArgs = Converter.sanitizeArgs(string);
			console.log(sanitizedArgs)
			expect(sanitizedArgs[3]).to.equal('POST');
			expect(sanitizedArgs[5]).to.equal('Host: example.com.br');
			expect(sanitizedArgs[7]).to.equal('User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:68.0) Gecko/20100101 Firefox/68.0');
			expect(sanitizedArgs[8]).to.equal('https://example.com.br/login.html');

			done();
		})
	})

