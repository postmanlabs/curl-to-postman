A cURL to POSTMan converter.

Current CURL options that are supported are:
    -A, --user-agent
    -d, --data
    --data-binary
    -F, --form
    -G, --get
    -H, --header
    -X, --request

Usage examples:

    Read spec.json and store the output in output.json after grouping the requests into folders
        ./curl2postman -s spec.json -o output.json -g

    Read spec.json and print the output to the console
        ./curl2postman -s spec.json

    Read spec.json and print the prettified output to the console
        ./curl2postman -s spec.json -p
        