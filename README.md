A cURL to POSTMan converter.

Current CURL options that are supported are:

    -A, --user-agent
    -d, --data
    --data-binary
    -F, --form
    -G, --get
    -H, --header
    -X, --request

Installation

```cli
npm install curl-to-postmanv2
```

**Usage Examples of the Lib:**

**1. Validate function**: Helps you to validate the curl command.

```js
const { validate } = require("curl-to-postmanv2");

let v = validate("curl -X https://google.co.in");
console.log(v); // { result: true }
```

**2. Convert Function**: Helps to convert curl to postman

```js
const { convert } = require("curl-to-postmanv2");

let con = convert(
  { type: "string", data: "curl https://google.co.in" },
  (err, result) => {
    if (err) {
      console.log(err);

      process.exit(1);
    }
    console.log(result);
    console.log("data: ", result.output[0].data);
  }
);
```

**3. getMetaData Function**: To get meta data for the curl request

```js
const { getMetaData } = require("curl-to-postmanv2");

let meta = getMetaData(
  { type: "string", data: "curl https://google.co.in" },
  (err, result) => {
    if (err) {
      console.log(err);

      process.exit(1);
    }
    console.log(result);
    console.log("data: ", result.output[0].data);
  }
);
```

Usage examples:

    Read spec.json and store the output in output.json after grouping the requests into folders
        ./curl2postman -s spec.json -o output.json -g

    Read spec.json and print the output to the console
        ./curl2postman -s spec.json

    Read spec.json and print the prettified output to the console
        ./curl2postman -s spec.json -p
