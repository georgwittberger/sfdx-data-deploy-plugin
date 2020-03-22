# SFDX Data Deploy Plugin

> SFDX plugin to deploy/retrieve data to/from Salesforce

[![Version](https://img.shields.io/npm/v/sfdx-data-deploy-plugin)](https://www.npmjs.com/package/sfdx-data-deploy-plugin)
[![GitHub Issues](https://img.shields.io/github/issues/georgwittberger/sfdx-data-deploy-plugin)](https://github.com/georgwittberger/sfdx-data-deploy-plugin/issues)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-data-deploy-plugin)](https://www.npmjs.com/package/sfdx-data-deploy-plugin)
[![License](https://img.shields.io/github/license/georgwittberger/sfdx-data-deploy-plugin)](https://github.com/georgwittberger/sfdx-data-deploy-plugin/blob/master/LICENSE.txt)

This [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli) plugin can be used to retrieve records from any Salesforce org and save them to local JSON files. These data files can be stored in Git repositories to share them with other team members. The plugin can use the data files to deploy records to several other Salesforce orgs. Practical use cases are:

- Maintaining test data as source files in a Git repository
- Rolling out configuration records as part of deployments

---

<!-- toc -->
* [SFDX Data Deploy Plugin](#sfdx-data-deploy-plugin)
* [Installation](#installation)
* [Usage](#usage)
* [Commands](#commands)
* [License](#license)
<!-- tocstop -->

# Installation

1. Download and install [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli).
2. Install the plugin:

   ```bash
   sfdx plugins:install sfdx-data-deploy-plugin
   ```

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

| Property                 | Type   | Description                                                                                                                                                                                                                                             |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `externalIdFieldApiName` | string | _(optional)_ API name of the field containing the external ID. If present, the plugin creates an `upsert` job which is capable of updating existing records matching the values in the given field. If not present, the plugin creates an `insert` job. |
| `maxWaitMinutes`         | number | _(optional)_ Maximum number of minutes to wait for completion of the job. If not present, defaults to 5 minutes.                                                                                                                                        |

The following example shows a deployment job configuration for the Account object, assuming that there is an external ID field named `AccountId__c`.

```json
{
  "sObjectApiName": "Account",
  "dataFileName": "Account.json",
  "deployConfig": {
    "externalIdFieldApiName": "AccountId__c",
    "maxWaitMinutes": 2
  }
}
```

Data is deployed using the [Salesforce Bulk API](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/). The plugin checks the results of each Bulk API job before continuing with the next one. The deployment fails with an error if at least one record could not be deployed properly. Note that it this case some records may still have been deployed because the Bulk API does not roll back the whole job.

## Creating a Retrieval Job Configuration

For retrieval of records from Salesforce to the data file there are some further configuration properties which can be declared as an object in the `retrieveConfig` property of the job configuration. The retrieval properties are described in the following table.

| Property               | Type     | Description                                                                                                                             |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `includeFieldApiNames` | string[] | _(optional)_ API names of fields to retrieve for the Salesforce object. If not present, defaults to all fields excluding system fields. |
| `excludeFieldApiNames` | string[] | _(optional)_ API names of fields to exclude when retrieving all fields.                                                                 |
| `filterCriteria`       | object   | _(optional)_ Criteria to select specific records to retrieve. See filtering explanation below. If not present, retrieves all records.   |
| `sortFieldApiNames`    | string[] | _(optional)_ API names of fields to sort the records. See sorting explanation below.                                                    |
| `maxRecordCount`       | number   | _(optional)_ Maximum number of records to retrieve. If not present, result size depends on Salesforce limits.                           |

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

| Filter Criteria                              | Meaning                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `{ "Name": "Umbrella Corp." }`               | Records with exact `Name` value "Umbrella Corp."                        |
| `{ "Account.Name": "Umbrella Corp." }`       | Records where related `Account` has exact `Name` value "Umbrella Corp." |
| `{ "FirstName": { "$like": "Hello%" } }`     | Records with `FirstName` starting with "Hello"                          |
| `{ "LastName": { "$like": "%World" } }`      | Records with `LastName` ending with "World"                             |
| `{ "EMail": { "$like": "%gmail%" } }`        | Records with `EMail` containing "gmail"                                 |
| `{ "GrossValue": { "$gte": 1000 } }`         | Records with `GrossValue` greater than or equal to 1000                 |
| `{ "NetValue": { "$lte": 500 } }`            | Records with `NetValue` less than or equal to 500                       |
| `{ "FirstName": "John", "LastName": "Doe" }` | Records with `FirstName` exactly "John" AND `LastName` exactly "Doe"    |

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

## Retrieving Data from Salesforce

The plugin requires a connection to a Salesforce org in order to retrieve records to data files. Once the deployment descriptor has been prepared with the proper retrieval configuration follow these steps to retrieve records.

1. Connect Salesforce CLI to the target Salesforce org (see the [auth commands](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_auth.htm#cli_reference_force_auth) in the documentation).
2. Run the `retrieve` command (here assuming that the deployment descriptor is located in the subdirectory `testdata`):

   ```bash
   sfdx datadeploy:retrieve -d testdata -u yourname@yourorg.com
   ```

TIP: If the deployment descriptor is in the current working directory you can omit the `-d` flag.

## Tips and Examples

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

# Commands

<!-- commands -->
* [`sfdx datadeploy:deploy [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-datadeploydeploy--d-directory--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)
* [`sfdx datadeploy:retrieve [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-datadeployretrieve--d-directory--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx datadeploy:deploy [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy records from data files to Salesforce

```
USAGE
  $ sfdx datadeploy:deploy [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --deploydir=deploydir                                                         directory containing the deployment
                                                                                    descriptor 'datadeploy.json'
                                                                                    (default: current working directory)

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com
```

## `sfdx datadeploy:retrieve [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

retrieve records from Salesforce to data files

```
USAGE
  $ sfdx datadeploy:retrieve [-d <directory>] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --deploydir=deploydir                                                         directory containing the deployment
                                                                                    descriptor 'datadeploy.json'
                                                                                    (default: current working directory)

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx datadeploy:retrieve --deploydir ./testdata --targetusername myOrg@example.com
```
<!-- commandsstop -->

# License

[MIT](https://opensource.org/licenses/MIT)
