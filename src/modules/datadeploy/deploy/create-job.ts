import { Connection } from '@salesforce/core';
import { JobConfig } from '../config/deployment-config';
import { JobInfo } from './job-info';

/**
 * Create Bulk API job for the given job configuration using the given JSforce connection.
 *
 * @param {Connection} connection JSforce connection.
 * @param {JobConfig} config Job configuration.
 * @returns {JobInfo} Details about the created job.
 */
export default function createJob(connection: Connection, config: JobConfig): JobInfo {
  const operation = config.deployConfig && config.deployConfig.externalIdFieldApiName ? 'upsert' : 'insert';
  const options =
    config.deployConfig && config.deployConfig.externalIdFieldApiName
      ? { extIdField: config.deployConfig.externalIdFieldApiName }
      : undefined;
  const job = connection.bulk.createJob(config.sObjectApiName, operation, options);
  return { job, operation };
}
