import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { readJsonSync, writeJsonSync } from 'fs-extra';
import * as path from 'path';
import { DeploymentConfig } from '../../config/deployment-config';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sfdx-data-deploy-plugin', 'datadeploy-retrieve');

/**
 * Command to retrieve data from Salesforce
 */
export default class DataDeployRetrieve extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = ['$ sfdx datadeploy:retrieve --deploydir ./testdata --targetusername myOrg@example.com'];

  protected static flagsConfig = {
    deploydir: flags.directory({
      char: 'd',
      description: messages.getMessage('deploydirFlagDescription')
    })
  };

  protected static requiresUsername = true;
  protected static requiresProject = false;

  public async run(): Promise<RetrievalResult> {
    const deploymentDirectory = this.getDeploymentDirectory();
    this.log(messages.getMessage('infoDeploymentDirectory', [deploymentDirectory]));

    const deploymentFile = path.resolve(deploymentDirectory, 'datadeploy.json');
    this.log(messages.getMessage('infoDeploymentFile', [deploymentFile]));

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

    for (const job of deploymentConfig.jobs) {
      const dataFile = path.resolve(deploymentDirectory, job.dataFileName);

      try {
        this.log(messages.getMessage('infoRetrievingRecordsToFile', [job.sObjectApiName, dataFile]));

        const connection = this.org.getConnection();

        const data = await new Promise<unknown[]>((resolve, reject) => {
          const query = connection.sobject(job.sObjectApiName).select(job.retrieveConfig.fieldApiNames);
          if (job.retrieveConfig.filterCriteria) {
            query.where(job.retrieveConfig.filterCriteria);
          }
          if (job.retrieveConfig.sortFieldNames) {
            query.sort(job.retrieveConfig.sortFieldNames.join(' '));
          }
          if (job.retrieveConfig.maxRecordCount) {
            query.limit(job.retrieveConfig.maxRecordCount);
          }
          query.execute({}, (error: Error, records: unknown[]) => {
            if (error) {
              reject(error);
            } else {
              records.forEach(record => {
                deleteMetaAttributes(record);
                flattenNestedObjects(record);
              });
              resolve(records);
            }
          });
        });

        writeJsonSync(dataFile, data, { spaces: 2 });

        this.log(messages.getMessage('infoRetrieveDataSucceeded', [data.length, job.sObjectApiName]));
        retrievalResult.jobResults.push({
          sObjectApiName: job.sObjectApiName,
          dataFileName: job.dataFileName,
          retrievedRecordsCount: data.length
        });
      } catch (error) {
        throw new SfdxError(messages.getMessage('errorRetrieveDataFailed', [job.sObjectApiName, error.message]));
      }
    }

    this.log(messages.getMessage('infoRetrievalCompleted', [deploymentDirectory]));
    return retrievalResult;
  }

  private getDeploymentDirectory(): string {
    return this.flags.deploydir && path.isAbsolute(this.flags.deploydir)
      ? this.flags.deploydir
      : path.resolve(process.cwd(), this.flags.deploydir || '');
  }
}

// tslint:disable-next-line: no-any
function deleteMetaAttributes(record: any): void {
  if (typeof record.attributes === 'object' && record.attributes !== null) {
    delete record.attributes;
  }
  for (const property in record) {
    if (!record.hasOwnProperty(property)) continue;
    if (typeof record[property] === 'object' && record[property] !== null) {
      deleteMetaAttributes(record[property]);
    }
  }
}

// tslint:disable-next-line: no-any
function flattenNestedObjects(record: any): void {
  for (const property in record) {
    if (!record.hasOwnProperty(property)) continue;
    const childObject = record[property];
    if (typeof childObject === 'object' && childObject !== null) {
      flattenNestedObjects(childObject);
      for (const childProperty in childObject) {
        if (!childObject.hasOwnProperty(childProperty)) continue;
        record[property + '.' + childProperty] = childObject[childProperty];
      }
      delete record[property];
    }
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
  dataFileName: string;
  retrievedRecordsCount: number;
}
