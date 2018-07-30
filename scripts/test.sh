#!/bin/bash
# ----------------------------------------------------------------------------------------------------------------------
# This script is intended to execute unit tests.
# ----------------------------------------------------------------------------------------------------------------------

# stop on first error
set -e;

# run mocha tests
echo -e "\033[93mRunning sails/mocha unit/convertion tests...\033[0m";
echo -en "\033[0m\033[2mmocha `mocha --version`\033[0m";

# run test
nyc ./node_modules/.bin/_mocha --reporter spec test/**/*.test.js;