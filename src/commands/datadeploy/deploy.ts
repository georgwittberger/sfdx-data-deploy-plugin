import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import * as fs from 'fs';
import { readJsonSync } from 'fs-extra';
import { BatchInfo, ErrorResult, Job, RecordResult } from 'jsforce';
import * as path from 'path';
import { DeploymentConfig } from '../../config/deployment-config';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sfdx-data-deploy-plugin', 'datadeploy-deploy');

/**
 * Command to deploy data to Salesforce
 */
export default class DataDeployDeploy extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = ['$ sfdx datadeploy:deploy --deploydir ./testdata --targetusername myOrg@example.com'];

  protected static flagsConfig = {
    deploydir: flags.directory({
      char: 'd',
      description: messages.getMessage('deploydirFlagDescription')
    })
  };

  protected static requiresUsername = true;
  protected static requiresProject = false;

  public async run(): Promise<DeploymentResult> {
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

    const deploymentResult: DeploymentResult = {
      deploymentDirectory,
      jobResults: []
    };

    for (const job of deploymentConfig.jobs) {
      const dataFile = path.resolve(deploymentDirectory, job.dataFileName);
      if (!fs.existsSync(dataFile)) {
        throw new SfdxError(messages.getMessage('errorDataFileNotFound', [job.sObjectApiName, dataFile]));
      }

      let data: unknown[];
      try {
        data = readJsonSync(dataFile) as unknown[];
      } catch (error) {
        throw new SfdxError(messages.getMessage('errorDataFileNotReadable', [job.sObjectApiName, error.message]));
      }

      const waitMinutes = job.deployConfig && job.deployConfig.maxWaitMinutes ? job.deployConfig.maxWaitMinutes : 5;

      try {
        this.log(
          messages.getMessage('infoDeployingRecordsFromFile', [data.length, job.sObjectApiName, dataFile, waitMinutes])
        );

        const connection = this.org.getConnection();

        let bulkJob: Job;
        if (job.deployConfig.externalIdFieldApiName) {
          bulkJob = connection.bulk.createJob(job.sObjectApiName, 'upsert', {
            extIdField: job.deployConfig.externalIdFieldApiName
          });
        } else {
          bulkJob = connection.bulk.createJob(job.sObjectApiName, 'insert');
        }

        let bulkBatch = bulkJob.createBatch();
        bulkBatch.execute(data);
        const { id: batchId, jobId } = await new Promise<BatchInfo>(resolve => {
          bulkBatch.on('queue', (batchInfo: BatchInfo) => resolve(batchInfo));
        });

        bulkJob = connection.bulk.job(jobId);
        bulkBatch = bulkJob.batch(batchId);
        bulkBatch.poll(5000, waitMinutes * 60 * 1000);

        const bulkBatchResult = await new Promise<RecordResult[]>(resolve => {
          bulkBatch.on('response', (recordResults: RecordResult[]) => resolve(recordResults));
        });

        const errorResults = bulkBatchResult.filter(({ success }) => !success) as ErrorResult[];
        if (errorResults.length > 0) {
          errorResults.forEach(({ errors = [] }) =>
            this.log(messages.getMessage('errorDeployRecordFailed', [errors.join(', ')]))
          );
          throw new Error(messages.getMessage('errorDeploySomeRecordFailed'));
        }

        this.log(messages.getMessage('infoDeployDataSucceeded', [data.length, job.sObjectApiName]));
        deploymentResult.jobResults.push({
          sObjectApiName: job.sObjectApiName,
          dataFileName: job.dataFileName,
          deployedRecordsCount: data.length
        });
      } catch (error) {
        throw new SfdxError(messages.getMessage('errorDeployDataFailed', [job.sObjectApiName, error.message]));
      }
    }

    this.log(messages.getMessage('infoDeploymentCompleted', [deploymentDirectory]));
    return deploymentResult;
  }

  private getDeploymentDirectory(): string {
    return this.flags.deploydir && path.isAbsolute(this.flags.deploydir)
      ? this.flags.deploydir
      : path.resolve(process.cwd(), this.flags.deploydir || '');
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
  dataFileName: string;
  deployedRecordsCount: number;
}
