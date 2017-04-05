var uuid = require('node-uuid'),
    program = require('commander'),
    _ = require('lodash').noConflict(),
    shellQuote = require('shell-quote');

var curlConverter = {
    loaded: false,

    methodsWithBody: ["POST", "PUT", "PATCH", "DELETE", "LINK", "UNLINK", "LOCK", "PROPFIND", "VIEW", "OPTIONS"],

    requestUrl: "",

    initialize: function() {
        function collectValues(str, memo) {
            memo.push(str);
            return memo;
        }

        program.version('0.0.1')
            .usage('[options] <URL ...>')
            .option('-A, --user-agent <string>', 'An optional user-agent string', null)
            .option('-d, --data <string>', 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded', collectValues, [])
            .option('--data-ascii <string>', 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded', collectValues, [])
            .option('--data-urlencode <string>', 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded', collectValues, [])
            .option('--data-binary <string>', 'Data sent as-is', null)
            .option('-F, --form <name=content>', 'A single form-data field', collectValues, [])
            .option('-G, --get', 'Forces the request to be sent as GET, with the --data parameters appended to the query string', null)
            .option('-H, --header <string>', 'Add a header (can be used multiple times)', collectValues, [])
            .option('-X, --request <string>', 'Specify a custom request mehod to be used', null)
            .option('--url <string>', 'An alternate way to specify the URL', null);
    },

    trimQuotesFromString: function(str) {
        if(str === null) return null;
        var strlen = str.length;
        if((str[0]==='"' && str[strlen-1]==='"') || (str[0]==="'" && str[strlen-1]==="'"))  {
        	return str.substring(1,strlen-1);
        }
        return str;
    },

    validateCurlRequest: function(curlObj) {
        //must be a valid method
        var validMethods = ["GET","POST","PUT","PATCH","DELETE","COPY","HEAD","OPTIONS","LINK","UNLINK","PURGE","LOCK","UNLOCK","PROPFIND"];
        if(validMethods.indexOf(curlObj.request.toUpperCase())===-1) {
            throw "The method "+ curlObj.request + " is not supported";
        }

        //must have a URL
        if(curlObj.args.length!==1 && !curlObj.url) {
            throw (curlObj.args.length + " option-less arguments found. Only one is supported (the URL)");
        }
    },

    getHeaders: function(curlObj) {
        var headerArray = curlObj.header;
        var str="";
        if(curlObj["userAgent"]) {
        	str += "User-Agent: "+this.trimQuotesFromString(curlObj["userAgent"]);+"\\n";
        	this.headerPairs["User-Agent"]=this.trimQuotesFromString(curlObj["userAgent"]);
        }
        if(headerArray==null || headerArray.length==0) {
            return str;
        }
        var numHeaders = headerArray.length;
        for(var i=0;i<numHeaders;i++) {
            var thisHeader = headerArray[i];

            //remove leading and trailing quotes
            thisHeader = this.trimQuotesFromString(thisHeader);

            var keyIndex = thisHeader.indexOf(":");
            this.headerPairs[thisHeader.substring(0,keyIndex).trim()]=thisHeader.substring(keyIndex+1, thisHeader.length).trim();
            if(keyIndex===-1) {
                continue;
            }

            str += thisHeader+"\\n";
        }
        return str;
    },

    setDefaultPostmanFields: function(request, curlstring) {
        request.collectionId = "";
        request.description = 'Generated from a curl request: \n' +  curlstring.split('"').join('\\\"');
        request.descriptionFormat = "html";
        request.preRequestScript="";
        request.tests="";
        request.synced=false;
        request.pathVariables={};
        request.version = 2;
    },

    resetProgram: function() {
        program["user-agent"] = null;
        program["data"] = [];
        program["dataBinary"] = null;
        program["dataAscii"] = [];
        program["dataUrlencode"] = [];
        program["form"] = [];
        delete program["get"];
        program["header"] = [];
        program["request"] = null;
        program["url"] = null;
        this.requestUrl = "";
    },

    getDataForForm: function(dataArray, toDecodeUri) {
        var numElems = dataArray.length;
        var retVal = [];
        for(var i=0;i<numElems;i++) {
            var thisElem = dataArray[i];
            if(dataArray[i]==="") continue;

            thisElem = this.trimQuotesFromString(thisElem);

            var equalIndex = thisElem.indexOf("=");
           	var key="";
            var val="";
            if(equalIndex===-1) {
                key = thisElem;
                val = "";
            }
            else {
            	key = thisElem.substring(0,equalIndex);
            	val = thisElem.substring(equalIndex+1, thisElem.length);
            }

            if(toDecodeUri) {
                key = decodeURIComponent(key);
                val = decodeURIComponent(val);
            }

            retVal.push({
                key: key,
                value: val,
                type: "text",
                enabled: true
            });
        }

        return retVal;
    },

    getDataForUrlEncoded: function(dataArray, enableDecoding) {
        var concatString = dataArray.join("&").trim();
        if(concatString === null) return null;

        dataArray = this.trimQuotesFromString(concatString).split("&");
        return this.getDataForForm(dataArray, enableDecoding);
    },

    getLowerCaseHeader: function(hk, rHeaders) {
        for(var hKey in rHeaders) {
            if(rHeaders.hasOwnProperty(hKey)) {
                if(hKey.toLowerCase()===hk.toLowerCase()) {
                    return rHeaders[hKey];
                }
            }
        }
        return "";
    },

    convertArrayToAmpersandString: function(arr) {
    	if(arr instanceof Array) {
    		return arr.join("&");
		}
		else {
			return "";
		}
    },

    trySetDefaultBodyMethod: function(request) {
        //if the request method is GET
        if(this.methodsWithBody.indexOf(request.method.toUpperCase()) === -1) {
            request.method = "POST";
        }
    },

    convertCurlToRequest: function(curlString) {
        try {
            if(this.loaded===false) {
                this.initialize();
                this.loaded=true;
            }

            this.resetProgram();

            var argv = shellQuote.parse("node " + curlString);
            var sanitizedArgs = _.map(_.filter(argv, function(arg) { return !_.isEmpty(arg) }), function (arg) {
              if (_.isObject(arg) && arg.op === 'glob') {
                return arg.pattern
              }
              else {
                return arg
              }
            })
            var curlObj = program.parse(sanitizedArgs);

            this.headerPairs = {};

            if(!curlObj.request) {
            	curlObj.request = "GET";
            }

            curlObj.request = this.trimQuotesFromString(curlObj.request);

            this.validateCurlRequest(curlObj);

            if(curlObj.args.length == 0) {
                this.requestUrl = curlObj.url;
            }
            else {
                this.requestUrl = curlObj.args[0];
            }

            var request = {};

            request.method= 'GET';//curlObj.request;
            if(curlObj.request && curlObj.request.length!==0) {
                request.method = curlObj.request;
            }

            request.url = request.name = this.trimQuotesFromString(this.requestUrl);

            request.headers = this.getHeaders(curlObj);
            request.time = (new Date()).getTime();
            request.id = request.collectionRequestId = uuid.v4();

            var content_type = this.getLowerCaseHeader("content-type", this.headerPairs);
            var urlData = "";

            request.data = [];

            request.dataMode = "params";


            if(curlObj["dataBinary"]!==null) {
                request.dataMode="raw";
                request.data = request.rawModeData = curlObj["dataBinary"];
                urlData = request.rawModeData;
                this.trySetDefaultBodyMethod(request);
            }
            if(curlObj.form && curlObj.form.length!==0) {
                request.data = request.data.concat(this.getDataForForm(curlObj.form, false));
                request.dataMode = "params";
                this.trySetDefaultBodyMethod(request);
            }
            if((curlObj.data && curlObj.data.length!==0) || (curlObj.dataAscii && curlObj.dataAscii.length!==0)) {
            	if(content_type==="" || content_type === "application/x-www-form-urlencoded") {
            		//No content-type set
            		//set to urlencoded
            		request.data = request.data.concat(this.getDataForUrlEncoded(curlObj.data, false)).concat(this.getDataForUrlEncoded(curlObj.dataAscii, false));
            		request.dataMode = "urlencoded";
                	this.trySetDefaultBodyMethod(request);
                    var str1 = this.convertArrayToAmpersandString(curlObj.data),
                        str2 = this.convertArrayToAmpersandString(curlObj.dataAscii);
                	urlData = str1
                        + ((str1.length>0 && str2.length>0)?"&":"")
                        + str2;

            	}
                else {
                	var dataString = this.convertArrayToAmpersandString(curlObj.data);
                	var dataAsciiString = this.convertArrayToAmpersandString(curlObj.dataAscii);
                    var str1 = this.trimQuotesFromString(dataString),
                        str2 = this.trimQuotesFromString(dataAsciiString);

                    request.data =  str1
                        + ((str1.length>0 && str2.length>0)?"&":"")
                        + str2;
                    request.dataMode = "raw";
                    this.trySetDefaultBodyMethod(request);
                    urlData = request.data;
                }
            }
            if(curlObj['dataUrlencode'] && curlObj['dataUrlencode'].length!==0) {
                request.data = request.data.concat(this.getDataForUrlEncoded(curlObj['dataUrlencode'], true));
                request.dataMode = "urlencoded";
                this.trySetDefaultBodyMethod(request);
                urlData = curlObj['dataUrlencode'];
            }

            if(!!curlObj.get) {
                request.method="GET";
                if(request.method.toLowerCase()==="get" && urlData!=="") {
                	request.url+="?" + urlData;
                }
            }

            request.id = request.collectionRequestId = uuid.v4();

            this.setDefaultPostmanFields(request, curlString);
            return request;
        }
        catch(e) {
            if(e.message === "process.exit is not a function") {
                //happened because of
                e.message = "Invalid format for cURL."
            }
            return {error:e};
        }
    }
};

module.exports = curlConverter;
