import { flags, SfdxCommand, SfdxResult } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import { readJsonSync } from 'fs-extra';
import * as path from 'path';
import { DeploymentConfig } from '../../modules/datadeploy/config/core';
import { closeJob, createJob, createSingleBatch, getBatchResult } from '../../modules/datadeploy/deploy/core';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sfdx-data-deploy-plugin', 'datadeploy-deploy');

/**
 * Command to deploy data to Salesforce
 */
export default class DataDeployDeploy extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [
    '$ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com',
    '$ sfdx datadeploy:deploy --deploydir ./testdata --include Account.json,Contact.json --targetusername myOrg@example.com'
  ];

  public static result: SfdxResult = {
    tableColumnData: {
      columns: [
        { key: 'sObjectApiName', label: messages.getMessage('resultTableSObject') },
        { key: 'operation', label: messages.getMessage('resultTableOperation') },
        { key: 'dataFileName', label: messages.getMessage('resultTableDataFile') },
        { key: 'deployedRecordsCount', label: messages.getMessage('resultTableDeployedRecords') },
        { key: 'failedRecordsCount', label: messages.getMessage('resultTableFailedRecords') }
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

  public async run(): Promise<DeploymentResult> {
    const deploymentDirectory = path.resolve(this.flags.deploydir);
    this.ux.log(messages.getMessage('infoDeploymentDirectory', [deploymentDirectory]));

    const deploymentFile = path.resolve(deploymentDirectory, 'datadeploy.json');
    this.ux.log(messages.getMessage('infoDeploymentFile', [deploymentFile]));

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
      const jobResult = {
        sObjectApiName: jobConfig.sObjectApiName,
        operation: '',
        dataFileName: jobConfig.dataFileName,
        deployedRecordsCount: 0,
        failedRecordsCount: 0
      };
      deploymentResult.jobResults.push(jobResult);

      if (
        (this.flags.include && this.flags.include.length > 0 && !this.flags.include.includes(jobConfig.dataFileName)) ||
        (this.flags.exclude && this.flags.exclude.length > 0 && this.flags.exclude.includes(jobConfig.dataFileName))
      ) {
        jobResult.operation = 'skipped';
        this.ux.log(messages.getMessage('infoSkippingFile', [jobConfig.dataFileName]));
        continue;
      }

      try {
        const dataFile = path.resolve(deploymentDirectory, jobConfig.dataFileName);
        if (!fs.existsSync(dataFile)) {
          throw new Error(messages.getMessage('errorDataFileNotFound', [jobConfig.sObjectApiName, dataFile]));
        }

        let data: unknown[];
        try {
          data = readJsonSync(dataFile) as unknown[];
        } catch (error) {
          throw new Error(messages.getMessage('errorDataFileNotReadable', [jobConfig.sObjectApiName, error.message]));
        }

        if (data.length < 1) {
          jobResult.operation = 'skipped';
          this.ux.log(messages.getMessage('infoSkippingEmptyFile', [jobConfig.dataFileName]));
          continue;
        }

        jobResult.failedRecordsCount = data.length;

        const waitMinutes =
          jobConfig.deployConfig && jobConfig.deployConfig.maxWaitMinutes ? jobConfig.deployConfig.maxWaitMinutes : 5;

        this.ux.log(
          messages.getMessage('infoDeployingRecordsFromFile', [
            data.length,
            jobConfig.sObjectApiName,
            dataFile,
            waitMinutes
          ])
        );

        const connection = this.org.getConnection();
        const { job, operation } = createJob(connection, jobConfig);

        jobResult.operation = operation;

        const batchInfo = await createSingleBatch(job, data);
        await closeJob(job);
        const { successResults, errorResults } = await getBatchResult(connection, batchInfo, data, waitMinutes);

        jobResult.deployedRecordsCount = successResults.length;
        jobResult.failedRecordsCount = errorResults.length;

        if (errorResults.length > 0) {
          errorResults.forEach(({ result: { errors = [] }, record }) =>
            this.ux.log(messages.getMessage('errorDeployRecordFailed', [JSON.stringify(record), errors.join(', ')]))
          );
          throw new Error(messages.getMessage('errorDeployDataPartiallyFailed', [errorResults.length]));
        } else {
          this.ux.log(
            messages.getMessage('infoDeployDataSucceeded', [successResults.length, jobConfig.sObjectApiName])
          );
        }
      } catch (error) {
        if (
          !jobConfig.deployConfig ||
          typeof jobConfig.deployConfig.failOnError === 'undefined' ||
          jobConfig.deployConfig.failOnError
        ) {
          throw new SfdxError(messages.getMessage('errorDeployDataFailed', [jobConfig.sObjectApiName, error.message]));
        }
        this.ux.log(messages.getMessage('infoDeployDataFailed', [jobConfig.sObjectApiName, error.message]));
      }
    }

    if (deploymentResult.jobResults.some(({ failedRecordsCount }) => failedRecordsCount > 0)) {
      this.ux.log(messages.getMessage('infoDeploymentPartiallyFailed', [deploymentDirectory]));
    } else {
      this.ux.log(messages.getMessage('infoDeploymentCompleted', [deploymentDirectory]));
    }
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
  failedRecordsCount: number;
}
