var expect = require('expect.js'),
  path = require('path'),
  packageJson = require(path.resolve('package.json')),
  package = require('../');

describe('packageJson should', function() {
  it('have the right metadata in com_postman_plugin', function() {
    expect(packageJson).to.have.property('com_postman_plugin');
    expect(packageJson.com_postman_plugin).to.have.property('name');
    expect(packageJson.com_postman_plugin).to.have.property('source_format');
    expect(packageJson.com_postman_plugin.plugin_type).to.be('importer');
  });
});

describe('the package should', function() {
  it('expose validate', function() {
    expect(typeof package.validate).to.be('function');
  });

  it('expose convert', function() {
    expect(typeof package.convert).to.be('function');
  });
});


