import { flags, SfdxCommand, SfdxResult } from '@salesforce/command';
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
        let bulkOperation: string;
        if (job.deployConfig.externalIdFieldApiName) {
          bulkOperation = 'upsert';
          bulkJob = connection.bulk.createJob(job.sObjectApiName, bulkOperation, {
            extIdField: job.deployConfig.externalIdFieldApiName
          });
        } else {
          bulkOperation = 'insert';
          bulkJob = connection.bulk.createJob(job.sObjectApiName, bulkOperation);
        }

        let bulkBatch = bulkJob.createBatch();
        bulkBatch.execute(data);
        const { id: batchId, jobId } = await new Promise<BatchInfo>(resolve => {
          bulkBatch.on('queue', (batchInfo: BatchInfo) => resolve(batchInfo));
        });

        bulkJob = connection.bulk.job(jobId);
        bulkBatch = bulkJob.batch(batchId);
        bulkBatch.poll(5000, waitMinutes * 60 * 1000);

        const bulkBatchResult = await new Promise<BatchRecordResult[]>(resolve => {
          bulkBatch.on('response', (recordResults: RecordResult[]) => {
            resolve(recordResults.map((result, index) => ({ result, record: data[index] })));
          });
        });

        const errorResults = bulkBatchResult.filter(({ result: { success } }) => !success) as BatchRecordErrorResult[];
        if (errorResults.length > 0) {
          errorResults.forEach(({ result: { errors = [] }, record }) =>
            this.log(messages.getMessage('errorDeployRecordFailed', [JSON.stringify(record), errors.join(', ')]))
          );
          throw new Error(messages.getMessage('errorDeploySomeRecordFailed'));
        }

        this.log(messages.getMessage('infoDeployDataSucceeded', [data.length, job.sObjectApiName]));
        deploymentResult.jobResults.push({
          sObjectApiName: job.sObjectApiName,
          operation: bulkOperation,
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
  operation: string;
  dataFileName: string;
  deployedRecordsCount: number;
}

/**
 * Result of the deployment of a single record.
 */
interface BatchRecordResult {
  result: RecordResult;
  record: unknown;
}

/**
 * Error result of the deployment of a single record.
 */
interface BatchRecordErrorResult {
  result: ErrorResult;
  record: unknown;
}
