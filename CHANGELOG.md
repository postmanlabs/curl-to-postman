# cURL to Postman Importer Changelog

## [Unreleased]

## [v1.8.2] - 2025-02-20

### Added

-   [#13455](https://github.com/postmanlabs/postman-app-support/issues/13455) Added support for -b and --cookie options and create relavant cookie header.

## [v1.8.1] - 2024-04-17

### Added

-   Added support for determining raw body language based on content-type header.

## [v1.8.0] - 2024-01-17

### Changed

-   Fix for - [#12349](https://github.com/postmanlabs/postman-app-support/issues/12349) Fixed issue where GraphQL requests were failing to send correct data.
-   Fixed various TypeErrors that were occurring frequently for users.

## [v1.7.1] - 2023-07-17

## [v1.7.0] - 2023-06-27

### Added

-   Fix for - [#9941](https://github.com/postmanlabs/postman-app-support/issues/9941) Add method to identify GraphQL requests from body data

### Changed

-   Assigned user errors for various handled errors

## [v1.6.0] - 2023-04-17

### Added

-   Add url validation in validate and convert functions
-   GitHub Actions for Release management.

### Changed

-   Bumped up minimum Node version to 12.
-   Unit tests now run on Node versions 12, 16 and 18.

## [v1.5.0] - 2023-03-31

-   Fixed an issue where request generation failed for certain bash operators.
-   Fixed an issue where cURL with comments described was converted incorrectly.

## Previous Releases

Newer releases follow the [Keep a Changelog](https://keepachangelog.com) format.

#### v1.4.0 (March 17, 2023)

-   Fixed issue [#7895](https://github.com/postmanlabs/postman-app-support/issues/7895) where cURL with no specific method defined for formdata type of body were not converted correctly.

#### v1.3.0 (March 02, 2023)

-   Fix for [#8087](https://github.com/postmanlabs/postman-app-support/issues/8087) - Add support to convert digest and NTLM auth types

#### v1.2.0 (February 07, 2023)

-   Fix an issue where a correct error is thrown if curl string has invalid args

#### v1.1.3 (February 03, 2023)

-   Fixed issue [#5182](https://github.com/postmanlabs/postman-app-support/issues/5182) where cURL in Windows cmd formats were not imported correctly.

#### v1.1.2 (January 10, 2023)

-   Changed regex to check for prefix space in url with query parameters for given curl string

#### v1.1.1 (June 2, 2022)

-   Updated how error was handled in case of malformed URL.

#### v1.1.0 (May 16, 2022)

-   Fixes #8433 - non-apostrophed ('...') url with multiple params support in cURL import.

#### v1.0.0 (October 18, 2021)

-   Fixed issue where file references were not present in imported cURL.◊
-   Fixed issue where formdata value were not un-escaped correctly.
-   Fixed issue where raw formdata string with boundary were not converted as formdata body.
-   Fixed issue where escaped single character sequence were not correctly represented in request body.
-   Fixed issue where some characters were not escaped correctly.
-   Updated README with installation and use cases and added LICENSE.
-   Added script for automating release process.

#### 0.5.1: Apr 29, 2020

-   Added getMetaData function in root exports

#### 0.5.0: Apr 29, 2020

-   Added a function to get meta data from a curl command.

#### 0.4.0: Apr 21, 2020

-   Fix for <https://github.com/postmanlabs/postman-app-support/issues/8292> - --data-urlencode now successfully imports body

#### 0.3.0: Mar 27, 2020

-   Fix for <https://github.com/postmanlabs/postman-app-support/issues/7806> - -X argument parses method correcrtly, not interfere with any other args

#### 0.2.0: Mar 11, 2020

-   Fix for <https://github.com/postmanlabs/postman-app-support/issues/7895> - --data-raw now successfully imports body

#### 0.1.0: Nov 22, 2019

-   Fix for <https://github.com/postmanlabs/postman-app-support/issues/2791> - not escaping single quotes correctly in the cURL commands
-   Fix for <https://github.com/postmanlabs/postman-app-support/issues/7390> - removing unnecessary options from the cURL commands

#### 0.0.5: Sep 3, 2019

-   Fix for <https://github.com/postmanlabs/curl-to-postman/issues/1> - cURL commands with `$` prepended to arguments not importing correctly
-   Fix for <https://github.com/postmanlabs/curl-to-postman/issues/2> - the importer was using -X to determine method, not -d or --head
-   Fix for <https://github.com/postmanlabs/curl-to-postman/issues/4> - Data parameters are added to the URL if the method is determined to be GET, PUT, or HEAD

#### 0.0.4: June 5, 2019

-   Updated dependency versions
-   Updated lockfile for npm@6.4.1

#### 0.0.3: May 29, 2019

-   First public (beta) release
-   Conforming to the internal Postman plugin interface
-   Fixes for Github issues - 4770,3623,3135,4018,5737,5286, among others

[Unreleased]: https://github.com/postmanlabs/curl-to-postman/compare/v1.8.2...HEAD

[v1.8.2]: https://github.com/postmanlabs/curl-to-postman/compare/v1.8.1...v1.8.2

[v1.8.1]: https://github.com/postmanlabs/curl-to-postman/compare/v1.8.0...v1.8.1

[v1.8.0]: https://github.com/postmanlabs/curl-to-postman/compare/v1.7.1...v1.8.0

[v1.7.1]: https://github.com/postmanlabs/curl-to-postman/compare/v1.7.0...v1.7.1

[v1.7.0]: https://github.com/postmanlabs/curl-to-postman/compare/v1.6.0...v1.7.0

[v1.6.0]: https://github.com/postmanlabs/curl-to-postman/compare/v1.5.0...v1.6.0

[v1.5.0]: https://github.com/postmanlabs/curl-to-postman/compare/1.4.0...1.5.0
