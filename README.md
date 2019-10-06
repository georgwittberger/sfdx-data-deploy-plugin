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
3. Create the CSV files containing the data to deploy and put them in the deployment directory. One file belongs to a certain sObject. There can be multiple files for the same sObject. You can generate CSV files using a SOQL query with Salesforce CLI:

   ```bash
   sfdx force:data:soql:query -r csv -q "SELECT Name,... FROM Account WHERE ..." > testdata/Account.csv
   ```

4. Connect Salesforce CLI to the Salesforce org to deploy the data to (see `force:auth` commands).
5. Run the SFDX command to start the deployment:

   ```bash
   sfdx datadeploy:deploy --deploydir ./testdata
   ```

### Deployment Descriptor Format

Example of a `datadeploy.json` file in the deployment directory:

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

The `jobs` array defines the bulk API jobs to perform. These jobs are processed in the order as they appear in the array, so jobs for dependent objects should come last.

**Job configuration properties:**

| Property          | Description                                       | Example                          |
| ----------------- | ------------------------------------------------- | -------------------------------- |
| `sObjectName`     | Name of the Salesforce object to deploy data for  | `Account` or `MyCustomObject__c` |
| `externalIdField` | Name of the field used to match existing records  | `AccountId__c`                   |
| `csvFile`         | Relative path to the CSV file containing the data | `Account.csv`                    |

See the subdirectory `data` in this Git repository for an example of a deployment directory.

## Commands

<!-- commands -->
* [`sfdx datadeploy:deploy [-d <directory>] [-w <minutes>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-datadeploydeploy--d-directory--w-minutes--u-string---apiversion-string---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx datadeploy:deploy [-d <directory>] [-w <minutes>] [-u <string>] [--apiversion <string>] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

deploy data from CSV files to a Salesforce org

```
USAGE
  $ sfdx datadeploy:deploy [-d <directory>] [-w <minutes>] [-u <string>] [--apiversion <string>] [--json] [--loglevel 
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -d, --deploydir=deploydir                                                         [default: working directory]
                                                                                    directory containing the
                                                                                    deployment descriptor
                                                                                    'datadeploy.json'

  -u, --targetusername=targetusername                                               username or alias for the target
                                                                                    org; overrides default target org

  -w, --waitperobject=waitperobject                                                 [default: 5 minutes] the number of
                                                                                    minutes to wait for each bulk API
                                                                                    job

  --apiversion=apiversion                                                           override the api version used for
                                                                                    api requests made by this command

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation

EXAMPLE
  $ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com
```

_See code: [lib\commands\datadeploy\deploy.js](https://github.com/georgwittberger/sfdx-data-deploy-plugin/blob/v1.0.0/lib\commands\datadeploy\deploy.js)_
<!-- commandsstop -->

## License

[MIT](https://opensource.org/licenses/MIT)
