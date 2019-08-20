var uuidv4 = require('uuid/v4'),
    commander = require('commander'),
    _ = require('lodash').noConflict(),
    shellQuote = require('shell-quote'),
    program;

var curlConverter = {
    requestUrl: "",

    initialize: function() {
        function collectValues(str, memo) {
            memo.push(str);
            return memo;
        }

        program = new commander.Command();

        program.version('0.0.1')
            .allowUnknownOption()
            .usage('[options] <URL ...>')
            .option('-A, --user-agent <string>', 'An optional user-agent string', null)
            .option('-d, --data [string]', 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded', collectValues, [])
            .option('--data-ascii [string]', 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded', collectValues, [])
            .option('--data-urlencode [string]', 'Sends the specified data to the server with type application/x-www-form-urlencoded. application/x-www-form-urlencoded', collectValues, [])
            .option('--data-binary [string]', 'Data sent as-is', null)
            .option('-F, --form <name=content>', 'A single form-data field', collectValues, [])
            .option('-G, --get', 'Forces the request to be sent as GET, with the --data parameters appended to the query string', null)
            .option('-H, --header [string]', 'Add a header (can be used multiple times)', collectValues, [])
            .option('-X, --request [string]', 'Specify a custom request mehod to be used', null)
            .option('-I, --head', 'Forces the request to be sent as HEAD, with the --data parameters appended to the query string', null)
            .option('-T, --upload-file [string]', 'Forces the request to be sent as PUT with the specified local file to the server', collectValues, [])
            .option('--url [string]', 'An alternate way to specify the URL', null)
            .option('--basic', 'Overrides previous auth settings')
            .option('-u, --user [string]', 'Basic auth ( -u <username:password>)', null);
    },

    trimQuotesFromString: function(str) {
        if(!str) return '';
        var strlen = str.length;
        if((str[0]==='"' && str[strlen-1]==='"') || (str[0]==="'" && str[strlen-1]==="'"))  {
        	return str.substring(1,strlen-1);
        }
        return str;
    },

    addQueryParamsFromDataOption: function(curlObj, urlData, request) {
        // What this will do:
        // If URL is http://example.com?a=b and -d 'c=d' => http://example.com?a=b&c=d
        // If URL is http://example.com#fragment and -d 'c=d' => http://example.com#fragment
        if (curlObj.uploadFile.length > 0 || !!curlObj.head || !!curlObj.get) {
            if (request.url.includes('?')) {
                if (!request.url.includes('#')) {
                    request.url += '&' + urlData;
                }
            }
            else {
                if (!request.url.includes('#')) {
                    request.url += '?' + urlData;
                }
            }
        }
    },

    getRequestMethod: function(curlObj) {
        // RFC- https://curl.haxx.se/docs/manpage.html
        // checking if the user has mentioned -T or --upload-file in curl command
        if (curlObj.uploadFile.length > 0) {
            return "PUT";
        }
        // checking if the user has mentioned -I or --head in curl command
        else if (curlObj.head) {
            return "HEAD";
        }
        // checking if the user has mentioned -G or --get in curl command
        else if (curlObj.get) {
            return "GET";
        }
        // checking if the user has mentioned any of these (-d, --data, --data-binary, --data-ascii) in curl command
        else if (curlObj.data.length > 0 || curlObj.dataAscii.length > 0 || curlObj.dataUrlencode.length > 0 || curlObj.dataBinary) {
            return "POST";
        }
        // set method to GET if no param is present
        else {
            return "GET";
        }
    },

    validateCurlRequest: function(curlObj) {
        //must be a valid method
        var validMethods = ["GET","POST","PUT","PATCH","DELETE","COPY","HEAD","OPTIONS","LINK","UNLINK","PURGE","LOCK","UNLOCK","PROPFIND"],
            singleWordXMethod,
            singleWordMethodPrefix = '-X';
        if(validMethods.indexOf(curlObj.request.toUpperCase())===-1) {

            // no valid method
            // -XPOST might have been used
            // try the POST part again
            singleWordXMethod = _.find(curlObj.rawArgs, function (arg) { return arg.startsWith(singleWordMethodPrefix); });
            if(singleWordXMethod) {
                // try to re-set curlObj.request to the newly extracted method
                curlObj.request = singleWordXMethod.substring(singleWordMethodPrefix.length);                
            }

            if(validMethods.indexOf(curlObj.request.toUpperCase())===-1) {
                // the method is still not valid
                throw new Error("The method "+ curlObj.request + " is not supported");
            }
        }

        //must have a URL
        if(curlObj.args.length > 1 && !curlObj.url) {
            throw new Error('Only the URL can be provided without an option preceding it. All other inputs must be specified via options.');
        }
    },

    getHeaders: function(curlObj) {
        var headerArray = curlObj.header,
            numHeaders, retVal = [], uaString;

        headerArray = headerArray || [];
    

        if(curlObj["userAgent"]) {
        	uaString = this.trimQuotesFromString(curlObj["userAgent"]);
        	this.headerPairs["User-Agent"] = uaString;
            retVal.push({
                key: "User-Agent",
                value: uaString
            })
        }

        if(headerArray==null || headerArray.length==0) {
            return retVal;
        }

        numHeaders = headerArray.length;

        for(var i=0;i<numHeaders;i++) {
            var thisHeader = headerArray[i], keyIndex;

            if (!(typeof thisHeader === 'string')) {
                console.warn('Unparseable header in curl conversion: ', thisHeader);
                continue;
            }
            //remove leading and trailing quotes
            thisHeader = this.trimQuotesFromString(thisHeader);
            keyIndex = thisHeader.indexOf(":");
            if(keyIndex === -1) {
                if(thisHeader.endsWith(';')) {
                    //If you send the custom header with no-value then its header must be \ 
                    // terminated with a semicolon, such as -H "X-Custom-Header;" to send "X-Custom-Header:".
                    thisHeader = thisHeader.slice(0, -1) + ":";
                    keyIndex = thisHeader.indexOf(":");
                }
                else {
                    continue;
                }
            }
            key = thisHeader.substring(0,keyIndex).trim();
            value = thisHeader.substring(keyIndex+1, thisHeader.length).trim();

            if(this.headerPairs.hasOwnProperty(key)) {
                // don't add the same header twice
                continue;
            }

            this.headerPairs[key] = value;

            retVal.push({
                key: key,
                value: value
            });
        }

        return retVal;
    },

    resetProgram: function() {
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
                type: "text"
            });
        }

        return retVal;
    },

    getDataForUrlEncoded: function(dataArray, enableDecoding) {
        var concatString = dataArray.join("&").trim();

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
        return arr.join("&");
    },

    convertCurlToRequest: function(curlString) {
        try {
            this.initialize();
            this.requestUrl = '';

            //replace -XPOST with -X POST
            curlString = curlString.replace(/(-X)([A-Z]+)/, function (match, x, method) {return x + " " + method;})

            var argv = shellQuote.parse("node " + curlString, function(key) {
                // this is done to prevent converting vars like $id in the curl input to ''
                return '$' + key;
            });
            var sanitizedArgs = _.map(_.filter(argv, function(arg) { return !_.isEmpty(arg) }), function (arg) {
              if (_.isObject(arg) && arg.op === 'glob') {
                return arg.pattern
              }
              else if (arg.op && arg.op.startsWith('$') && arg.op.length > 3) {
                // in the app, certain headers like -H $'cookie: abc' are treated as operators
                // converting the arg to cookie: abc instead of op: $'cookie: abc'
                return arg.op.substring(2, arg.op.length-1);
              }
              else {
                return arg
              }
            });
            var curlObj = program.parse(sanitizedArgs);

            this.headerPairs = {};

            // if method is not given in the curl command
            if(!curlObj.request) {
                curlObj.request = this.getRequestMethod(curlObj);
            }

            curlObj.request = this.trimQuotesFromString(curlObj.request);

            this.validateCurlRequest(curlObj);

            if(curlObj.args.length == 0) {
                if (curlObj.url) {
                    // url is populated if there's no unknown option
                    this.requestUrl = curlObj.url;
                }
                else {
                    // if there is an unknown option, we have to take it from the rawArgs
                    try {
                        this.requestUrl = curlObj.rawArgs.slice(-1)[0];
                        if (this.requestUrl.startsWith('-')) {
                            throw 'No valid URL found';
                        }
                    }
                    catch(e) {
                        throw new Error('Error while parsing cURL: Could not identify the URL. Please use the --url option.');
                    }
                }
            }
            else {
                this.requestUrl = curlObj.args[0];
            }

            var request = {};

            request.method= 'GET';
            if(curlObj.request && curlObj.request.length!==0) {
                request.method = curlObj.request;
            }

            request.url = request.name = this.trimQuotesFromString(this.requestUrl);

            request.header = this.getHeaders(curlObj);

            request.body = {};

            if(curlObj.user) {
                var basicAuthParts = curlObj.user.split(":") || [];
                if(basicAuthParts.length >= 2) {
                    request.auth = {
                        type: 'basic',
                        basic: [
                            { key: 'username', value: basicAuthParts[0], type: 'string' },
                            { key: 'password', value: basicAuthParts[1], type: 'string' }
                        ]
                    };
                }
            }

            var content_type = this.getLowerCaseHeader("content-type", this.headerPairs);
            var urlData = "";

            if(curlObj["dataBinary"]!==null) {
                request.body.mode = "raw";
                request.body.raw = curlObj["dataBinary"];
            }
            if(curlObj.form && curlObj.form.length!==0) {
                request.body.mode = "formdata";
                request.body.formdata = this.getDataForForm(curlObj.form, false);
            }
            if((curlObj.data && curlObj.data.length!==0) || (curlObj.dataAscii && curlObj.dataAscii.length!==0)) {
            	if(content_type==="" || content_type === "application/x-www-form-urlencoded") {
            		//No content-type set
            		//set to urlencoded
                    request.body.mode = "urlencoded";
            		request.body.urlencoded = this.getDataForUrlEncoded(curlObj.data, true).concat(this.getDataForUrlEncoded(curlObj.dataAscii, false));
                	
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

                    request.body.mode = "raw";
                    request.body.raw = str1
                        + ((str1.length>0 && str2.length>0)?"&":"")
                        + str2;

                    urlData = request.data;
                }
            }

            // add data to query parameteres in the URL from --data or -d option
            this.addQueryParamsFromDataOption(curlObj, urlData, request);

            request.description = 'Generated from a curl request: \n' +  curlString.split('"').join('\\\"');
            return request;
        }
        catch(e) {
            if (e.message === "process.exit is not a function") {
                //happened because of
                e.message = "Invalid format for cURL."
            }
            return { error: e };
        }
    }
};

module.exports = curlConverter;
