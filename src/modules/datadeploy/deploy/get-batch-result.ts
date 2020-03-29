import { Connection } from '@salesforce/core';
import { RecordResult } from 'jsforce';
import { BatchInfo } from './batch-info';
import { BatchRecordErrorResult, BatchRecordResult, BatchRecordSuccessResult, BatchResult } from './batch-result';

/**
 * Get the result of the Bulk API batch given by the batch info using the given JSforce connection.
 *
 * @param {Connection} connection JSforce connection.
 * @param {BatchInfo} batchInfo Batch information including job ID and batch ID.
 * @param {unknown[]} data Records sent for the batch. Required to associate results with individual records.
 * @param {number} waitMinutes Maximum number of minutes to wait for result.
 * @returns {Promise<BatchResult>}
 */
export default function getBatchResult(
  connection: Connection,
  batchInfo: BatchInfo,
  data: unknown[],
  waitMinutes: number
): Promise<BatchResult> {
  const job = connection.bulk.job(batchInfo.jobId);
  const batch = job.batch(batchInfo.batchId);
  batch.poll(5000, waitMinutes * 60 * 1000);
  return new Promise<BatchResult>(resolve => {
    batch.on('response', (results: RecordResult[]) => {
      const recordResults: BatchRecordResult[] = results.map((result, index) => ({ result, record: data[index] }));
      const successResults = recordResults.filter(({ result }) => result.success) as BatchRecordSuccessResult[];
      const errorResults = recordResults.filter(({ result }) => !result.success) as BatchRecordErrorResult[];
      resolve({ successResults, errorResults });
    });
  });
}
