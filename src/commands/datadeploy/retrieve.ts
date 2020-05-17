import { flags, SfdxCommand, SfdxResult } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { readJsonSync, writeJsonSync } from 'fs-extra';
import * as path from 'path';
import { getAbsolutePath } from '../../modules/datadeploy/config/core';
import { DeploymentConfig } from '../../modules/datadeploy/config/deployment-config';
import { retrieveData } from '../../modules/datadeploy/retrieve/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sfdx-data-deploy-plugin', 'datadeploy-retrieve');

/**
 * Command to retrieve data from Salesforce
 */
export default class DataDeployRetrieve extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    '$ sfdx datadeploy:retrieve --deploydir ./testdata --targetusername myOrg@example.com',
    '$ sfdx datadeploy:retrieve --deploydir ./testdata --include Account.json,Contact.json --targetusername myOrg@example.com'
  ];

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: 'sObjectApiName', label: messages.getMessage('resultTableSObject') },
        { key: 'status', label: messages.getMessage('resultTableStatus') },
        { key: 'dataFileName', label: messages.getMessage('resultTableDataFile') },
        { key: 'retrievedRecordsCount', label: messages.getMessage('resultTableRecords') }
      ]
    },
    display() {
      this.ux.table(((this.data as unknown) as RetrievalResult).jobResults, this.tableColumnData);
    }
  };

  protected static flagsConfig = {
    deploydir: flags.directory({
      char: 'd',
      description: messages.getMessage('deploydirFlagDescription')
    }),
    include: flags.array({
      char: 'i',
      description: messages.getMessage('includeFlagDescription')
    }),
    exclude: flags.array({
      char: 'x',
      description: messages.getMessage('excludeFlagDescription')
    })
  };

  protected static requiresUsername = true;
  protected static requiresProject = false;

  public async run(): Promise<RetrievalResult> {
    const deploymentDirectory = getAbsolutePath(this.flags.deploydir);
    this.ux.log(messages.getMessage('infoDeploymentDirectory', [deploymentDirectory]));

    const deploymentFile = path.resolve(deploymentDirectory, 'datadeploy.json');
    this.ux.log(messages.getMessage('infoDeploymentFile', [deploymentFile]));

    let deploymentConfig: DeploymentConfig;
    try {
      deploymentConfig = readJsonSync(deploymentFile) as DeploymentConfig;
    } catch (error) {
      throw new SfdxError(messages.getMessage('errorDeploymentFileNotReadable', [deploymentFile]));
    }

    const retrievalResult: RetrievalResult = {
      deploymentDirectory,
      jobResults: []
    };

    for (const jobConfig of deploymentConfig.jobs) {
      if (
        (this.flags.include && this.flags.include.length > 0 && !this.flags.include.includes(jobConfig.dataFileName)) ||
        (this.flags.exclude && this.flags.exclude.length > 0 && this.flags.exclude.includes(jobConfig.dataFileName))
      ) {
        this.ux.log(messages.getMessage('infoSkippingFile', [jobConfig.dataFileName]));
        retrievalResult.jobResults.push({
          sObjectApiName: jobConfig.sObjectApiName,
          status: 'skipped',
          dataFileName: jobConfig.dataFileName,
          retrievedRecordsCount: 0
        });
        continue;
      }

      const dataFile = path.resolve(deploymentDirectory, jobConfig.dataFileName);

      try {
        this.ux.log(messages.getMessage('infoRetrievingRecordsToFile', [jobConfig.sObjectApiName, dataFile]));

        const connection = this.org.getConnection();
        const data = await retrieveData(connection, jobConfig);
        writeJsonSync(dataFile, data, { spaces: 2 });

        this.ux.log(messages.getMessage('infoRetrieveDataSucceeded', [data.length, jobConfig.sObjectApiName]));
        retrievalResult.jobResults.push({
          sObjectApiName: jobConfig.sObjectApiName,
          status: 'success',
          dataFileName: jobConfig.dataFileName,
          retrievedRecordsCount: data.length
        });
      } catch (error) {
        throw new SfdxError(messages.getMessage('errorRetrieveDataFailed', [jobConfig.sObjectApiName, error.message]));
      }
    }

    this.ux.log(messages.getMessage('infoRetrievalCompleted', [deploymentDirectory]));
    return retrievalResult;
  }
}

/**
 * Result of the data retrieval
 */
export interface RetrievalResult {
  deploymentDirectory: string;
  jobResults: RetrievalJobResult[];
}

/**
 * Result of one data retrieval job
 */
export interface RetrievalJobResult {
  sObjectApiName: string;
  status: string;
  dataFileName: string;
  retrievedRecordsCount: number;
}
