# SFDX Data Deploy Plugin

> SFDX plugin to deploy/retrieve data to/from Salesforce

[![Version](https://img.shields.io/npm/v/sfdx-data-deploy-plugin)](https://www.npmjs.com/package/sfdx-data-deploy-plugin)
[![GitHub Issues](https://img.shields.io/github/issues/georgwittberger/sfdx-data-deploy-plugin)](https://github.com/georgwittberger/sfdx-data-deploy-plugin/issues)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-data-deploy-plugin)](https://www.npmjs.com/package/sfdx-data-deploy-plugin)
[![License](https://img.shields.io/github/license/georgwittberger/sfdx-data-deploy-plugin)](https://github.com/georgwittberger/sfdx-data-deploy-plugin/blob/master/LICENSE.txt)

This [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli) plugin can be used to retrieve records from any Salesforce org and save them to local JSON files. These data files can be stored in Git repositories to share them with other team members. The plugin can use the data files to deploy records to several other Salesforce orgs. Practical use cases are:

- Maintaining test data as source files in a Git repository
- Rolling out configuration records as part of deployments

TIP: Enhance your developer experience with the corresponding [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=georgwittberger.sfdx-data-deploy-vscode).

---

<!-- toc -->

- [SFDX Data Deploy Plugin](#sfdx-data-deploy-plugin)
- [Installation](#installation)
- [Usage](#usage)
- [Known Issues](#known-issues)
- [Commands](#commands)
- [Version History](#version-history)
- [License](#license)
<!-- tocstop -->

# Installation

1. Download and install [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli).
2. Install the plugin:

   ```bash
   sfdx plugins:install sfdx-data-deploy-plugin
   ```

TIP: If you want to install the plugin on a CI server you must add it to the whitelisted plugins as described in [this blog post](https://developer.salesforce.com/blogs/2017/10/salesforce-dx-cli-plugin-update.html).

# Usage

## Creating a Deployment Descriptor

The `deploy` and `retrieve` commands of the plugin require a directory as the context for the deployment. This directory must contain a special JSON file named `datadeploy.json` which describes the deployment characteristics. The major content of this deployment descriptor is the declaration of jobs which are executed one after another. Each job represents the handling of records for a specific Salesforce object.

Creating a new deployment context requires the following steps.

1. Create a new directory in your local file system.
2. Create a new JSON file named `datadeploy.json` in that directory.
3. Insert the following content into the JSON file:

   ```json
   {
     "jobs": []
   }
   ```

The following sections explains how to create jobs for data deployment and retrieval.

## Creating a Job

The `jobs` array in the deployment descriptor must be populated with the configurations of jobs to be executed sequentially in the given order. Each job configuration has general properties which apply to both deployment and retrieval. These properties are described in the following table.

| Property         | Type   | Description                                                          |
| ---------------- | ------ | -------------------------------------------------------------------- |
| `sObjectApiName` | string | API name of the Salesforce object to deploy/retrieve records for.    |
| `dataFileName`   | string | Name of the JSON file storing the records for the Salesforce object. |

The following example shows a basic job configuration for the Account object.

```json
{
  "sObjectApiName": "Account",
  "dataFileName": "Account.json"
}
```

## Creating a Deployment Job Configuration

For deployment of records from the data file to Salesforce there are some further configuration properties which can be declared as an object in the `deployConfig` property of the job configuration. The deployment properties are described in the following table.

| Property                 | Type    | Description                                                                                                                                                                                                                                             |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `externalIdFieldApiName` | string  | _(optional)_ API name of the field containing the external ID. If present, the plugin creates an `upsert` job which is capable of updating existing records matching the values in the given field. If not present, the plugin creates an `insert` job. |
| `maxWaitMinutes`         | number  | _(optional)_ Maximum number of minutes to wait for completion of the job. If not present, defaults to 5 minutes.                                                                                                                                        |
| `failOnError`            | boolean | _(optional)_ Defines if the whole deployment fails if some error occurred for this job. If not present, defaults to `true`.                                                                                                                             |

The following example shows a deployment job configuration for the Account object, assuming that there is an external ID field named `AccountId__c`. Deployment would continue even if some error occurred in the job (e.g. invalid external ID field or some records failing to deploy).

```json
{
  "sObjectApiName": "Account",
  "dataFileName": "Account.json",
  "deployConfig": {
    "externalIdFieldApiName": "AccountId__c",
    "maxWaitMinutes": 2,
    "failOnError": false
  }
}
```

Data is deployed using the [Salesforce Bulk API](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/). The plugin checks the results of each Bulk API job before continuing with the next one. By default, the deployment fails with an error if at least one record could not be deployed properly. Note that in this case some records from this job and all previous jobs may still have been deployed because the Bulk API is not transactional.

## Creating a Retrieval Job Configuration

For retrieval of records from Salesforce to the data file there are some further configuration properties which can be declared as an object in the `retrieveConfig` property of the job configuration. The retrieval properties are described in the following table.

| Property               | Type     | Description                                                                                                         |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `includeFieldApiNames` | string[] | _(optional)_ API names of fields to retrieve for the Salesforce object. Default: all fields                         |
| `excludeFieldApiNames` | string[] | _(optional)_ API names of fields to exclude when retrieving all fields.                                             |
| `excludeSystemFields`  | boolean  | _(optional)_ Exclude system fields like `Id`, `OwnerId`, etc. from retrieved data. Default: `true`                  |
| `filterCriteria`       | object   | _(optional)_ Criteria to select specific records to retrieve. See filtering explanation below. Default: all records |
| `sortFieldApiNames`    | string[] | _(optional)_ API names of fields to sort the records. See sorting explanation below.                                |
| `maxRecordCount`       | number   | _(optional)_ Maximum number of records to retrieve. Default: `10000`                                                |

The following example shows a retrieval job configuration for the Account object, assuming there is the custom field `AccountId__c`. It retrieves only records where the `Name` begins with "Demo ", fetches only the `Name` and `AccountId__c` fields and sorts the results by `Name` in ascending order.

```json
{
  "sObjectApiName": "Account",
  "dataFileName": "Account.json",
  "retrieveConfig": {
    "includeFieldApiNames": ["AccountId__c", "Name"],
    "filterCriteria": {
      "Name": { "$like": "Demo %" }
    },
    "sortFieldApiNames": ["Name"]
  }
}
```

### Filtering Retrieved Records

The retrieval configuration property `filterCriteria` enables the selection of specific records to include in the result. The property value must be a JSON-based condition expression (like MongoDB) as supported by the [JSForce SObject#find()](https://jsforce.github.io/document/#query) method.

The following table shows some examples of filter criteria.

| Filter Criteria                               | Meaning                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `{ "Name": "Umbrella Corp." }`                | Records with exact `Name` value "Umbrella Corp."                        |
| `{ "Account.Name": "Umbrella Corp." }`        | Records where related `Account` has exact `Name` value "Umbrella Corp." |
| `{ "FirstName": { "$like": "Hello%" } }`      | Records with `FirstName` starting with "Hello"                          |
| `{ "LastName": { "$like": "%World" } }`       | Records with `LastName` ending with "World"                             |
| `{ "EMail": { "$like": "%gmail%" } }`         | Records with `EMail` containing "gmail"                                 |
| `{ "GrossValue": { "$gte": 1000 } }`          | Records with `GrossValue` greater than or equal to 1000                 |
| `{ "NetValue": { "$lte": 500 } }`             | Records with `NetValue` less than or equal to 500                       |
| `{ "FirstName": "John", "LastName": "Doe" }`  | Records with `FirstName` exactly "John" AND `LastName` exactly "Doe"    |
| `{ "FirstName": { "$in": ["Bob", "John"] } }` | Records with `FirstName` being exactly "Bob" OR "John"                  |

Another more complex example with OR-combined criteria.

```json
{
  "$or": [{ "Name": { "$like": "Test%" } }, { "GrossValue": { "$lte": 500 } }]
}
```

It selects those records with a name starting with "Test" OR with a gross value less than/equal to 500.

### Sorting Retrieved Records

The retrieval configuration property `sortFieldApiNames` enables sorting of the records in the result by multiple fields. The property value must be an array of the field API names. The first field in the array is the strongest sorting criterion. If a second field is given then records with the same value in the first sorting field are sorted by the value of the second field and so on.

If a field name is given without any prefix (e.g. `FirstName`) then records are sorted by this field in ascending order.

If a field name is prefixed by a dash (e.g. `-LastName`) then records are sorted by this field in descending order.

## Deploying Data to Salesforce

The plugin requires a connection to a Salesforce org in order to deploy records from data files. Once the deployment descriptor has been prepared and the data files contain the proper records follow these steps to perform the deployment.

1. Connect Salesforce CLI to the target Salesforce org (see the [auth commands](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_auth.htm#cli_reference_force_auth) in the documentation).
2. Run the `deploy` command (here assuming that the deployment descriptor is located in the subdirectory `testdata`):

   ```bash
   sfdx datadeploy:deploy -d testdata -u yourname@yourorg.com
   ```

TIP: If the deployment descriptor is in the current working directory you can omit the `-d` flag.

The plugin runs the deployment for all jobs defined the deployment descriptor by default. Use the command line options `-i` or `-x` followed by a comma-separated list of data file paths to specify which jobs to include or exclude from deployment. The file paths are resolved inside the deployment directory.

```bash
sfdx datadeploy:deploy -d testdata -i IncludedFile1.json,IncludedFile2.json -u yourname@yourorg.com
```

## Retrieving Data from Salesforce

The plugin requires a connection to a Salesforce org in order to retrieve records to data files. Once the deployment descriptor has been prepared with the proper retrieval configuration follow these steps to retrieve records.

1. Connect Salesforce CLI to the target Salesforce org (see the [auth commands](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_auth.htm#cli_reference_force_auth) in the documentation).
2. Run the `retrieve` command (here assuming that the deployment descriptor is located in the subdirectory `testdata`):

   ```bash
   sfdx datadeploy:retrieve -d testdata -u yourname@yourorg.com
   ```

TIP: If the deployment descriptor is in the current working directory you can omit the `-d` flag.

The plugin runs the retrieval for all jobs defined the deployment descriptor by default. Use the command line options `-i` or `-x` followed by a comma-separated list of data file paths to specify which jobs to include or exclude from retrieval. The file paths are resolved inside the deployment directory.

```bash
sfdx datadeploy:retrieve -d testdata -i IncludedFile1.json,IncludedFile2.json -u yourname@yourorg.com
```

## Tips and Examples

### Same Set of Fields for Each Record in JSON File

Be careful when crafting JSON files with records by hand. **Each record must have the same set of fields!** If only one record does not contain a field that other records have then this field will be ignored for all records in the file. The order of the fields does not matter.

In the following example the `Type` of the second Account record will not be deployed because the field is missing for the first record.

```json
[
  {
    "AccountId__c": "b7845971-2677-43e0-9316-4909060da942",
    "Name": "Demo Company 1"
  },
  {
    "AccountId__c": "01898b4a-555b-4010-ab1c-e6e9aeb3f20e",
    "Name": "Demo Company 2",
    "Type": "Prospect"
  }
]
```

### Deploying and Retrieving Lookup Relationships

In the data file use the relationship name followed by the external ID field API name of the related object and provide the other record's external ID value. In the following example for the Contact object the reference to the Account is created by referring to the custom external ID field `AccountId__c` defined on the Account object.

```json
{
  "Account.AccountId__c": "b7845971-2677-43e0-9316-4909060da942"
}
```

Note that custom lookup relationships must be suffixed by `__r` as in the following example.

```json
{
  "OtherObject__r.OtherExternalId__c": "b7845971-2677-43e0-9316-4909060da942"
}
```

When retrieving a lookup relationship using the external ID field of the related object use the following syntax in the retrieval configuration of the job. The example fetches the Account relationship for Contact records using the custom external ID field `AccountId__c` defined on the Account object.

```json
{
  "sObjectApiName": "Contact",
  "dataFileName": "Contact.json",
  "retrieveConfig": {
    "includeFieldApiNames": ["ContactId__c", "Account.AccountId__c"]
  }
}
```

If you want to retrieve all fields but still include further lookup relationships specify an asterisk as in the following example for the Contact object.

```json
{
  "sObjectApiName": "Contact",
  "dataFileName": "Contact.json",
  "retrieveConfig": {
    "includeFieldApiNames": ["*", "Account.AccountId__c"],
    "excludeFieldApiNames": ["AccountId"]
  }
}
```

### Example Configuration

See the subdirectory `data` in this Git repository for an example.

# Known Issues

## Setting NULL for custom lookup relationship does not work

Assuming that an object has a custom lookup relationship to another custom object (not a standard object) then using the data deployment to remove an existing relation to another record will not work. Pay attention to `null` values in relationship fields as in the following example.

```json
{
  "OtherObject__c": null
}
```

Records with existing relations in the target org will still have their relation after deployment. This is an issue in the JSforce library, see <https://github.com/jsforce/jsforce/issues/943>

# Commands

<!-- commands -->

- [`sfdx datadeploy:deploy [-d <directory>] [-i <array>] [-x <array>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-datadeploydeploy--d-directory--i-array--x-array--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
- [`sfdx datadeploy:retrieve [-d <directory>] [-i <array>] [-x <array>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-datadeployretrieve--d-directory--i-array--x-array--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx datadeploy:deploy [-d <directory>] [-i <array>] [-x <array>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

```
Deploy records from data files to Salesforce

USAGE
  $ sfdx datadeploy:deploy [-d <directory>] [-i <array>] [-x <array>] [-u <string>] [--apiversion <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --deploydir=deploydir                                                         Directory containing the deployment
                                                                                    descriptor 'datadeploy.json'
                                                                                    (default: current working directory)

  -i, --include=include                                                             Include only the given list of data
                                                                                    files (default: all)

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -x, --exclude=exclude                                                             Exclude the given list of data files
                                                                                    (default: none)

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com
  $ sfdx datadeploy:deploy --deploydir ./testdata --include Account.json,Contact.json --targetusername myOrg@example.com
```

## `sfdx datadeploy:retrieve [-d <directory>] [-i <array>] [-x <array>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

```
Retrieve records from Salesforce to data files

USAGE
  $ sfdx datadeploy:retrieve [-d <directory>] [-i <array>] [-x <array>] [-u <string>] [--apiversion <string>] [--json]
  [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --deploydir=deploydir                                                         Directory containing the deployment
                                                                                    descriptor 'datadeploy.json'
                                                                                    (default: current working directory)

  -i, --include=include                                                             Include only the given list of data
                                                                                    files (default: all)

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -x, --exclude=exclude                                                             Exclude the given list of data files
                                                                                    (default: none)

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLES
  $ sfdx datadeploy:retrieve --deploydir ./testdata --targetusername myOrg@example.com
  $ sfdx datadeploy:retrieve --deploydir ./testdata --include Account.json,Contact.json --targetusername
  myOrg@example.com
```

<!-- commandsstop -->

# Version History

- Release **2.5.0**
  - NEW: Job retrieval configuration option `excludeSystemFields`
- Release **2.4.5**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.4.4**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.4.3**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.4.2**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.4.1**
  - UPDATE: Mention Visual Studio Code extension in README file
- Release **2.4.0**
  - NEW: Command line options `--include` and `--exclude` support real paths relative to deployment directory
  - UPDATE: Log messages no longer use emoji but text prefixes
  - UPDATE: Dependencies updated to most recent versions
- Release **2.3.7**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.3.6**
  - FIX: #11 Bulk Data Load jobs are not closed after deployment
- Release **2.3.5**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.3.4**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.3.3**
  - FIX: #6 Jenkins deployment fails because of json output
- Release **2.3.2**
  - FIX: #4 Import will abort with no message when wrong externalId is set in deployment descriptor
  - FIX: #5 Import will abort with no message when import file is empty
- Release **2.3.1**
  - FIX: #3 retrieveConfig.maxRecordCount is limited to 500
- Release **2.3.0**
  - NEW: Command line options `--include` and `--exclude` to define which jobs to include or exclude from deployment or retrieval
- Release **2.2.0**
  - NEW: Job deployment configuration option `failOnError`
  - UPDATE: Internal refactoring to move logic to separate modules
  - FIX: Error message definition `errorDeploymentFileNotReadable` missing for `retrieve` command
- Release **2.1.0**
  - NEW: Summary table after deployment or retrieval
  - NEW: Icon prefixes for console log messages
- Release **2.0.3**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.0.2**
  - NEW: System fields `LastActivityDate`, `LastViewedDate` and `LastReferencedDate` are excluded from retrieval
  - NEW: Data of a record is printed when it fails to deploy
  - UPDATE: Dependencies updated to most recent versions
- Release **2.0.1**
  - UPDATE: Dependencies updated to most recent versions
- Release **2.0.0**
  - NEW: Direct internal usage of Bulk API instead of using other CLI commands
  - NEW: JSON format for data files
  - NEW: Command to retrieve data from Salesforce
- Release **1.0.2**
  - FIX: #1 Incorrect default values for options displayed in CLI help
- Release **1.0.0**
  - Initial version

# License

[MIT](https://opensource.org/licenses/MIT)
