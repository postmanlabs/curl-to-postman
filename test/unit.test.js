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

