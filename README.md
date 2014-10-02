A Swagger to POSTMan converter.

Usage examples:

    Read spec.json and store the output in output.json after grouping the requests into folders
        ./swagger2postman -s spec.json -o output.json -g

    Read spec.json and print the output to the console
        ./swagger2postman -s spec.json

    Read spec.json and print the prettified output to the console
        ./swagger2postman -s spec.json -p
        