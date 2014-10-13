var fs = require('fs');
var uuid = require('node-uuid');
var path = require('path');
var program = require('commander');
var validator = require('postman_validator');
var _ = require('lodash');
var argsplit = require('argsplit');

var converter = {
    trimQuotesFromString: function(str) {
        if(str[0]==='"') str = str.substring(1);
        var len = str.length;
        if(str[len-1]=='"') str = str.substring(0,len-1);
        return str;
    },

    validateCurlRequest: function(curlObj) {
        //Must have a request
        if(!curlObj.request) {
            throw "A -X/--request option must be specified";
        }

        //must be a valid method
        var validMethods = ["GET","POST","PUT","PATCH","DELETE","COPY","HEAD","OPTIONS","LINK","UNLINK","PURGE","LOCK","UNLOCK","PROPFIND"];
        if(validMethods.indexOf(curlObj.request.toUpperCase())===-1) {
            throw "The method "+ curlObj.request + " is not supported";
        }

        //must have a URL
        if(curlObj.args.length!==1) {
            throw "Zero or Multiple option-less arguments. Only one is supported (the URL)";
        }
    },

    getHeaders: function(curlObj) {
        var headerArray = curlObj.header;
        if(headerArray==null || headerArray.length==0) {
            return "";
        }
        var numHeaders = headerArray.length;
        var str = "";
        for(var i=0;i<numHeaders;i++) {
            var thisHeader = headerArray[i];

            //remove leading and trailing quotes
            thisHeader = this.trimQuotesFromString(thisHeader);

            var keyIndex = thisHeader.indexOf(":");
            if(keyIndex===-1) {
                continue;
            }

            str += thisHeader+"\\n";
        }
        return str;
    },

    setDefaultPostmanFields: function(request, curlstring) {
        request.collectionId = "";
        request.description = 'Generated from a curl request: \\n' +  curlstring.split('"').join('\\\"');
        request.descriptionFormat = "html";
        request.preRequestScript="";
        request.tests="";
        request.synced=false;
        request.pathVariables={};
    },

    getDataForForm: function(dataArray) {
        var numElems = dataArray.length;
        var retVal = [];
        for(var i=0;i<numElems;i++) {
            var thisElem = dataArray[i];

            thisElem = this.trimQuotesFromString(thisElem);

            var equalIndex = thisElem.indexOf("=");
            if(equalIndex===-1) {
                throw "Invalid CURL request. Each -F/--form argument must be of the form name=value";
            }
            var key = thisElem.substring(0,equalIndex);
            var val = thisElem.substring(equalIndex+1, thisElem.length-1);

            retVal.push({
                key: key,
                value: val,
                type: "text"
            });
        }

        return retVal;
    },

    convertCurlToRequest: function(curlString) {
        function collectValues(str, memo) {
            memo.push(str);
            return memo;
        }

        program.version('0.0.1')
            .usage('[options] <URL ...>')
            .option('-A, --user-agent <string>', 'An optional user-agent string', null)
            .option('-d, --data <string>', 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded', collectValues, [])
            .option('--data-binary <string>', 'Data send as-is', null)
            .option('-F, --form <name=content>', 'A single form-data field', collectValues, [])
            .option('-G, --get', 'Forces the request to be sent as GET, with the --data parameters appended to the query string', null)
            .option('-H, --header <string>', 'Add a headerg (can be used multiple times)', collectValues, [])
            .option('-X, --request <string>', 'Specify a custom request mehod to be used', null);
        var argv = argsplit("node "+curlString);
        var curlObj = program.parse(argv);

        curlObj.request = this.trimQuotesFromString(curlObj.request);

        this.validateCurlRequest(curlObj);

        var request = {};

        request.method= curlObj.request;
        request.url = request.name = curlObj.args[0];

        request.headers = this.getHeaders(curlObj);
        request.time = (new Date()).getTime();
        request.id = uuid.v4();

        if(curlObj["data-binary"]) {
            request.dataMode="raw";
            request.data=[];
            request.rawModeData = request["data-binary"];
        }
        else if(curlObj.form) {
            request.rawModeData="";
            request.data = this.getDataForForm(curlObj.form);
            request.dataMode = "params";
        }
        else if(curlObj.data) {
            request.rawModeData="";
            request.data = this.getDataForForm(curlObj.data);
            request.dataMode = "urlencoded";
        }

        this.setDefaultPostmanFields(request, curlString);

        console.log(JSON.stringify(request,null));
    }
};

module.exports = converter;