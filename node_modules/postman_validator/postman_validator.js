/**
* @Author Abhijit Kane
* Main validator file
*/
 
var program = require('commander'),
	fs      = require('fs'),
	jsface	= require("jsface"),
	_       = require("lodash"),
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

	onlyOneValidator: function() {
		console.err("Only one file can be validated at one time.");
		process.exit(1);
	},

	validate: function (schemaCode, input) {
		try {
			input = this._loadJSONfile(input);
			console.log("JSON file loaded");
			return this.validateJSON(schemaCode,input);
		}
		catch(e) {
			return this._getReturnObj(false, e);
		}
	},


	/*
	options is an object
	currently, the only supported prop is correctDuplicates = true/false
	If true, duplicate entries in the order arrays in the collection are removed,
	and the order[] field is added to the old version
	*/
	validateJSON: function(schemaCode, input, options) {
		var schema = schemas[schemaCode];
		if(typeof schema === "undefined") {
			console.log("Invalid schema code");
			return this._getReturnObj(false,"Invalid schema code",{});
		}

		if(options && options.validateSchema!==false) {
			var env = JSV.createEnvironment();
			console.log("Env created");
			var report = env.validate(input, schema);
			if(report.errors.length) {
				console.log("Report errors: " + JSON.stringify(report.errors));
				return this._getReturnObj(false,"Validation failed",report.errors);
			}
		}
		
		//schema validation passed
		//semantic validation only for collections
		if(schemaCode==='c') {
			return this._validateCollectionSemantics(input, options)
		}
		else {
			return this._getReturnObj(true,"Validation successful",{});
		}
	},

	_getReturnObj: function(status,message,error, object) {
		return {
				"status": status,
				"message": message,
				"error": error,
				"finalObject": object
		};
	},

	printError: function(str) {
		process.stdout.write(str);
		process.exit(1);
	},

	_loadJSONfile: function(filename, encoding) {
		if(!fs.existsSync(filename)) {
			throw "File " + filename+" not found";
		}
		var contents=null;
		try {
			if (typeof (encoding) == 'undefined') encoding = 'utf8';
			var contents = fs.readFileSync(filename, encoding);
		} catch (err) {
			throw "Error reading file: " + err.message;
		}

		try {
			return JSON.parse(contents);
		} catch(err) {
			throw "Unable to parse JSON";
		}
	},


	_validateCollectionSemantics: function(json, options) {
		var correctDuplicates = !!(options && options.correctDuplicates);
		var duplicatesPresent = false;

		var ro = {
			"status": true,
			"message": "Valid Collection",
			"error": null,
			"finalObject": null
		};

		//must have a root id
		if(!json.hasOwnProperty("id")) {
			return this._getReturnObj(false, "Must have  a collection ID", {});
		}

		if(!json.hasOwnProperty("requests") || !(json.requests instanceof Array)) {
			return this._getReturnObj(false, "Requests[] must be present in the collection");
		}
		var requests = json.requests;
		var numRequest = json.requests.length;

		var collectionId = json.id;

		var order = json.order;
		if(order) {
			if (!(order instanceof Array)) {
				return this._getReturnObj(false, "Order must be an array")
			}
		}
		else {
			if(json.hasOwnProperty("folders")) {
				return this._getReturnObj(false, "Order[] must be present in the collection");
			}
			else {
				//old style collection
				console.log("Old style collection...adding requests to order");
				json.order = [];
				for(var i=0;i<numRequest;i++) {
					json.order.push(requests[i].id);
				}
				order = json.order;
			}
		}

		var rootOrder = order;

		var totalOrder = _.clone(order);

		var allOrders = [order];


		var requestIds = [];
		if(requests) {
			if (!(requests instanceof Array)) {
				return this._getReturnObj(false, "Requests must be an array")
			}

			for(var i=0;i<numRequest;i++) {
				delete requests[i].folderId; //this is not supported at all!
				delete requests[i].collectionRequestId; //this is not supported at all!
				delete requests[i].collection; //this is not supported at all!
				if(!requests[i].hasOwnProperty("id") || (typeof requests[i].id !== "string")) return this._getReturnObj(false, "Each request must have an ID (string)");
				if(!requests[i].hasOwnProperty("collectionId") || (typeof requests[i].collectionId !== "string")) return this._getReturnObj(false, "Each request must have a collectionId field");
				if(requests[i].collectionId !== collectionId) return this._getReturnObj(false, "Each request must have the same collectionId as the root collection object");
				if(_.intersection([requests[i].id],requestIds).length!==0) {
					duplicatesPresent = true;
				}
				requestIds.push(requests[i].id);
			}
		}
		else {
			return this._getReturnObj(false, "Requests[] must be present in the collection");
		}

		//go through totalOrder
		//if any request is not there in request IDs, remove it from order
		var toLength = totalOrder.length;
		for(var i=0;i<toLength;i++) {
			if(requestIds.indexOf(totalOrder[i])===-1) {
				totalOrder.splice(i,1);
				order.splice(i,1);
				toLength--;
				i--;
			}
		}

		var folders = json.folders;
		if(folders) {
			if(!(folders instanceof Array)) {
				return this._getReturnObj(false, "Folders must be an array")
			}

			var numFolder = folders.length;
			for(var i=0;i<numFolder;i++) {
				if(!folders[i].hasOwnProperty("id") || (typeof folders[i].id !== "string")) return this._getReturnObj(false, "Each folder must have an ID (String)");
				if(!folders[i].hasOwnProperty("order") || !(folders[i].order instanceof Array)) return this._getReturnObj(false, "Each folder must have an order[] field");
				if(_.intersection(folders[i].order,totalOrder).length!==0){
					duplicatesPresent = true;
				}

				//go through the folder order
				//if there are any IDs not present in the requests array, remove
				var orderLength = (folders[i].order)?folders[i].order.length:0;
				var j;
				for(j=0;j<orderLength;j++) {
					if(requestIds.indexOf(folders[i].order[j]) == -1) {
						folders[i].order.splice(j,1);
						orderLength--;
						j--;
					}
				}

				totalOrder = totalOrder.concat(folders[i].order);
				allOrders.push(folders[i].order);
			}
		}


		//check for request duplication across orders
		if(duplicatesPresent) {
			if(correctDuplicates) {
				var numOrders = allOrders.length;
				var j;
				for(var i=0;i<numOrders-1;i++) {
					for(j=i+1;j<numOrders;j++) {
						var intersection = _.intersection(allOrders[i],allOrders[j]);
						var numIntersections = intersection.length;
						if(intersection.length!==0) {
							for(var sec=0;sec<numIntersections;sec++) {
								var indexToSplice = allOrders[j].indexOf(intersection[sec]);
								allOrders[j].splice(indexToSplice,1);
							}
						}
					}
				}
			}
			else {
				return this._getReturnObj(false, "Request IDs cannot be duplicated");
			}
		}

		var diff = _.difference(requestIds, totalOrder);
		if(diff.length!==0) {
			if(correctDuplicates) {
				console.log("Adding extra requests to root order");
				json.order = json.order.concat(diff);
			}
			else {
				var extraRequests = diff.join(", ");
				return this._getReturnObj(false, "Request count not matching. "+extraRequests+" are defined, but not present in any order array");
			}
		}

		diff = _.difference(totalOrder, requestIds);
		if(diff.length!==0) {
			var missing = diff.join(", ");
			return this._getReturnObj(false, "Request count not matching. "+missing+" are included in the order, but are not defined");
		}

		ro.finalObject = json;

		return ro;

	}

});

module.exports = postman_validator;
