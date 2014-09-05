// To Do: 
// Integrate commander
// Refactor
// Include a convertJSON method
// Add tests/setup npm files and such
// ...
// 

var fs = require('fs');
var uuid = require('node-uuid')
var path = require('path');
var validator = require('postman_validator');
var _ = require('lodash');

var converter = {
    sampleFile: {},
    convertAPI: function(res, dir) {

        // Resolve the apiFile location.
        // res.path has a leading /
        var apiFile = this.read(path.join(dir, "." + res.path));
        var envObj = this.sampleFile.environment;

        // Initialize the envObj for the collection.
        envObj.name = this.sampleFile.name + "'s Environment";
        envObj.id = uuid.v4();

        _.forEach(apiFile.apis, function(api) {
            _.forEach(api.operations, function(operation) {

                // operation variables
                var header = '';
                var query = '';
                var queryFlag = false;

                // Make a deep copy of the the sampleRequest.
                var request = _.clone(this.sampleRequest, true);
                request.collectionId = this.sampleFile.id;

                // No specification found for other modes.
                request.dataMode = "params";
                request.description = operation.summary;
                request.id = uuid.v4();
                request.method = operation.method;
                request.name = operation.nickname;
                request.time = Date.now();

                _.forEach(operation.parameters, function(param) {
                    switch (param.paramType) {
                        case 'header':
                            header += param.name + ": \n";
                            break;
                        case 'query':
                            if (queryFlag) {
                                query += '&' + param.name + '=';
                            } else {
                                queryFlag = true;
                                query += '?' + param.name + '=';
                            }
                            break;
                        case 'form':
                            request.data.push({
                                "key": param.name,
                                "value": "",
                                "type": "text"
                            });
                            break;
                        case 'path':
                            if(!this.keyExists(envObj.values, param.name)){
                                
                                // Should it be enabled?
                                // Could not find a suitable map 
                                // for the env variable name
                                envObj.values.push({
                                    "enabled": false,
                                    "key": param.name,
                                    "name": param.name,
                                    "type": param.type,
                                    "value": ""
                                });
                            }
                            
                            // Modify the url to suit POSTMan
                            api.path = api.path.replace('{' + param.name + '}', ':' + param.name);
                            break;
                        default:
                            break;
                    }
                }, this);

                // No POSTMAN schema specified for responses
                request.responses = operation.responseMessages;

                // api.path begins with a /
                request.url = apiFile.basePath + api.path;

                request.header = header;
                request.url += query;

                this.sampleFile.requests.push(request);
            }, this);
        }, this);
    },

    // Helper to check if the key already exists in the environment
    // variables set.
    keyExists: function(array, key){
        var ret = false;
        
        array.forEach(function(param){
            if(param.key === key){
                ret = true;
            }
        });
        
        return ret;
    },

    read: function(location) {
        var data;
        try {
            data = fs.readFileSync(location, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            console.log(err);
            process.exit(1);
        }
    },

    convert: function(inputFile) {
        var resourceList;
        var title;
        var file = path.resolve(__dirname, inputFile);
        var dir = path.dirname(inputFile);

        resourceList = this.read(file);

        file = './postman-boilerplate.json';
        this.sampleFile = this.read(file);

        // Collection trivia
        this.sampleFile.id = uuid.v4();
        this.sampleFile.timestamp = Date.now();

        if (_.has(resourceList, 'info') && _.has(resourceList.info, 'title')) {
            this.sampleFile.name = resourceList.info.title;
        }
        
        var len = resourceList.apis.length;
        var apis = resourceList.apis;

        this.sampleRequest = this.sampleFile.requests[0];

        if (len < 1) {
            console.error("No requests are specificed in the spec.");
            process.exit(1);
        }

        this.sampleFile.requests = [];

        // Temporary, will be populated later.
        this.sampleFile.folders = [];

        _.forEach(apis, function(api){
            this.convertAPI(api, dir);
        }, this);
        
        if (validator.validateJSON('c', this.sampleFile).status) {
            console.log('The conversion was successful');
            fs.writeFile('./out.json', JSON.stringify(this.sampleFile, null, 4), function(err) {
                if (err) {
                    console.error("Could not write to file");
                }
            });
            return this.sampleFile;
        } else {
            console.log("Could not validate generated file");
            return {};
        }
    }
};

if (process.argv.length < 3) {
    console.error("Expected usage : node convert.js path_to_resource_listing");
    process.exit(1);
} else {
    converter.convert(process.argv[2]);
}

module.exports = {
    convert: converter.convert
};
