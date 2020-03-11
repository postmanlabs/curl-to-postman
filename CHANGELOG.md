CHANGELOG

#### 0.2.0: Mar 11, 2020
* Fix for --data-raw import removes body:
  * https://github.com/postmanlabs/postman-app-support/issues/8126
  * https://github.com/postmanlabs/postman-app-support/issues/7983
  * https://github.com/postmanlabs/postman-app-support/issues/7895

#### 0.1.0: Nov 22, 2019
* Fix for https://github.com/postmanlabs/postman-app-support/issues/2791 - not escaping single quotes correctly in the cURL commands
* Fix for https://github.com/postmanlabs/postman-app-support/issues/7390 - removing unnecessary options from the cURL commands

#### 0.0.5: Sep 3, 2019
* Fix for https://github.com/postmanlabs/curl-to-postman/issues/1 - cURL commands with `$` prepended to arguments not importing correctly
* Fix for https://github.com/postmanlabs/curl-to-postman/issues/2 - the importer was using -X to determine method, not -d or --head
* Fix for https://github.com/postmanlabs/curl-to-postman/issues/4 - Data parameters are added to the URL if the method is determined to be GET, PUT, or HEAD

#### 0.0.4: June 5, 2019
* Updated dependency versions
* Updated lockfile for npm@6.4.1

#### 0.0.3: May 29, 2019
* First public (beta) release
* Conforming to the internal Postman plugin interface
* Fixes for Github issues - 4770,3623,3135,4018,5737,5286, among others
