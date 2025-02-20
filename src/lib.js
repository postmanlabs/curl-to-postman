const commander = require('commander'),
  validUrl = require('valid-url'),
  _ = require('lodash').noConflict(),
  shellQuote = require('../assets/shell-quote'),
  unnecessaryOptions = require('../assets/unnecessaryOptions'),
  supportedOptions = require('../assets/supportedOptions'),
  UserError = require('./UserError'),
  { USER_ERRORS } = require('./constants'),
  formDataOptions = ['-d', '--data', '--data-raw', '--data-binary', '--data-ascii'],
  allowedOperators = ['<', '>', '(', ')'],
  REQUEST_BODY_LANGUAGE_TEXT = 'text',
  REQUEST_BODY_LANGUAGE_JSON = 'json',
  REQUEST_BODY_LANGUAGE_JAVASCRIPT = 'javascript',
  REQUEST_BODY_LANGUAGE_HTML = 'html',
  REQUEST_BODY_LANGUAGE_XML = 'xml',
  LANGUAGE_REGEX_MATCH = {
    [REQUEST_BODY_LANGUAGE_JSON]: /^application\/(\S+\+)?json/,
    [REQUEST_BODY_LANGUAGE_JAVASCRIPT]: /^(text|application)\/(\S+\+)?javascript/,
    [REQUEST_BODY_LANGUAGE_XML]: /^(text|application)\/(\S+\+)?xml/,
    [REQUEST_BODY_LANGUAGE_HTML]: /^text\/html/
  },
  ALLOWED_DUPLICATE_HEADERS = ['cookie'];

