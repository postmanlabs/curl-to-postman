var commander = require('commander'),
  _ = require('lodash').noConflict(),
  shellQuote = require('shell-quote'),
  program,

  curlConverter = {
    requestUrl: '',

    initialize: function() {
      function collectValues(str, memo) {
        memo.push(str);
        return memo;
      }

      program = new commander.Command();

      program.version('0.0.1')
        .allowUnknownOption()
        .usage('[options] <URL ...>')
        /* eslint-disable max-len */
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
      /* eslint-enable */
    },

    trimQuotesFromString: function(str) {
      if (!str) { return ''; }
      var strlen = str.length;
      if ((str[0] === '"' && str[strlen - 1] === '"') || (str[0] === '\'' && str[strlen - 1] === '\'')) {
        return str.substring(1, strlen - 1);
      }
      return str;
    },

    // What this will do:
    // If URL is http://example.com?a=b and -d 'c=d' => http://example.com?a=b&c=d
    // If URL is http://example.com#fragment and -d 'c=d' => http://example.com#fragment
    addQueryParamsFromDataOption: function(curlObj, urlData, request) {
      // If --get/-G option is given with --data/-d/--data-binary/--data-urlencode/--data-ascii.
      // Then the value of data body will append to the URL query params regardless what method is mentioned.
      // Related Doc - https://curl.haxx.se/docs/manpage.html#-G
      if (curlObj.get && (curlObj.data.length > 0 || curlObj.dataAscii.length > 0 ||
         curlObj.dataUrlencode.length > 0 || curlObj.dataBinary)) {
        if (urlData) {
          if (request.url.includes('?')) {
            request.url += '&' + urlData;
          }
          else {
            request.url += '?' + urlData;
          }
        }
      }
    },

    getRequestMethod: function(curlObj) {
    // RFC- https://curl.haxx.se/docs/manpage.html
    // checking if the user has mentioned -T or --upload-file in curl command
      if (curlObj.uploadFile.length > 0) {
        return 'PUT';
      }
      // checking if the user has mentioned -I or --head in curl command
      else if (curlObj.head) {
        return 'HEAD';
      }
      // checking if the user has mentioned -G or --get in curl command
      else if (curlObj.get) {
        return 'GET';
      }
      // checking if the user has mentioned any of these (-d, --data, --data-binary, --data-ascii) in curl command
      else if (curlObj.data.length > 0 || curlObj.dataAscii.length > 0 ||
         curlObj.dataUrlencode.length > 0 || curlObj.dataBinary) {
        return 'POST';
      }
      // set method to GET if no param is present
      return 'GET';
    },

    validateCurlRequest: function(curlObj) {
    // must be a valid method
      var validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'COPY', 'HEAD',
          'OPTIONS', 'LINK', 'UNLINK', 'PURGE', 'LOCK', 'UNLOCK', 'PROPFIND'],
        singleWordXMethod,
        singleWordMethodPrefix = '-X';
      if (validMethods.indexOf(curlObj.request.toUpperCase()) === -1) {

        // no valid method
        // -XPOST might have been used
        // try the POST part again
        singleWordXMethod = _.find(curlObj.rawArgs, function (arg) { return arg.startsWith(singleWordMethodPrefix); });
        if (singleWordXMethod) {
        // try to re-set curlObj.request to the newly extracted method
          curlObj.request = singleWordXMethod.substring(singleWordMethodPrefix.length);
        }

        if (validMethods.indexOf(curlObj.request.toUpperCase()) === -1) {
        // the method is still not valid
          throw new Error('The method ' + curlObj.request + ' is not supported');
        }
      }

      // cannot send HEAD request in the curl command with POST data option and without --get/-G
      // Ex- 'curl -I http://example.com -d "a=b"' will throw an error.
      if ((curlObj.data.length > 0 || curlObj.dataAscii.length > 0 ||
         curlObj.dataBinary || curlObj.dataUrlencode.length > 0) &&
            curlObj.head && !curlObj.get) {
        throw new Error('Error while parsing cURL: Both (--head/-I) and' +
         '(-d/--data/--data-binary/--data-ascii/--data-urlencode) are not supported');
      }

      // must have a URL
      if (curlObj.args.length > 1 && !curlObj.url) {
        throw new Error('Only the URL can be provided without an option preceding it.' +
         'All other inputs must be specified via options.');
      }
    },

    getHeaders: function(curlObj) {
      var headerArray = curlObj.header,
        numHeaders,
        retVal = [],
        uaString;

      headerArray = headerArray || [];


      if (curlObj.userAgent) {
        uaString = this.trimQuotesFromString(curlObj.userAgent);
        this.headerPairs['User-Agent'] = uaString;
        retVal.push({
          key: 'User-Agent',
          value: uaString
        });
      }

      if (headerArray === null || headerArray.length === 0) {
        return retVal;
      }

      numHeaders = headerArray.length;

      for (let i = 0; i < numHeaders; i++) {
        let thisHeader = headerArray[i],
          keyIndex;

        if (!(typeof thisHeader === 'string')) {
          console.warn('Unparseable header in curl conversion: ', thisHeader);
          continue;
        }
        // remove leading and trailing quotes
        thisHeader = this.trimQuotesFromString(thisHeader);
        keyIndex = thisHeader.indexOf(':');
        if (keyIndex === -1) {
          if (thisHeader.endsWith(';')) {
          // If you send the custom header with no-value then its header must be \
          // terminated with a semicolon, such as -H "X-Custom-Header;" to send "X-Custom-Header:".
            thisHeader = thisHeader.slice(0, -1) + ':';
            keyIndex = thisHeader.indexOf(':');
          }
          else {
            continue;
          }
        }
        /* eslint-disable no-implicit-globals */
        key = thisHeader.substring(0, keyIndex).trim();
        value = thisHeader.substring(keyIndex + 1, thisHeader.length).trim();
        /* eslint-enable */

        if (this.headerPairs.hasOwnProperty(key)) {
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
      this.requestUrl = '';
    },

    getDataForForm: function(dataArray, toDecodeUri) {
      var numElems = dataArray.length,
        retVal = [],
        equalIndex,
        key = '',
        val = '';
      for (let i = 0; i < numElems; i++) {
        let thisElem = dataArray[i];

        if (dataArray[i] === '') { continue; }

        thisElem = this.trimQuotesFromString(thisElem);

        equalIndex = thisElem.indexOf('=');
        if (equalIndex === -1) {
          key = thisElem;
          val = '';
        }
        else {
          key = thisElem.substring(0, equalIndex);
          val = thisElem.substring(equalIndex + 1, thisElem.length);
        }

        if (toDecodeUri) {
          key = decodeURIComponent(key);
          val = decodeURIComponent(val);
        }

        retVal.push({
          key: key,
          value: val,
          type: 'text'
        });
      }

      return retVal;
    },

    getDataForUrlEncoded: function(dataArray, enableDecoding) {
      var concatString = dataArray.join('&').trim();

      dataArray = this.trimQuotesFromString(concatString).split('&');
      return this.getDataForForm(dataArray, enableDecoding);
    },

    getLowerCaseHeader: function(hk, rHeaders) {
      for (var hKey in rHeaders) {
        if (rHeaders.hasOwnProperty(hKey)) {
          if (hKey.toLowerCase() === hk.toLowerCase()) {
            return rHeaders[hKey];
          }
        }
      }
      return '';
    },

    convertArrayToAmpersandString: function(arr) {
      return arr.join('&');
    },

    sanitizeArgs: function(string) {
    // replace -XPOST with -X POST
      string = string.replace(/(-X)([A-Z]+)/, function (match, x, method) { return x + ' ' + method; });

      var argv = shellQuote.parse('node ' + string, function(key) {
          // this is done to prevent converting vars like $id in the curl input to ''
          return '$' + key;
        }),
        sanitizedArgs = _.map(_.filter(argv, function(arg) { return !_.isEmpty(arg); }), function (arg) {
          if (_.isObject(arg) && arg.op === 'glob') {
            return arg.pattern;
          }
          else if (arg.op && arg.op.startsWith('$') && arg.op.length > 3) {
            // in the app, certain headers like -H $'cookie: abc' are treated as operators
            // converting the arg to cookie: abc instead of op: $'cookie: abc'
            return arg.op.substring(2, arg.op.length - 1);
          }
          else if (arg.startsWith('$') && arg.length > 2) {
            // removing $ before every arg like $'POST' and
            // converting the arg to 'POST'
            // link of RFC- http://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
            return arg.substring(1);
          }

          return arg;

        });

      return sanitizedArgs;
    },

    convertCurlToRequest: function(curlString) {
      try {
        this.initialize();
        this.requestUrl = '';

        var sanitizedArgs = this.sanitizeArgs(curlString),
          curlObj = program.parse(sanitizedArgs),
          request = {},
          basicAuthParts,
          content_type,
          urlData = '',
          str1,
          str2,
          dataString,
          dataAsciiString;

        this.headerPairs = {};

        // if method is not given in the curl command
        if (!curlObj.request) {
          curlObj.request = this.getRequestMethod(curlObj);
        }

        curlObj.request = this.trimQuotesFromString(curlObj.request);

        this.validateCurlRequest(curlObj);

        if (curlObj.args.length === 0) {
          if (curlObj.url) {
          // url is populated if there's no unknown option
            this.requestUrl = curlObj.url;
          }
          else {
          // if there is an unknown option, we have to take it from the rawArgs
            try {
              // regex for checking if a string is a valid URL or not
              let regex = '(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}' +
              '|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]' +
              '+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})';

              curlObj.rawArgs.forEach((rawArg) => {
                if (rawArg.match(regex)) {
                  this.requestUrl = rawArg;
                }
              });

              /* eslint-disable max-depth */
              if (this.requestUrl.startsWith('-') || this.requestUrl === '') {
                // eslint-disable-next-line no-throw-literal
                throw 'No valid URL found';
              }
            }
            catch (e) {
              throw new Error('Error while parsing cURL: Could not identify the URL. Please use the --url option.');
            }
          }
          /* eslint-enable */
        }
        else {
          this.requestUrl = curlObj.args[0];
        }

        request.method = 'GET';
        if (curlObj.request && curlObj.request.length !== 0) {
          request.method = curlObj.request;
        }

        request.url = request.name = this.trimQuotesFromString(this.requestUrl);

        request.header = this.getHeaders(curlObj);

        request.body = {};

        if (curlObj.user) {
          basicAuthParts = curlObj.user.split(':') || [];
          if (basicAuthParts.length >= 2) {
            request.auth = {
              type: 'basic',
              basic: [
                { key: 'username', value: basicAuthParts[0], type: 'string' },
                { key: 'password', value: basicAuthParts[1], type: 'string' }
              ]
            };
          }
        }

        content_type = this.getLowerCaseHeader('content-type', this.headerPairs);

        if (curlObj.dataBinary !== null) {
          request.body.mode = 'raw';
          request.body.raw = curlObj.dataBinary;
        }
        if (curlObj.form && curlObj.form.length !== 0) {
          request.body.mode = 'formdata';
          request.body.formdata = this.getDataForForm(curlObj.form, false);
        }
        if ((curlObj.data && curlObj.data.length !== 0) || (curlObj.dataAscii && curlObj.dataAscii.length !== 0)) {
          if (content_type === '' || content_type === 'application/x-www-form-urlencoded') {
            // No content-type set
            // set to urlencoded
            request.body.mode = 'urlencoded';
            request.body.urlencoded = this.getDataForUrlEncoded(curlObj.data, true).concat(
              this.getDataForUrlEncoded(curlObj.dataAscii, false));

            str1 = this.convertArrayToAmpersandString(curlObj.data);
            str2 = this.convertArrayToAmpersandString(curlObj.dataAscii);
            urlData = str1 +
                        ((str1.length > 0 && str2.length > 0) ? '&' : '') +
                        str2;

          }
          else {
            dataString = this.convertArrayToAmpersandString(curlObj.data);
            dataAsciiString = this.convertArrayToAmpersandString(curlObj.dataAscii);
            str1 = this.trimQuotesFromString(dataString);
            str2 = this.trimQuotesFromString(dataAsciiString);

            request.body.mode = 'raw';
            request.body.raw = str1 +
                        ((str1.length > 0 && str2.length > 0) ? '&' : '') +
                        str2;

            urlData = request.data;
          }
        }

        // add data to query parameteres in the URL from --data or -d option
        this.addQueryParamsFromDataOption(curlObj, urlData, request);
        request.description = 'Generated from a curl request: \n' + curlString.split('"').join('\\\"');
        return request;
      }
      catch (e) {
        if (e.message === 'process.exit is not a function') {
        // happened because of
          e.message = 'Invalid format for cURL.';
        }
        return { error: e };
      }
    }
  };

module.exports = curlConverter;
