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
			}
			let result = Converter.getRequestMethod(object);
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
			}
			let result = Converter.getRequestMethod(object);
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
			}
			let result = Converter.getRequestMethod(object);
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
			}
			let result = Converter.getRequestMethod(object);
			expect(result).to.equal('PUT');

			done();
		});
	});

