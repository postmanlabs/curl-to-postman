var fs = require('fs');
var uuid = require('node-uuid');
var path = require('path');
var validator = require('postman_validator');
var _ = require('lodash');

var converter = {

    sampleFile: {},
    env: {},

    convertAPI: function(res, dir, description) {

        // Resolve the apiFile location.
        // res.path has a leading /
        var apiFile = this.read(path.join(dir, "." + res.path));

        var folderItem = {};

        folderItem.name = apiFile.resourcePath;
        folderItem.description = description;
        folderItem.collectionName = this.sampleFile.name;
        folderItem.collectionId = this.sampleFile.id;
        folderItem.order = [];
        folderItem.id = this.generateId();

        _.forEach(apiFile.apis, function(api) {
            _.forEach(api.operations, function(operation) {

                // Operation variables.
                var header = '';
                var query = '';
                var queryFlag = false;

                // Make a deep copy of the the sampleRequest.
                var request = _.clone(this.sampleRequest, true);
                request.collectionId = this.sampleFile.id;

                // No specification found for other modes.
                request.dataMode = "params";
                request.description = operation.summary;
                request.id = this.generateId();
                request.method = operation.method;
                request.name = operation.nickname;
                request.time = this.generateTimestamp();

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
                            this.addEnvKey(param.name, param.type, false);

                            // Modify the url to suit POSTMan
                            api.path = api.path.replace('{' + param.name + '}', ':' + param.name);
                            break;

                            // Need to handle body paramType
                            // Need to parse the models and account for inheritance
                        case 'body':
                            break;

                        default:
                            break;
                    }
                }, this);

                folderItem.order.push(request.id);

                // api.path begins with a /
                request.url = apiFile.basePath + api.path;

                request.headers = header;
                request.url += query;

                this.sampleFile.requests.push(request);
            }, this);
        }, this);

        this.sampleFile.folders.push(folderItem);
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

    addEnvKey: function(key, type, displayName) {
        if (!_.has(this.env, key)) {
            var envObj = {};
            envObj.name = displayName || key;
            envObj.enabled = true;
            envObj.value = "";
            envObj.type = type || "string";
            envObj.key = key;

            this.env[key] = envObj;
        }
    },

    generateId: function() {
        if (this.test) {
            return "";
        } else {
            return uuid.v4();
        }
    },

    generateTimestamp: function() {
        if (this.test) {
            return 0;
        } else {
            return Date.now();
        }
    },

    convert: function(inputFile, options, cb) {

        this.group = options.group;
        this.test = options.test;

        var resourceList;
        var file = path.resolve(__dirname, inputFile);
        var dir = path.dirname(inputFile);

        resourceList = this.read(file);

        file = './postman-boilerplate.json';
        this.sampleFile = this.read(file);

        var sf = this.sampleFile;

        // Collection trivia
        sf.id = this.generateId();
        sf.timestamp = this.generateTimestamp();

        if (_.has(resourceList, 'info') && _.has(resourceList.info, 'title')) {
            sf.name = resourceList.info.title;
        }

        var len = resourceList.apis.length;
        var apis = resourceList.apis;

        this.sampleRequest = sf.requests[0];

        if (len < 1) {
            console.error("No requests are specificed in the spec.");
            process.exit(1);
        }

        sf.requests = [];
        sf.folders = [];

        sf.environment.name = ( sf.name || "Default" ) + "'s Environment";
        sf.environment.timestamp = this.generateTimestamp();
        sf.environment.id = this.generateId();

        _.forEach(apis, function(api) {
            this.convertAPI(api, dir, api.description);
        }, this);

        // Add the environment variables.
        _.forOwn(this.env, function(val) {
            sf.environment.values.push(val);
        }, this);

        if (!this.group) {
            // If grouping is disabled, reset the folders.
            sf.folders = [];
        }

        this.validate();
        cb(this.sampleFile);
    },

    validate: function() {
        if (validator.validateJSON('c', this.sampleFile).status) {
            console.log('The conversion was successful');
            return true;
        } else {
            console.log("Could not validate generated file");
            return false;
        }
    }
};

module.exports = converter;