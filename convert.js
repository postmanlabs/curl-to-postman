// To Do: 
// Integrate commander
// Refactor
// Include a convertJSON method
// Add tests/setup npm files and such
// ...
// 

var fs = require('fs'),
    uuid = require('node-uuid'),
    path = require('path'),
    clone = require('clone'),
    validator = require('postman_validator');

var converter = {
    convertAPI : function(res, dir) {

        // resolve the apiFile location
        // res.path has a leading /
        var apiFile = this.read(path.join(dir, "." + res.path));

        var that = this;
        apiFile.apis.forEach(function(api) {
            api.operations.forEach(function(operation) {

                // make a deep copy of the the sampleRequest
                var request = clone(that.sampleRequest, false);
                request.collectionId = that.sampleFile.id;

                // No specification found for other modes
                request.dataMode = "params";
                request.description = operation.summary;

                var header = '',
                    query = '',
                    queryFlag = false;

                operation.parameters.forEach(function(param) {
                    switch (param) {
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
                        default:
                            break;
                    }
                });

                request.id = uuid.v4();
                request.method = operation.method;
                request.name = operation.nickname;

                // No POSTMAN schema specified for responses
                request.responses = operation.responseMessages;
                request.time = Date.now();

                // api.path begins with a /
                request.url = apiFile.basePath + api.path;

                that.sampleFile.requests.push(request);
            });
        });
    },
    read : function(location) {
        var data;
        try {
            data = fs.readFileSync(location, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            console.log(err);
            process.exit(1);
        }
    },
    
    convert : function(inputFile) {
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

        if (resourceList.hasOwnProperty('info')) {
            title = resourceList.info.title;
        }

        if (title) {
            this.sampleFile.name = title;
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

        for (var i = 0; i < len; i++) {
            this.convertAPI(apis[i], dir);
        }

        if (validator.validateJSON('c', this.sampleFile).status) {
            console.log('The conversion was successful');
            fs.writeFile('./out.json', JSON.stringify(this.sampleFile), function(err) {
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