var program,

  curlConverter = {
    requestUrl: '',
    initialize: function() {
      /**
       * Collects values from the command line arguments and adds them to the memo array.
       *
       * @param {string} str - The argument value to collect.
       * @param {Array} memo - The array to add the collected values to.
       * @returns {Array} - The updated memo array.
       */
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
         curlObj.dataUrlencode.length > 0 || curlObj.dataRaw.length > 0 ||
         curlObj.dataBinary || curlObj.form.length > 0) {
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
        singleWordMethodPrefix = '-X',
        reqMethod = _.toUpper(curlObj.request);

      if (validMethods.indexOf(reqMethod) === -1) {

        // no valid method
        // -XPOST might have been used
        // try the POST part again
        singleWordXMethod = _.find(curlObj.rawArgs, function (arg) {
          return typeof arg === 'string' && arg.startsWith(singleWordMethodPrefix);
        });

        if (singleWordXMethod) {
        // try to re-set curlObj.request to the newly extracted method
          curlObj.request = singleWordXMethod.substring(singleWordMethodPrefix.length);
        }

        reqMethod = _.toUpper(curlObj.request);

        if (validMethods.indexOf(reqMethod) === -1) {
        // the method is still not valid
          throw new UserError(USER_ERRORS.METHOD_NOT_SUPPORTED`${curlObj.request}`);
        }
      }

      // cannot send HEAD request in the curl command with POST data option and without --get/-G
      // Ex- 'curl -I http://example.com -d "a=b"' will throw an error.
      if ((curlObj.data.length > 0 || curlObj.dataAscii.length > 0 ||
         curlObj.dataBinary || curlObj.dataUrlencode.length > 0) &&
            curlObj.head && !curlObj.get) {
        throw new UserError(USER_ERRORS.UNABLE_TO_PARSE_HEAD_AND_DATA);
      }

      /**
       * For cURL with ^ as line termination character, each such line termination char will be an separate arg.
       * throw an error as we have separate handling for parsing such cURLs
       * once it fails here using convertForCMDFormat()
       */
      if (curlObj.args.length > 1 && _.includes(curlObj.args, '^')) {
        throw new UserError(USER_ERRORS.INPUT_WITHOUT_OPTIONS);
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

      // If any cookies are added under -b or --cookie arg, add them as Cookie header
      if (curlObj.cookie && Array.isArray(curlObj.cookie)) {
        curlObj.cookie.forEach((cookieVal) => {
          headerArray.push('Cookie: ' + this.trimQuotesFromString(cookieVal));
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

        if (this.headerPairs.hasOwnProperty(key) && !ALLOWED_DUPLICATE_HEADERS.includes(key.toLowerCase())) {
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

    /**
     * Generates the auth object for the request
     *
     * @param {Object} curlObj The curl object
     * @returns {Object} The auth object
     */
    getAuth: function(curlObj) {
      let authObject;

      // It is a valid cURL to have only username, in that case keep password empty
      const userParts = (typeof curlObj.user === 'string' && curlObj.user.split(':')) || [];
      if (userParts.length === 1) {
        userParts[1] = '';
      }

      if (curlObj.digest === true) {
        authObject = {
          type: 'digest',
          digest: [
            { key: 'username', value: userParts[0], type: 'string' },
            { key: 'password', value: userParts[1], type: 'string' }
          ]
        };
      }
      else if (curlObj.ntlm === true) {
        authObject = {
          type: 'ntlm',
          ntlm: [
            { key: 'username', value: userParts[0], type: 'string' },
            { key: 'password', value: userParts[1], type: 'string' }
          ]
        };
      }
      else {
        // Fallback to basic auth
        authObject = {
          type: 'basic',
          basic: [
            { key: 'username', value: userParts[0], type: 'string' },
            { key: 'password', value: userParts[1], type: 'string' }
          ]
        };
      }

      return authObject;
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
            /**
             * Following regexp tries to find sytax like "";type=application/json" from value.
             * Here first matching group is type of content-type (i.e. "application") and
             * second matching group is subtype of content type (i.e. "json")
             * Similar to usecase: https://github.com/postmanlabs/openapi-to-postman/blob/develop/lib/schemaUtils.js
             */
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
          key = decodeURIComponent(key.replace(/\+/g, '%20'));
          val = decodeURIComponent(val.replace(/\+/g, '%20'));
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
          else if (typeof (arg) !== 'string' && arg.op === '&') {
            // non-string data should not be here, might be a case of malformed URL or unsanitized characters
            const inCorrectlyFormedcURLRegex1 = /[^ "]+\?[^ "]+&[^ "]+($|(?=\s))/g, // checks - foo/bar?foo=1&bar=2
              inCorrectlyFormedcURLRegex2 = /(\w+=\w+&?)/g; // checks - foo?bar=1&baz=2

            if (string.match(inCorrectlyFormedcURLRegex1) || string.match(inCorrectlyFormedcURLRegex2)) {
              throw new UserError(USER_ERRORS.MALFORMED_URL);
            }
          }
          else if (_.isFunction(arg.startsWith) && arg.startsWith('$') && arg.length > 1) {
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
        if (_.isFunction(arg.startsWith) && arg.startsWith('-X') && arg !== '-X') {
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
          return { error: new UserError(USER_ERRORS.INVALID_FORMAT) };
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
            if (!validUrl.isUri(this.requestUrl)) {
              // eslint-disable-next-line no-throw-literal
              throw 'No valid URL found';
            }
          }
          catch (e) {
            throw new UserError(USER_ERRORS.UNABLE_TO_PARSE_NO_URL);
          }
        }
        /* eslint-enable */
      }
      else if (curlObj.args.length > 0) {
        let argStr = typeof curlObj.url === 'string' ? curlObj.url : '';

        // eslint-disable-next-line consistent-return
        _.forEach(curlObj.args, (arg, index) => {
          const previousArgOp = _.get(curlObj.args, `${index - 1}.op`, ''),
            shouldAddCurrentArg = index === 0 || allowedOperators.includes(previousArgOp);

          if (typeof arg === 'string' && shouldAddCurrentArg) {
            /**
             * Add current string arg only if previous arg is an allowed op.
             * For URL like "hello.com/<id>", as "<" and ">" are treated as bash operators,
             * we'll add such operator and next arg that was split up by it in URL
             */
            argStr += arg;
          }
          else if (typeof arg === 'object' && allowedOperators.includes(arg.op)) {
            argStr += arg.op;
          }
          else {
            /**
             * Stop adding more args as soon as we know that args are not split by allowed operators.
             */
            return false;
          }
        });
        this.requestUrl = argStr;
      }
      else {
        throw new UserError(USER_ERRORS.CANNOT_DETECT_URL);
      }
    },

    /**
     * Transforms corresponding cURL in Windows CMD format to Bash compatible version,
     * via unescaping escaped characters for Windows CMD.
     *
     * @param {String} curlString - curL string to be transformed into respectivve bash version
     * @returns {String} - Transformed cURL in Bash format
     */
    transformCmdToBash: function (curlString) {
      /**
       * three kinds of matching groups can be captured with following regexp.
       * 1. Certain characters that can be escaped by ^ (caret). Namely ^,{,},[,],<,>,\,",|,&,\n(new line)
       *    These will be replaced with character itself resulting in removal of escape char (^)
       * 2. ^%^ specifically will be replaced with % due to special escape rule
       * 3. "" will be replaced with "
       *    (single quotations are escaped with double quotes when inside string that's wrapped in double quotes)
       *
       * Ref: https://ss64.com/nt/syntax-esc.html
       * See detail regexp composition over here: https://regex101.com/r/Xbiqbq/1
       */
      return curlString.replace(new RegExp(/\^(\^|{|}|\[|\]|<|>|\\|"|\||&|\n)|\^(%)\^|"(")/, 'g'), '$1$2$3');
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

      // if correct boundary match is not found, keep formdata fields empty
      if (!m || typeof data !== 'string') {
        return parsedFormData;
      }

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

    /**
     * Converts cURL string that's in windows cmd compatible format into collection request
     *
     * @param {String} curlString - Windows cmd compatible cURL string
     * @returns {Object} Collection request JSON
     */
    convertForCMDFormat: function (curlString) {
      try {
        const bashCurlString = this.transformCmdToBash(curlString),
          request = this.convertCurlToRequest(bashCurlString, false);

        request.description = 'Generated from a curl request: \n' + curlString.split('"').join('\\\"');
        return request;
      }
      catch (error) {
        throw e;
      }
    },

    /**
     * Sanitise and parse the input cURl string
     *
     * @param {string} curlString - Input cURL string
     * @returns {object} - Parsed cURL Object
     */
    getCurlObject: function (curlString) {
      let cleanedCurlString = curlString,
        sanitizedArgs,
        isMethodGuessed = false,
        curlObj;
      try {
        sanitizedArgs = this.sanitizeArgs(cleanedCurlString);
        curlObj = program.parse(sanitizedArgs);
      }
      catch (e) {
        // [Github #8843] - RegEx to fix malformed cURLs with unquoted multi-param URLs
        const multiParamUrlRegEx = /\s([^'` "\n]+)\.([^ \n]+)&((?!["'])[^ "`'\n])+($|(?=\s))/gm;
        let matchedStrings = curlString.match(multiParamUrlRegEx),
          matchedString = '',
          prefixString = '';

        if (matchedStrings && matchedStrings.length > 0) {
          prefixString = matchedStrings[0].slice(0, 1);
          matchedString = matchedStrings[0].slice(1);
        }
        cleanedCurlString = curlString.replace(multiParamUrlRegEx, `${prefixString}'${matchedString}'`);
        sanitizedArgs = this.sanitizeArgs(cleanedCurlString);
        curlObj = program.parse(sanitizedArgs);
      }

      // Filter out comments from Args
      curlObj.args = _.filter(curlObj.args, (arg) => {
        // Each arg should be string itself, for comment we receive an object from parser
        return !(typeof arg === 'object' && typeof arg.comment === 'string');
      });

      this.headerPairs = {};

      // if method is not given in the curl command
      if (typeof curlObj.request !== 'string' || !curlObj.request) {
        curlObj.request = this.getRequestMethod(curlObj);
        isMethodGuessed = true;
      }

      curlObj.request = this.trimQuotesFromString(curlObj.request);

      this.validateCurlRequest(curlObj);

      this.getRequestUrl(curlObj);

      return { isMethodGuessed, curlObj };
    },

    /**
     * Valid if the input cURL string is valid or not
     *
     * @param {string} curlString - Input cURL string
     * @param {boolean} shouldRetry - Whether we should retry parsing for Windows CMD style cURL input
     * @returns {Object} - { result: true } if cURL is valid otherwise { result: false } with reason
     */
    validate: function (curlString, shouldRetry = true) {
      try {
        this.initialize();
        this.getCurlObject(curlString);
        return { result: true };
      }
      catch (e) {
        if (shouldRetry) {
          curlString = this.transformCmdToBash(curlString);
          return this.validate(curlString, false);
        }

        return { result: false, reason: e.message, error: e };
      }
    },

    /**
     * Escape JSON strings before JSON.parse
     *
     * @param {string} jsonString - Input JSON string
     * @returns {string} - JSON string with escaped characters
     */
    escapeJson: function (jsonString) {
      // eslint-disable-next-line no-implicit-globals
      meta = { // table of character substitutions
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r'
      };
      return jsonString.replace(/[\t\n\f\r]/g, (char) => {
        return meta[char];
      });
    },

    /**
     * Identifies whether the input data string is a graphql query or not
     *
     * @param {string} dataString - Input data string to check if it is a graphql query
     * @param {string} contentType - Content type header value
     * @returns {Object} - { result: true, graphql: {Object} } if dataString is a graphql query else { result: false }
    */
    identifyGraphqlRequest: function (dataString, contentType) {
      try {
        const rawDataObj = _.attempt(JSON.parse, this.escapeJson(dataString));

        if (contentType === 'application/json' && rawDataObj && !_.isError(rawDataObj)) {
          if (!_.has(rawDataObj, 'query') || !_.isString(rawDataObj.query)) {
            return { result: false };
          }
          if (_.has(rawDataObj, 'variables')) {
            if (!_.isObject(rawDataObj.variables)) {
              return { result: false };
            }
          }
          else {
            rawDataObj.variables = {};
          }
          if (_.has(rawDataObj, 'operationName')) {
            if (!_.isString(rawDataObj.operationName)) {
              return { result: false };
            }
            delete rawDataObj.operationName;
          }
          if (_.keys(rawDataObj).length === 2) {
            const graphqlVariables = JSON.stringify(rawDataObj.variables, null, 2);
            return {
              result: true,
              graphql: {
                query: rawDataObj.query,
                variables: graphqlVariables === '{}' ? '' : graphqlVariables
              }
            };
          }
        }
        return { result: false };
      }
      catch (e) {
        return { result: false };
      }
    },


    convertCurlToRequest: function(curlString, shouldRetry = true) {
      try {
        this.initialize();
        this.requestUrl = '';

        let { isMethodGuessed, curlObj } = this.getCurlObject(curlString),
          request = {},
          content_type,
          urlData = '',
          bodyArr = [],
          dataString,
          dataRawString,
          dataAsciiString,
          dataUrlencode,
          formData;

        request.method = 'GET';
        if (curlObj.request && curlObj.request.length !== 0) {
          request.method = curlObj.request;
        }

        request.url = request.name = this.trimQuotesFromString(this.requestUrl);

        request.header = this.getHeaders(curlObj);

        request.body = {};

        if (curlObj.user) {
          request.auth = this.getAuth(curlObj);
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

            const rawDataString = _.join(_.reject(bodyArr, (ele) => {
                return !ele;
              }), '&'),
              graphqlRequestData = this.identifyGraphqlRequest(rawDataString, content_type);

            if (graphqlRequestData.result) {
              request.body.mode = 'graphql';
              request.body.graphql = graphqlRequestData.graphql;
            }
            else {
              request.body.mode = 'raw';
              request.body.raw = rawDataString;

              request.body.options = {};
              request.body.options.raw = {};

              /* eslint-disable max-depth */
              try {
                request.body.options.raw.language = Object.keys(LANGUAGE_REGEX_MATCH)
                  .find((key) => {
                    return LANGUAGE_REGEX_MATCH[key].test(content_type);
                  }) || REQUEST_BODY_LANGUAGE_TEXT;
              }
              catch (err) {
                // In case of error, set language to text as default
                request.body.options.raw.language = REQUEST_BODY_LANGUAGE_TEXT;
              }
              /* eslint-enable max-depth */
            }

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

          /**
           * As we are parsing raw args here to detect form-data body, make sure we are also
           * defining method if not already defined in cURL
           */
          (!_.isEmpty(request.body.formdata) && isMethodGuessed) && (request.method = 'POST');
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
        if (shouldRetry) {
          try {
            // Retry conversion again by considering cURL to be in windows cmd compatible format
            return this.convertForCMDFormat(curlString);
          }
          catch (error) {
            // Retry error is not reported
          }
        }
        if (e.message === 'process.exit is not a function') {
          return { error: new UserError(USER_ERRORS.INVALID_FORMAT) };
        }
        return { error: e };
      }
    }
  };

module.exports = curlConverter;
