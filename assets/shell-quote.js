/* eslint-disable */
exports.quote = function (xs) {
  return xs.map(function (s) {
    if (s && typeof s === 'object') {
      return s.op.replace(/(.)/g, '\\$1');
    }
    else if (/["\s]/.test(s) && !/'/.test(s)) {
      return "'" + s.replace(/(['\\])/g, '\\$1') + "'";
    }
    else if (/["'\s]/.test(s)) {
      return '"' + s.replace(/(["\\$`!])/g, '\\$1') + '"';
    }
    else {
      return String(s).replace(/([A-z]:)?([#!"$&'()*,:;<=>?@\[\\\]^`{|}])/g, '$1\\$2');
    }
  }).join(' ');
};

// '<(' is process substitution operator and
// can be parsed the same as control operator
var CONTROL = '(?:' + [
  '\\|\\|', '\\&\\&', ';;', '\\|\\&', '\\<\\(', '>>', '>\\&', '[&;()|<>]'
].join('|') + ')';
var META = '|&;()<> \\t';
var BAREWORD = '(\\\\[\'"' + META + ']|[^\\s\'"' + META + '])+';
var SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
var DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';

var TOKEN = '';
for (var i = 0; i < 4; i++) {
  TOKEN += (Math.pow(16, 8) * Math.random()).toString(16);
}

/**
 Regex expression to identify standard unicode escape sequences, matched group corrsponds to hexadecimal code.

 First matching group correspond to Hexadecimal code, between U+0000 and U+00FF (ISO-8859-1)
 Second matching group correspond to Unicode, between U+0000 and U+FFFF (the Unicode Basic Multilingual Plane)
 Third matching group correspond to Unicode with surrounding curly braces,
  between U+0000 and U+10FFFF (the entirety of Unicode)
 Forth matching group correspond to single character codes

 Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#escape_sequences
 */
const unicodeRegExp = /\\x([0-9A-Fa-f]{2})|\\u([0-9A-Fa-f]{4})|\\u\{([0-9A-Fa-f]{1,6})\}|\\([\s\S])/gm;

// Single character escape sequence mapping to corresponding character 
const escapeCharMap = {
  'b': '\b',
  'f': '\f',
  'n': '\n',
  'r': '\r',
  't': '\t',
  'v': '\v',
  '0': '\0',
};

exports.parse = function (s, env, opts) {
  var mapped = parse(s, env, opts);
  if (typeof env !== 'function') return mapped;
  return mapped.reduce(function (acc, s) {
    if (typeof s === 'object') return acc.concat(s);
    var xs = s.split(RegExp('(' + TOKEN + '.*?' + TOKEN + ')', 'g'));
    if (xs.length === 1) return acc.concat(xs[0]);
    return acc.concat(xs.filter(Boolean).map(function (x) {
      if (RegExp('^' + TOKEN).test(x)) {
        return JSON.parse(x.split(TOKEN)[1]);
      }
      else return x;
    }));
  }, []);
};

function parse(s, env, opts) {
  var chunker = new RegExp([
    '(' + CONTROL + ')', // control chars
    '(' + BAREWORD + '|' + SINGLE_QUOTE + '|' + DOUBLE_QUOTE + ')*'
  ].join('|'), 'g');
  var match = s.match(chunker).filter(Boolean);
  var commented = false;

  if (!match) return [];
  if (!env) env = {};
  if (!opts) opts = {};
  return match.map(function (s, j) {
    if (commented) {
      return;
    }
    if (RegExp('^' + CONTROL + '$').test(s)) {
      return { op: s };
    }

    var replacer = function (match, p1, p2, p3, p4) {
      // escape single character sequence by replacing it with actual char. i.e. "\\n" to "\n"
      if (p4) {
        return escapeCharMap[p4] || `\\${p4}`;
      }
      // only one of three will be defined at a time
      var matchedCodeUnit = p1 || p2 || p3;
        // parse matched hexadecimal code to integer
        EqCodeUnit = parseInt(matchedCodeUnit, 16);

      // don't convert unicode chars outside range
      if (EqCodeUnit > parseInt('10FFFF', 16)) {
        return match;
      }
      // convert to equivalent unicode character
      return String.fromCharCode(EqCodeUnit);
    };

    // resolve ansi_c_like_strings (https://wiki.bash-hackers.org/syntax/quoting#ansi_c_like_strings)
    if (typeof s === 'string' && s.startsWith('$\'') && s.endsWith('\'') && s.length > 3) {
      // replace escaped unicode sequence with coresponding unicode character
      s = s.replace(unicodeRegExp, replacer);
    }

    // Hand-written scanner/parser for Bash quoting rules:
    //
    //  1. inside single quotes, all characters are printed literally.
    //  2. inside double quotes, all characters are printed literally
    //     except variables prefixed by '$' and backslashes followed by
    //     either a double quote or another backslash.
    //  3. outside of any quotes, backslashes are treated as escape
    //     characters and not printed (unless they are themselves escaped)
    //  4. quote context can switch mid-token if there is no whitespace
    //     between the two quote contexts (e.g. all'one'"token" parses as
    //     "allonetoken")
    var SQ = "'";
    var DQ = '"';
    var DS = '$';
    var BS = opts.escape || '\\';
    var quote = false;
    var esc = false;
    var out = '';
    var isGlob = false;

    for (var i = 0, len = s.length; i < len; i++) {
      var c = s.charAt(i);
      isGlob = isGlob || (!quote && (c === '*' || c === '?'));
      if (esc) {
        out += c;
        esc = false;
      }
      else if (quote) {
        if (c === quote) {
          quote = false;
        }
        else if (quote == SQ && s.charAt(0) !== DS) {
          out += c;
        }
        else { // Double quote
          if (c === BS) {
            i += 1;
            c = s.charAt(i);
            if (c === DQ || c === BS || c === DS || (c === SQ && s.charAt(0) === DS)) {
              out += c;
            } else {
              out += BS + c;
            }
          }
          else if (c === DS) {
            out += parseEnvVar();
          }
          else {
            out += c;
          }
        }
      }
      else if (c === DQ || c === SQ) {
        quote = c;
      }
      else if (RegExp('^' + CONTROL + '$').test(c)) {
        return { op: s };
      }
      else if (RegExp('^#$').test(c)) {
        commented = true;
        if (out.length) {
          return [out, { comment: s.slice(i + 1) + match.slice(j + 1).join(' ') }];
        }
        return [{ comment: s.slice(i + 1) + match.slice(j + 1).join(' ') }];
      }
      else if (c === BS) {
        esc = true;
      }
      else if (c === DS) {
        out += parseEnvVar();
      }
      else out += c;
    }

    if (isGlob) return { op: 'glob', pattern: out };

    return out;

    function parseEnvVar() {
      i += 1;
      var varend, varname;
      //debugger
      if (s.charAt(i) === '{') {
        i += 1;
        if (s.charAt(i) === '}') {
          throw new Error("Bad substitution: " + s.substr(i - 2, 3));
        }
        varend = s.indexOf('}', i);
        if (varend < 0) {
          throw new Error("Bad substitution: " + s.substr(i));
        }
        varname = s.substr(i, varend - i);
        i = varend;
      }
      else if (/[*@#?$!_\-]/.test(s.charAt(i))) {
        varname = s.charAt(i);
        i += 1;
      }
      else {
        varend = s.substr(i).match(/[^\w\d_]/);
        if (!varend) {
          varname = s.substr(i);
          i = s.length;
        } else {
          varname = s.substr(i, varend.index);
          i += varend.index - 1;
        }
      }
      return getVar(null, '', varname);
    }
  })
    // finalize parsed aruments
    .reduce(function (prev, arg) {
      if (arg === undefined) {
        return prev;
      }
      return prev.concat(arg);
    }, []);

  function getVar(_, pre, key) {
    var r = typeof env === 'function' ? env(key) : env[key];
    if (r === undefined && key != '')
      r = '';
    else if (r === undefined)
      r = '$';

    if (typeof r === 'object') {
      return pre + TOKEN + JSON.stringify(r) + TOKEN;
    }
    else return pre + r;
  }
}
