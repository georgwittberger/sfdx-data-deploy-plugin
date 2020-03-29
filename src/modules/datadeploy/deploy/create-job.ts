import { Connection } from '@salesforce/core';
import { Job } from 'jsforce';
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
  let job: Job;
  let operation: string;
  if (config.deployConfig.externalIdFieldApiName) {
    operation = 'upsert';
    job = connection.bulk.createJob(config.sObjectApiName, operation, {
      extIdField: config.deployConfig.externalIdFieldApiName
    });
  } else {
    operation = 'insert';
    job = connection.bulk.createJob(config.sObjectApiName, operation);
  }
  return { job, operation };
}
