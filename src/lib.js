const commander = require('commander'),
  _ = require('lodash').noConflict(),
  shellQuote = require('../assets/shell-quote'),
  unnecessaryOptions = require('../assets/unnecessaryOptions'),
  supportedOptions = require('../assets/supportedOptions'),
  formDataOptions = ['-d', '--data', '--data-raw', '--data-binary', '--data-ascii'];

var program,

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
        .usage('[options] <URL ...>');
      supportedOptions.forEach((option) => {
        var optionStr = '';
        optionStr += option.short ? `${option.short}, ${option.long}` : option.long;
        if (option.format) {
          optionStr += ` ${option.format}`;
        }
        if (option.collectValues) {
          program.option(optionStr, option.description, collectValues, []);
        }
        else {
          program.option(optionStr, option.description, null);
        }
      });
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
      // If --get/-G option is given with --data/-d/--data-raw/--data-binary/--data-urlencode/--data-ascii.
      // Then the value of data body will append to the URL query params regardless what method is mentioned.
      // Related Doc - https://curl.haxx.se/docs/manpage.html#-G
      if (curlObj.get && (curlObj.data.length > 0 || curlObj.dataAscii.length > 0 ||
         curlObj.dataUrlencode.length > 0 || curlObj.dataRaw.length > 0 || curlObj.dataBinary)) {
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
      // checking if the user has mentioned any of these (-d, --data, --data-raw
      // --data-binary, --data-ascii) in curl command
      else if (curlObj.data.length > 0 || curlObj.dataAscii.length > 0 ||
         curlObj.dataUrlencode.length > 0 || curlObj.dataRaw.length > 0 || curlObj.dataBinary) {
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
         '(-d/--data/--data-raw/--data-binary/--data-ascii/--data-urlencode) are not supported');
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

    getDataForForm: function(dataArray, toDecodeUri, mode) {
      var numElems = dataArray.length,
        retVal = [],
        equalIndex,
        key = '',
        val = '',
        headerMatch;

      for (let i = 0; i < numElems; i++) {
        let thisElem = dataArray[i],
          paramObj = { type: 'text' };

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

          if (mode === 'formdata') {
            headerMatch = val.match(/;\s*type=([^\s\/;]+)\/([^;\s]+)\s*(?:;(.*))?$/);

            // remove content type header from value
            if (headerMatch) {
              paramObj.contentType = headerMatch[1] + '/' + headerMatch[2];
              val = val.slice(0, headerMatch.index);
            }

            // set type of param as file for value starting with @
            if (val.startsWith('@')) {
              paramObj.type = 'file';
              val = val.slice(1);
            }

            // remove starting and ending double quotes if present
            if (val.length > 1 && val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1);
              // unescape all double quotes as we have removed starting and ending double quotes
              val = val.replace(/\\\"/gm, '"');
            }
          }
        }

        if (toDecodeUri) {
          key = decodeURIComponent(key);
          val = decodeURIComponent(val);
        }

        _.assign(paramObj, { key, value: val });
        retVal.push(paramObj);
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
      var argv = shellQuote.parse('node ' + string, function(key) {
          // this is done to prevent converting vars like $id in the curl input to ''
          return '$' + key;
        }),
        sanitizedArgs = _.map(_.filter(argv, function(arg) {
          // remove arg if it is present in unnecessary options list
          if (unnecessaryOptions.includes(arg)) {
            return false;
          }
          return !_.isEmpty(arg);
        }), function (arg) {
          if (_.isObject(arg) && arg.op === 'glob') {
            return arg.pattern;
          }
          else if (arg.op && arg.op.startsWith('$') && arg.op.length > 3) {
            // in the app, certain headers like -H $'cookie: abc' are treated as operators
            // converting the arg to cookie: abc instead of op: $'cookie: abc'
            return arg.op.substring(2, arg.op.length - 1);
          }
          else if (arg.startsWith('$') && arg.length > 1) {
            // removing $ before every arg like $'POST' and
            // converting the arg to 'POST'
            // link of RFC- http://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
            return arg.substring(1);
          }

          return arg;

        }),
        validArgs = [],
        i;
      supportedOptions.forEach((option) => {
        validArgs.push(option.long);
        option.short && validArgs.push(option.short);
      });
      for (i = 0; i < sanitizedArgs.length; i++) {
        let arg = sanitizedArgs[i];
        // check for not exact equal to -X also, as it can be of the form -X POST
        if (arg.startsWith('-X') && arg !== '-X') {
          // suppose arg = -XPOST
          // the arg preceding isn't a commander option(e.g. -H)
          if (!validArgs.includes(sanitizedArgs[i - 1])) {
            // gets POST from -XPOST
            let method = arg.slice(2);
            // replaces value at index i to -X from -XPOST
            sanitizedArgs[i] = '-X';
            // inserts value 'POST' at index i+1
            sanitizedArgs.splice(i + 1, 0, method);
          }
        }
      }
      return sanitizedArgs;
    },

    getMetaData: function(curlString) {
      try {
        this.initialize();
        var sanitizeArgs = this.sanitizeArgs(curlString),
          curlObj = program.parse(sanitizeArgs);

        this.getRequestUrl(curlObj);

        return {
          url: this.requestUrl
        };
      }
      catch (e) {
        if (e.message === 'process.exit is not a function') {
        // happened because of
          e.message = 'Invalid format for cURL.';
        }
        return { error: e };
      }
    },

    getRequestUrl: function(curlObj) {
      this.requestUrl = '';
      if (curlObj.args.length === 0) {
        if (curlObj.url) {
        // url is populated if there's no unknown option
          this.requestUrl = curlObj.url;
        }
        else {
        // if there is an unknown option, we have to take it from the rawArgs
          try {
            this.requestUrl = curlObj.rawArgs.slice(-1)[0];
            /* eslint-disable max-depth */
            if (this.requestUrl.startsWith('-')) {
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
    },

    /**
     * Parses raw data and generates object from it by understanding content present in it
     *
     * @param {String} data - Raw data string
     * @param {String} contentType - Content type header value
     * @returns {Object} Parsed data in key-value pairs as object
     */
    parseFormBoundryData: function (data, contentType) {
      var m,
        boundary,
        parts,
        parsedFormData = [];

      // Examples for content types:
      //      multipart/form-data; boundary="----7dd322351017c"; ...
      //      multipart/form-data; boundary=----7dd322351017c; ...
      m = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);

      // \r\n is part of the boundary.
      boundary = '\r\n--' + (m[1] || m[2]);

      // split data based on boundary string
      parts = data.split(new RegExp(boundary));

      _.forEach(parts, (part) => {
        var subparts = part.split('\r\n\r\n'),
          headers,
          formDataRow = {};

        if (subparts.length < 2) {
          return;
        }

        // identify key/name from subpart 1
        headers = subparts[0].split('\r\n');
        _.forEach(headers, (header) => {
          // first try to identify if header contains both name and filename
          var matchResult = header.match(/^.*name="([^"]*)"\s*;\s*filename="([^"]*)"$/);

          if (matchResult) {
            // keep formdata row type as file if filename is present
            formDataRow = {
              key: matchResult[1],
              value: matchResult[2],
              type: 'file'
            };
          }
          else {
            // if both name and filename is not present, use "name" as key and data present in subpart[1] as value
            matchResult = header.match(/^.*name="([^"]*)"$/);
            if (matchResult) {
              formDataRow = {
                key: matchResult[1],
                value: subparts[1],
                type: 'text'
              };
            }
          }
        });

        // assign key values to parsed data
        if (!_.isEmpty(formDataRow)) {
          parsedFormData.push(formDataRow);
        }
      });

      return parsedFormData;
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
          bodyArr = [],
          dataString,
          dataRawString,
          dataAsciiString,
          dataUrlencode,
          formData;

        this.headerPairs = {};

        // if method is not given in the curl command
        if (!curlObj.request) {
          curlObj.request = this.getRequestMethod(curlObj);
        }

        curlObj.request = this.trimQuotesFromString(curlObj.request);

        this.validateCurlRequest(curlObj);

        this.getRequestUrl(curlObj);

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
        else if (curlObj.form && curlObj.form.length !== 0) {
          request.body.mode = 'formdata';
          request.body.formdata = this.getDataForForm(curlObj.form, false, request.body.mode);
        }
        else if ((curlObj.data && curlObj.data.length !== 0) || (curlObj.dataAscii && curlObj.dataAscii.length !== 0) ||
          (curlObj.dataRaw && curlObj.dataRaw.length !== 0) ||
          (curlObj.dataUrlencode && curlObj.dataUrlencode.length !== 0)) {
          if (content_type === '' || content_type === 'application/x-www-form-urlencoded') {
            // No content-type set
            // set to urlencoded
            request.body.mode = 'urlencoded';
            request.body.urlencoded = this.getDataForUrlEncoded(curlObj.data, true)
              .concat(this.getDataForUrlEncoded(curlObj.dataRaw, true))
              .concat(this.getDataForUrlEncoded(curlObj.dataUrlencode, true))
              .concat(this.getDataForUrlEncoded(curlObj.dataAscii, false));

            bodyArr.push(this.convertArrayToAmpersandString(curlObj.data));
            bodyArr.push(this.convertArrayToAmpersandString(curlObj.dataRaw));
            bodyArr.push(this.convertArrayToAmpersandString(curlObj.dataUrlencode));
            bodyArr.push(this.convertArrayToAmpersandString(curlObj.dataAscii));
            urlData = _.join(_.reject(bodyArr, (ele) => {
              return !ele;
            }), '&');
          }
          else {
            dataString = this.convertArrayToAmpersandString(curlObj.data);
            dataRawString = this.convertArrayToAmpersandString(curlObj.dataRaw);
            dataUrlencode = this.convertArrayToAmpersandString(curlObj.dataUrlencode);
            dataAsciiString = this.convertArrayToAmpersandString(curlObj.dataAscii);
            bodyArr.push(this.trimQuotesFromString(dataString));
            bodyArr.push(this.trimQuotesFromString(dataRawString));
            bodyArr.push(this.trimQuotesFromString(dataUrlencode));
            bodyArr.push(this.trimQuotesFromString(dataAsciiString));

            request.body.mode = 'raw';
            request.body.raw = _.join(_.reject(bodyArr, (ele) => {
              return !ele;
            }), '&');

            urlData = request.data;
          }
        }
        else if (_.toLower(content_type).startsWith('multipart/form-data')) {
          /**
           * get data arg value from raw args as formdata boundary separated string
           * is not parsed as any of data options by commander
           */
          _.forEach(curlObj.rawArgs, (arg, index) => {
            if (_.includes(formDataOptions, arg)) {
              formData = _.get(curlObj.rawArgs, index + 1);
              return false;
            }
          });
          request.body.mode = 'formdata';
          request.body.formdata = this.parseFormBoundryData(formData, content_type);
        }

        if (request.body.mode === 'formdata') {
          /**
           * remove content-type header for form-data body type as it overrides the header added by postman
           * resulting in incorrect boundary details in header value
           */
          _.remove(request.header, (h) => {
            return _.toLower(h.key) === 'content-type';
          });
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
