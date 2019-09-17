#!/bin/bash

# Stop on first error
set -e;

# information block

echo -e "\033[0m\033[2m";
date;
echo "node `node -v`";
echo "npm  v`npm -v`";
which git &>/dev/null && git --version;
echo -e "\033[0m";

# git version
which git &>/dev/null && \
  echo -e "Running on branch: \033[4m`git rev-parse --abbrev-ref HEAD`\033[0m (${NODE_ENV:=development} environment)";

# run lint
npm run test-lint;

# run unit tests
npm run test-unit;
