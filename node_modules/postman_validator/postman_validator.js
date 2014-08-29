/**
* @Author Abhijit Kane
* Main validator file
*/
 
var program = require('commander'),
	fs      = require('fs'),
	jsface	= require("jsface"),
	JSV 	= require("JSV").JSV;

var global_schema = require('./json-schemas/globals.schema.json');
var env_schema = require('./json-schemas/environment.schema.json');
var collection_schema = require('./json-schemas/collection.schema.json');

var schemas = {
	'c': collection_schema,
	'g': global_schema,
	'e': env_schema
};

var postman_validator = jsface.Class({
	$singleton: true,

	/*
	return schema:
	{
		"status": true / false,
		"message": "Schema validation failed",
		"error": {}
	}*/

	validate: function (schemaCode, input) {
		input = this._loadJSONfile(input);
		this.validateJSON(schemaCode,input);
	},

	validateJSON: function(schemaCode, input) {
		var schema = schemas[schemaCode];
		if(typeof schema === "undefined") {
			return this._getReturnObj(false,"Invalid schema code",{});
		}
		var env = JSV.createEnvironment();
		var report = env.validate(input, schema);
		if(report.errors.length) {
			return this._getReturnObj(false,"Validation failed",report.errors);
		}
		return this._getReturnObj(true,"Validation successful",{});
	},

	_getReturnObj: function(status,message,error) {
		return {
				"status": status,
				"message": message,
				"error": error
		};
	},

	printError: function(str) {
		process.stdout.write(str);
		process.exit(1);
	},

	_loadJSONfile: function(filename, encoding) {
		if(!fs.existsSync(filename)) {
			return this._getReturnObj(false,"File " + filename+" could not be found",{});
		}
		var contents=null;
		try {
			if (typeof (encoding) == 'undefined') encoding = 'utf8';
			var contents = fs.readFileSync(filename, encoding);
		} catch (err) {
			return this._getReturnObj(false,"Error reading file",{});
		}

		try {
			return JSON.parse(contents);
		} catch(err) {
			return this._getReturnObj(false,"Unable to parse JSON",{});
		}
	}

});

module.exports = postman_validator;


