#!/bin/bash
# ----------------------------------------------------------------------------------------------------------------------
# This script is intended to execute unit tests.
# ----------------------------------------------------------------------------------------------------------------------

# stop on first error
set -e;

# run mocha tests
echo -e "\033[93mRunning sails/mocha unit tests...\033[0m";
echo -en "\033[0m\033[2mmocha `mocha --version`\033[0m";

# run test
./node_modules/.bin/_mocha --reporter spec test/unit/*.test.js;