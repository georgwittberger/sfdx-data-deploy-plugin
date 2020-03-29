import { flags, SfdxCommand, SfdxResult } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import { readJsonSync } from 'fs-extra';
import * as path from 'path';
import { getAbsolutePath } from '../../modules/datadeploy/config/core';
import { DeploymentConfig } from '../../modules/datadeploy/config/deployment-config';
import { createJob, createSingleBatch, getBatchResult } from '../../modules/datadeploy/deploy/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sfdx-data-deploy-plugin', 'datadeploy-deploy');

/**
 * Command to deploy data to Salesforce
 */
export default class DataDeployDeploy extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = ['$ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com'];

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: 'sObjectApiName', label: messages.getMessage('resultTableSObject') },
        { key: 'operation', label: messages.getMessage('resultTableOperation') },
        { key: 'dataFileName', label: messages.getMessage('resultTableDataFile') },
        { key: 'deployedRecordsCount', label: messages.getMessage('resultTableRecords') }
      ]
    },
    display() {
      this.ux.table(((this.data as unknown) as DeploymentResult).jobResults, this.tableColumnData);
    }
  };

  protected static flagsConfig = {
    deploydir: flags.directory({
      char: 'd',
      description: messages.getMessage('deploydirFlagDescription')
    })
  };

  protected static requiresUsername = true;
  protected static requiresProject = false;

  public async run(): Promise<DeploymentResult> {
    const deploymentDirectory = getAbsolutePath(this.flags.deploydir);
    this.log(messages.getMessage('infoDeploymentDirectory', [deploymentDirectory]));

    const deploymentFile = path.resolve(deploymentDirectory, 'datadeploy.json');
    this.log(messages.getMessage('infoDeploymentFile', [deploymentFile]));

    let deploymentConfig: DeploymentConfig;
    try {
      deploymentConfig = readJsonSync(deploymentFile) as DeploymentConfig;
    } catch (error) {
      throw new SfdxError(messages.getMessage('errorDeploymentFileNotReadable', [deploymentFile]));
    }

    const deploymentResult: DeploymentResult = {
      deploymentDirectory,
      jobResults: []
    };

    for (const jobConfig of deploymentConfig.jobs) {
      const dataFile = path.resolve(deploymentDirectory, jobConfig.dataFileName);
      if (!fs.existsSync(dataFile)) {
        throw new SfdxError(messages.getMessage('errorDataFileNotFound', [jobConfig.sObjectApiName, dataFile]));
      }

      let data: unknown[];
      try {
        data = readJsonSync(dataFile) as unknown[];
      } catch (error) {
        throw new SfdxError(messages.getMessage('errorDataFileNotReadable', [jobConfig.sObjectApiName, error.message]));
      }

      const waitMinutes =
        jobConfig.deployConfig && jobConfig.deployConfig.maxWaitMinutes ? jobConfig.deployConfig.maxWaitMinutes : 5;

      try {
        this.log(
          messages.getMessage('infoDeployingRecordsFromFile', [
            data.length,
            jobConfig.sObjectApiName,
            dataFile,
            waitMinutes
          ])
        );

        const connection = this.org.getConnection();
        const { job, operation } = createJob(connection, jobConfig);
        const batchInfo = await createSingleBatch(job, data);
        const { successResults, errorResults } = await getBatchResult(connection, batchInfo, data, waitMinutes);

        if (errorResults.length > 0) {
          errorResults.forEach(({ result: { errors = [] }, record }) =>
            this.log(messages.getMessage('errorDeployRecordFailed', [JSON.stringify(record), errors.join(', ')]))
          );
          throw new Error(messages.getMessage('errorDeploySomeRecordFailed'));
        }

        this.log(messages.getMessage('infoDeployDataSucceeded', [successResults.length, jobConfig.sObjectApiName]));
        deploymentResult.jobResults.push({
          sObjectApiName: jobConfig.sObjectApiName,
          operation,
          dataFileName: jobConfig.dataFileName,
          deployedRecordsCount: successResults.length
        });
      } catch (error) {
        throw new SfdxError(messages.getMessage('errorDeployDataFailed', [jobConfig.sObjectApiName, error.message]));
      }
    }

    this.log(messages.getMessage('infoDeploymentCompleted', [deploymentDirectory]));
    return deploymentResult;
  }
}

/**
 * Result of the data deployment
 */
export interface DeploymentResult {
  deploymentDirectory: string;
  jobResults: DeploymentJobResult[];
}

/**
 * Result of one data deployment job
 */
export interface DeploymentJobResult {
  sObjectApiName: string;
  operation: string;
  dataFileName: string;
  deployedRecordsCount: number;
}
