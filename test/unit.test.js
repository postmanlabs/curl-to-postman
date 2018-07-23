var Converter = require('../src/convert.js'),
	expect = require('expect.js');

describe('trimQuotesFromString should', function() {
	it('work properly', function() {
		expect(Converter.trimQuotesFromString('"glasnost"')).to.equal('glasnost');
		expect(Converter.trimQuotesFromString('\'glasnost\'')).to.equal('glasnost');
	});
});