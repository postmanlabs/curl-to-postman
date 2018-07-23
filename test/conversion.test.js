var Converter = require('../src/convert.js'),
	expect = require('expect.js'),
	_ = require('lodash');

describe('Curl converter should', function() {

	it('convert a simple GET request', function() {
		var result = Converter.convertCurlToRequest('curl --request GET --url http://www.google.com');
		expect(result.method).to.equal('GET');
		expect(result.url).to.equal('http://www.google.com');
	});

	it('convert a simple GET request w/o the --url param', function() {
		var result = Converter.convertCurlToRequest('curl --request GET http://www.google.com');
		expect(result.method).to.equal('GET');
		expect(result.url).to.equal('http://www.google.com');
	});

	it('convert a simple GET request w/ headers', function() {
		var result = Converter.convertCurlToRequest('curl --request GET http://www.google.com -H "h1:v1" -H "h2:v2" -H "h3;"');

		var h1Header = _.find(result.header, function (header) { return header.key === 'h1' }),
			h2Header = _.find(result.header, function (header) { return header.key === 'h2' }),
			h3Header = _.find(result.header, function (header) { return header.key === 'h3' });

		expect(h1Header.value).to.equal('v1');
		expect(h2Header.value).to.equal('v2');
		expect(h3Header.value).to.equal('');
	});

	it('convert a simple GET request w/ user-agent', function() {
		var result = Converter.convertCurlToRequest('curl --request GET http://www.google.com --user-agent mosaic');

		var uaHeader = _.find(result.header, function (header) { return header.key === 'User-Agent' });
		expect(uaHeader.value).to.equal('mosaic');
	});

	it('convert a simple GET request with Basic auth', function() {
		var result = Converter.convertCurlToRequest('curl --request GET -u testUser:testPass --url http://www.google.com');

		expect(result.auth.type).to.equal('basic');
		expect(result.auth.basic[0].key).to.equal('username');
		expect(result.auth.basic[1].key).to.equal('password');
	});

	it('convert a simple POST request', function() {
		var result = Converter.convertCurlToRequest('curl --request POST --url http://www.google.com');
		expect(result.method).to.equal('POST');
		expect(result.url).to.equal('http://www.google.com');
	});

	it('convert a simple POST request with -X', function() {
		var result = Converter.convertCurlToRequest('curl -X POST --url http://www.google.com');
		expect(result.method).to.equal('POST');
		expect(result.url).to.equal('http://www.google.com');
	});

	it('convert a simple POST request with formdata', function() {
		var result = Converter.convertCurlToRequest('curl --request POST --url http://google.com -F "username=postman" -F "password=newman"'),
			usernameRow, passwordRow;

		expect(result.body.mode).to.equal('formdata');
		
		usernameRow = _.find(result.body.formdata, function (row) {return row.key === 'username'});
		passwordRow = _.find(result.body.formdata, function (row) {return row.key === 'password'});

		expect(usernameRow.value).to.equal('postman');
		expect(usernameRow.type).to.equal('text');
		
		expect(passwordRow.value).to.equal('newman');
		expect(passwordRow.type).to.equal('text');
	});

	it('convert a simple POST request with x-www-form-urlencoded data', function() {
		var result = Converter.convertCurlToRequest('curl --request POST --url http://google.com -d "username=postman&password=newman"'),
			usernameRow, passwordRow;

		expect(result.body.mode).to.equal('urlencoded');
		
		usernameRow = _.find(result.body.urlencoded, function (row) {return row.key === 'username'});
		passwordRow = _.find(result.body.urlencoded, function (row) {return row.key === 'password'});

		expect(usernameRow.value).to.equal('postman');
		expect(usernameRow.type).to.equal('text');
		
		expect(passwordRow.value).to.equal('newman');
		expect(passwordRow.type).to.equal('text');
	});

	it('convert a simple request with a arg-less option before the URL', function() {
		var result = Converter.convertCurlToRequest("curl --compressed 'http://www.google.com'");
		expect(result.method).to.equal('GET');
		expect(result.url).to.equal('http://www.google.com');
	});

	it('convert a simple request with a arg-less option after the URL (Github #4770)', function() {
		var result = Converter.convertCurlToRequest("curl -X POST http://www.google.com --compressed");
		expect(result.method).to.equal('POST');
		expect(result.url).to.equal('http://www.google.com');
	});

	it('convert a simple request with a arg-less option after the URL', function() {
		var result = Converter.convertCurlToRequest("curl -XPOST http://www.google.com --compressed");
		expect(result.method).to.equal('POST');
		expect(result.url).to.equal('http://www.google.com');
	});

	it('urldecode urlencoded data params while importing (Github #3623)', function() {
		var result = Converter.convertCurlToRequest("curl --url testUrl -X POST -H 'content-type: application/x-www-form-urlencoded' -d 'config_type=v1%3Av2%3Av3'"),
			row;

		expect(result.body.mode).to.equal('urlencoded');

		row = _.find(result.body.urlencoded, function (row) {return row.key === 'config_type'});
		expect(row.value).to.equal('v1:v2:v3'); // and not v1%3Av2%3Av3
	});

	it('support -XPOST type method specifiers (Github #3135)', function() {
		var result = Converter.convertCurlToRequest("curl --url testUrl -XPOST");
		expect(result.method).to.equal('POST');
		expect(result.url).to.equal('testUrl');

		result = Converter.convertCurlToRequest("curl testUrl -XPOST");
		expect(result.method).to.equal('POST');
		expect(result.url).to.equal('testUrl');
	});

	it.skip('Github #2791', function () {
		// no idea how to solve this yet
		str = "curl -XPOST 'http://httpbin.org/post' --data-binary $'{\"SearchTerms\":[{\"termValue\":\"`~!@#$%^&*()-+=<.,./?;:\'\\\"[{]}\\\\|\",\"termOption\"\:2}]}'";
		var result = Converter.convertCurlToRequest(str);
		console.log(result);
	});

	it('Empty data strings should work (Github #4018)', function() {
		var result = Converter.convertCurlToRequest('curl http://getpostman.com/ --data \"\"');
		expect(result.body).to.be.empty();

		var result = Converter.convertCurlToRequest('curl http://getpostman.com/ --data \'\'');
		expect(result.body).to.be.empty();
	});

});