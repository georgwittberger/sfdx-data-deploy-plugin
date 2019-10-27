# SFDX Data Deploy Plugin

![npm](https://img.shields.io/npm/v/sfdx-data-deploy-plugin)
![GitHub issues](https://img.shields.io/github/issues/georgwittberger/sfdx-data-deploy-plugin)
![GitHub](https://img.shields.io/github/license/georgwittberger/sfdx-data-deploy-plugin)

SFDX plugin to deploy data from CSV files to a Salesforce org

## Installation

### Installation Using Salesforce CLI

```bash
sfdx plugins:install sfdx-data-deploy-plugin
```

### Installation Using Sources

1. Install [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli) and [Node.js](https://nodejs.org/).
2. Clone this Git repository and enter the local directory:

   ```bash
   git clone https://github.com/georgwittberger/sfdx-data-deploy-plugin.git
   cd sfdx-data-deploy-plugin
   ```

3. Install Yarn and TypeScript (if not already installed):

   ```bash
   npm install -g yarn
   npm install -g typescript
   ```

4. Install the plugin dependencies:

   ```bash
   yarn install
   ```

5. Link the plugin to Salesforce CLI:

   ```bash
   sfdx plugins:link
   ```

## Deploying Data From CSV Files

The plugin initiates bulk API `upsert` jobs for a set of CSV files. The job configurations are defined in a JSON file named `datadeploy.json` which is called the deployment descriptor. Preparing a data deployment includes the following steps:

1. Create a directory to store the files related to the deployment (e.g. `testdata`).
2. Create the deployment descriptor file `datadeploy.json` in the deployment directory. See the format description below.
3. Create the CSV files containing the data to deploy and put them in the deployment directory. One file belongs to a certain sObject. There can be multiple files for the same sObject. See the format description below. You can generate CSV files using a SOQL query with Salesforce CLI:

   ```bash
   sfdx force:data:soql:query -r csv -q "SELECT Name,... FROM Account WHERE ..." > testdata/Account.csv
   ```

4. Connect Salesforce CLI to the Salesforce org to deploy the data to (see `force:auth` commands).
5. Run the SFDX command to start the deployment:

   ```bash
   sfdx datadeploy:deploy --deploydir ./testdata
   ```

### Deployment Descriptor Format

The deployment descriptor file `datadeploy.json` must have the following format:

```json
{
  "jobs": [
    {
      "sObjectName": "Account",
      "externalIdField": "AccountId__c",
      "csvFile": "Account.csv"
    },
    {
      "sObjectName": "Contact",
      "externalIdField": "ContactId__c",
      "csvFile": "Contact.csv"
    }
  ]
}
```

The `jobs` array defines the bulk API jobs to perform. These jobs are processed in the order as they appear in the array one after another, so jobs for dependent objects should come last.

**Job configuration properties:**

| Property          | Description                                       | Example                          |
| ----------------- | ------------------------------------------------- | -------------------------------- |
| `sObjectName`     | Name of the Salesforce object to deploy data for  | `Account` or `MyCustomObject__c` |
| `externalIdField` | Name of the field used to match existing records  | `AccountId__c`                   |
| `csvFile`         | Relative path to the CSV file containing the data | `Account.csv`                    |

### CSV File Format

The CSV files containing the data to deploy must have the same format as it is used for Salesforce bulk API operations. The file must have a header row defining the fields to import for each record. Since the plugin creates bulk API `upsert` jobs the external Id field of the sObject must be present as a column in the CSV file.

Example for Account (with external Id field):

```csv
AccountId__c,Name
b7845971-2677-43e0-9316-4909060da942,Demo Company 1
01898b4a-555b-4010-ab1c-e6e9aeb3f20e,Demo Company 2
5ff32eec-8b2e-4ff7-8eef-077a9a79c13d,Demo Company 3
```

Example for Contact (with relationship to Account using external Id):

```csv
ContactId__c,FirstName,LastName,Email,Account.AccountId__c
fead3f99-1469-46fa-b6c0-4a8ce6e45736,Georg,Wittberger,georg.wittberger@gmail.com,b7845971-2677-43e0-9316-4909060da942
```

TIP: Relationships to other custom sObjects via external Id field can be expressed like this: `otherObject__r.otherObjectExtId__c`

### Deployment Example

See the subdirectory `data` in this Git repository for an example of a deployment directory.

## Commands

<!-- commands -->

- [`sfdx datadeploy:deploy [-d <directory>] [-w <minutes>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-datadeploydeploy--d-directory--w-minutes--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx datadeploy:deploy [-d <directory>] [-w <minutes>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy data from CSV files to a Salesforce org

```
USAGE
  $ sfdx datadeploy:deploy [-d <directory>] [-w <minutes>] [-u <string>] [--apiversion <string>] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --deploydir=deploydir                                                         directory containing the deployment
                                                                                    descriptor 'datadeploy.json'
                                                                                    (default: current working directory)

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --waitperobject=waitperobject                                                 number of minutes to wait for each
                                                                                    bulk API job (default: 5 minutes)

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com
```

_See code: [lib\commands\datadeploy\deploy.js](https://github.com/georgwittberger/sfdx-data-deploy-plugin/blob/v1.0.1/lib\commands\datadeploy\deploy.js)_

<!-- commandsstop -->

## License

[MIT](https://opensource.org/licenses/MIT)
