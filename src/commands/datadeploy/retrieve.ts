import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { readJsonSync, writeJsonSync } from 'fs-extra';
import * as path from 'path';
import { DeploymentConfig } from '../../config/deployment-config';
import deleteExcludedFields from '../../transform/delete-excluded-fields';
import deleteMetaAttributes from '../../transform/delete-meta-attributes';
import deleteSystemFields from '../../transform/delete-system-fields';
import flattenNestedObjects from '../../transform/flatten-nested-objects';
import transformContactAccountRelationship from '../../transform/transform-contact-account-relationship';
import transformRelationships from '../../transform/transform-relationships';

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
          const query = connection
            .sobject(job.sObjectApiName)
            .select(
              job.retrieveConfig && job.retrieveConfig.includeFieldApiNames
                ? job.retrieveConfig.includeFieldApiNames
                : ['*']
            );
          if (job.retrieveConfig && job.retrieveConfig.filterCriteria) {
            query.where(job.retrieveConfig.filterCriteria);
          }
          if (job.retrieveConfig && job.retrieveConfig.sortFieldApiNames) {
            query.sort(job.retrieveConfig.sortFieldApiNames.join(' '));
          }
          if (job.retrieveConfig && job.retrieveConfig.maxRecordCount) {
            query.limit(job.retrieveConfig.maxRecordCount);
          }
          query.execute({}, (error: Error, records: unknown[]) => {
            if (error) {
              reject(error);
            } else {
              records.forEach(record => {
                deleteMetaAttributes(record);
                deleteSystemFields(record);
                flattenNestedObjects(record);
                transformRelationships(record);
                if (job.sObjectApiName.toLowerCase() === 'contact') {
                  transformContactAccountRelationship(record);
                }
                if (job.retrieveConfig && job.retrieveConfig.excludeFieldApiNames) {
                  deleteExcludedFields(record, job.retrieveConfig.excludeFieldApiNames);
                }
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
